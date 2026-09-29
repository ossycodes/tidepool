import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { normalizeUrl } from '../common/url.js';
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

const MAX_SUBSCRIPTIONS = 500;
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
    return subscriptions.map((s) =>
      toBlogResponse(s.blog, s.createdAt, s.blog.posts[0]),
    );
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
      subscription.createdAt,
      subscription.blog.posts[0],
    );
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
        create: found,
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
