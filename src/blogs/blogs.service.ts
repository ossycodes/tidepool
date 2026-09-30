import { normalizeKeywords } from '../digest/keywords.js';
import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { normalizeUrl } from '../common/url.js';
import { FetchMode } from '../generated/prisma/client.js';
import { escapeHtml } from '../mail/templates.js';
import {
  DiscoveryError,
  DiscoveryService,
  type DiscoveredBlog,
} from '../feeds/discovery.service.js';
import { IngestService } from '../feeds/ingest.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  latestPostFirst,
  toBlogResponse,
  toPostResponse,
} from './blog.response.js';
import type { UpdateBlogDto } from './dto.js';

const MAX_SUBSCRIPTIONS = 500;
/** Blogs discovered at once within one import batch. */
const IMPORT_CONCURRENCY = 5;

export type ImportResult =
  | {
      url: string;
      status: 'followed' | 'already';
      blog: ReturnType<typeof toBlogResponse>;
    }
  | { url: string; status: 'failed'; error: string };
/** An unfollowed blog is re-baselined if nobody has fetched it for this long. */
const STALE_AFTER_MS = 24 * 60 * 60_000;

@Injectable()
export class BlogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly discovery: DiscoveryService,
    private readonly ingest: IngestService,
  ) {}

  async list(userId: string) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        blog: {
          include: { posts: { orderBy: [...latestPostFirst], take: 1 } },
        },
      },
    });
    return subscriptions.map((s) => toBlogResponse(s.blog, s, s.blog.posts[0]));
  }

  async get(userId: string, blogId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId_blogId: { userId, blogId } },
      include: {
        blog: {
          include: { posts: { orderBy: [...latestPostFirst], take: 1 } },
        },
      },
    });
    if (!subscription) throw new NotFoundException('Blog not found');
    return toBlogResponse(
      subscription.blog,
      subscription,
      subscription.blog.posts[0],
    );
  }

  /** Per-reader settings: a custom name, and pausing the blog in digests. */
  async update(userId: string, blogId: string, dto: UpdateBlogDto) {
    const data: {
      customTitle?: string | null;
      paused?: boolean;
      includeKeywords?: string[];
      excludeKeywords?: string[];
    } = {};
    if (dto.title !== undefined) {
      // Blank or null restores the blog's own title.
      data.customTitle = dto.title?.trim() || null;
    }
    if (dto.paused !== undefined) data.paused = dto.paused;
    if (dto.includeKeywords) {
      data.includeKeywords = normalizeKeywords(dto.includeKeywords);
    }
    if (dto.excludeKeywords) {
      data.excludeKeywords = normalizeKeywords(dto.excludeKeywords);
    }

    const { count } = await this.prisma.subscription.updateMany({
      where: { userId, blogId },
      data,
    });
    if (count === 0) throw new NotFoundException('Blog not found');
    return this.get(userId, blogId);
  }

  async subscribe(userId: string, rawUrl: string) {
    let url: string;
    try {
      url = normalizeUrl(rawUrl);
    } catch {
      throw new BadRequestException("That doesn't look like a valid URL");
    }

    const count = await this.prisma.subscription.count({ where: { userId } });
    if (count >= MAX_SUBSCRIPTIONS) {
      throw new BadRequestException(
        `You can follow up to ${MAX_SUBSCRIPTIONS} blogs`,
      );
    }

    let blog = await this.prisma.blog.findFirst({
      where: { OR: [{ sourceUrl: url }, { siteUrl: url }] },
    });
    if (!blog) {
      let found: DiscoveredBlog;
      try {
        found = await this.discovery.discover(url);
      } catch (err) {
        if (err instanceof DiscoveryError) {
          throw new UnprocessableEntityException(err.message);
        }
        throw err;
      }
      blog = await this.prisma.blog.upsert({
        where: { sourceUrl: found.sourceUrl },
        // Discovery just looked for a feed; the next check is a week out.
        create: {
          ...found,
          feedCheckedAt:
            found.fetchMode === FetchMode.SCRAPE ? new Date() : null,
        },
        update: {},
      });
    }

    // Establish the baseline so existing posts don't land in the next digest.
    // A blog nobody followed for a while is re-baselined for the same reason.
    const followers = await this.prisma.subscription.count({
      where: { blogId: blog.id },
    });
    const stale =
      !blog.lastFetchedAt ||
      Date.now() - blog.lastFetchedAt.getTime() > STALE_AFTER_MS;
    if (!blog.lastFetchedAt || (stale && followers === 0)) {
      await this.ingest.refresh(blog.id, { backfill: true });
    }

    await this.prisma.subscription.upsert({
      where: { userId_blogId: { userId, blogId: blog.id } },
      create: { userId, blogId: blog.id },
      update: {},
    });
    return this.get(userId, blog.id);
  }

  /** Follows several blogs, reporting each URL's outcome instead of failing the batch. */
  async subscribeMany(userId: string, urls: string[]): Promise<ImportResult[]> {
    const before = new Set(
      (
        await this.prisma.subscription.findMany({
          where: { userId },
          select: { blogId: true },
        })
      ).map((s) => s.blogId),
    );

    const results: ImportResult[] = [];
    let next = 0;
    const worker = async () => {
      while (next < urls.length) {
        const i = next++;
        const url = urls[i];
        try {
          const blog = await this.subscribe(userId, url);
          results[i] = {
            url,
            status: before.has(blog.id) ? 'already' : 'followed',
            blog,
          };
          before.add(blog.id);
        } catch (err) {
          results[i] = {
            url,
            status: 'failed',
            error:
              err instanceof HttpException
                ? err.message
                : 'Something went wrong. Please try again.',
          };
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(IMPORT_CONCURRENCY, urls.length) }, worker),
    );
    return results;
  }

  /** OPML 2.0 of the reader's blogs, using their own names for them. */
  async exportOpml(userId: string): Promise<string> {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { blog: true },
    });
    const outlines = subscriptions.map(({ blog, customTitle }) => {
      const title = escapeHtml(customTitle ?? blog.title);
      const site = escapeHtml(blog.siteUrl);
      // Scraped blogs have no feed, so they're exported as plain links.
      return blog.fetchMode === FetchMode.FEED
        ? `    <outline type="rss" text="${title}" title="${title}" xmlUrl="${escapeHtml(blog.sourceUrl)}" htmlUrl="${site}"/>`
        : `    <outline type="link" text="${title}" title="${title}" url="${site}" htmlUrl="${site}"/>`;
    });
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<opml version="2.0">',
      '  <head>',
      '    <title>Tidepool reading list</title>',
      `    <dateCreated>${new Date().toUTCString()}</dateCreated>`,
      '  </head>',
      '  <body>',
      ...outlines,
      '  </body>',
      '</opml>',
      '',
    ].join('\n');
  }

  async unsubscribe(userId: string, blogId: string): Promise<void> {
    const { count } = await this.prisma.subscription.deleteMany({
      where: { userId, blogId },
    });
    if (count === 0) throw new NotFoundException('Blog not found');
  }

  async posts(userId: string, blogId: string, limit: number) {
    await this.get(userId, blogId);
    const posts = await this.prisma.post.findMany({
      where: { blogId },
      orderBy: [...latestPostFirst],
      take: limit,
    });
    return posts.map(toPostResponse);
  }
}
