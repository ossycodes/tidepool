import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { JSDOM } from 'jsdom';
import { PrismaService } from '../prisma/prisma.service.js';
import { toPostResponse } from '../blogs/blog.response.js';
import type { AnnotationDto, StateDto } from './dto.js';

export const ARTICLE_QUEUE = 'article-content';

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(ARTICLE_QUEUE) private readonly queue: Queue,
  ) {}

  async accessible(userId: string, postId: string) {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        OR: [
          { blog: { subscriptions: { some: { userId } } } },
          { readers: { some: { userId, saved: true } } },
        ],
      },
      include: {
        content: true,
        blog: { select: { title: true, siteUrl: true } },
      },
    });
    if (!post) throw new NotFoundException('Article not found');
    return post;
  }

  async list(userId: string) {
    const [items, collections] = await Promise.all([
      this.prisma.userPost.findMany({
        where: { userId, saved: true },
        orderBy: { createdAt: 'desc' },
        include: {
          collections: { select: { id: true, name: true } },
          post: {
            include: {
              blog: { select: { title: true } },
              content: { select: { readingTime: true } },
            },
          },
        },
      }),
      this.prisma.collection.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { items: { where: { saved: true } } } } },
      }),
    ]);
    return {
      items: items.map(({ post, ...state }) => ({
        ...toPostResponse(post),
        blogTitle: post.blog.title,
        readingTime: post.content?.readingTime ?? null,
        state,
      })),
      collections: collections.map(({ _count, ...c }) => ({
        ...c,
        count: _count.items,
      })),
    };
  }

  async read(userId: string, postId: string) {
    const post = await this.accessible(userId, postId);
    const [state, annotations] = await Promise.all([
      this.prisma.userPost.findUnique({
        where: { userId_postId: { userId, postId } },
        include: { collections: { select: { id: true, name: true } } },
      }),
      this.prisma.annotation.findMany({
        where: { userId, postId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const job = post.content ? null : await this.queue.getJob(postId);
    return {
      ...toPostResponse(post),
      blog: post.blog,
      content: post.content,
      state,
      annotations,
      extraction: post.content
        ? 'ready'
        : job && (await job.getState()) === 'failed'
          ? 'failed'
          : job
            ? 'pending'
            : 'idle',
    };
  }

  async extract(userId: string, postId: string) {
    const post = await this.accessible(userId, postId);
    if (post.content) return { queued: false };
    const existing = await this.queue.getJob(postId);
    if (existing && (await existing.getState()) === 'failed')
      await existing.retry();
    else if (!existing)
      await this.queue.add(
        'extract',
        { postId },
        {
          jobId: postId,
          attempts: 2,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
          removeOnFail: { age: 86400 },
        },
      );
    return { queued: true };
  }

  async update(userId: string, postId: string, dto: StateDto) {
    const post = await this.accessible(userId, postId);
    const { collectionIds, ...data } = dto;
    if (
      data.paragraph &&
      !post.content?.html.includes(`id="${data.paragraph}"`)
    )
      throw new BadRequestException('Reading position not found');
    if (collectionIds) {
      const count = await this.prisma.collection.count({
        where: { userId, id: { in: [...new Set(collectionIds)] } },
      });
      if (count !== new Set(collectionIds).size)
        throw new BadRequestException('Collection not found');
    }
    return this.prisma.userPost.upsert({
      where: { userId_postId: { userId, postId } },
      create: {
        userId,
        postId,
        ...data,
        ...(collectionIds
          ? { collections: { connect: collectionIds.map((id) => ({ id })) } }
          : {}),
      },
      update: {
        ...data,
        ...(collectionIds
          ? { collections: { set: collectionIds.map((id) => ({ id })) } }
          : {}),
      },
      include: { collections: { select: { id: true, name: true } } },
    });
  }

  async createCollection(userId: string, rawName: string) {
    const name = rawName.trim();
    if (!name) throw new BadRequestException('Give your collection a name');
    if ((await this.prisma.collection.count({ where: { userId } })) >= 30)
      throw new BadRequestException('You can have up to 30 collections');
    return this.prisma.collection.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name },
      update: {},
    });
  }

  async deleteCollection(userId: string, id: string) {
    const result = await this.prisma.collection.deleteMany({
      where: { id, userId },
    });
    if (!result.count) throw new NotFoundException('Collection not found');
  }

  async annotate(userId: string, postId: string, dto: AnnotationDto) {
    const post = await this.accessible(userId, postId);
    if (!post.content || dto.version !== post.content.version)
      throw new BadRequestException('Reload the article before highlighting');
    const dom = new JSDOM(post.content.html);
    let text = '';
    try {
      text =
        dom.window.document.getElementById(dto.paragraph)?.textContent ?? '';
    } finally {
      dom.window.close();
    }
    if (
      !dto.quote ||
      dto.end <= dto.start ||
      text.slice(dto.start, dto.end) !== dto.quote
    )
      throw new BadRequestException('Select text within one paragraph');
    if (
      (await this.prisma.annotation.count({ where: { userId, postId } })) >= 200
    )
      throw new BadRequestException('This article has reached 200 notes');
    return this.prisma.annotation.create({
      data: {
        paragraph: dto.paragraph,
        quote: dto.quote,
        start: dto.start,
        end: dto.end,
        version: dto.version,
        note: dto.note,
        userId,
        postId,
        prefix: text.slice(Math.max(0, dto.start - 32), dto.start),
        suffix: text.slice(dto.end, dto.end + 32),
      },
    });
  }

  async note(userId: string, id: string, note: string) {
    const { count } = await this.prisma.annotation.updateMany({
      where: { id, userId },
      data: { note },
    });
    if (!count) throw new NotFoundException('Note not found');
  }

  async deleteNote(userId: string, id: string) {
    const { count } = await this.prisma.annotation.deleteMany({
      where: { id, userId },
    });
    if (!count) throw new NotFoundException('Note not found');
  }
}
