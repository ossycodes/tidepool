import { Injectable } from '@nestjs/common';
import { FetchMode } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Public numbers are cheap to be a little stale, and this endpoint is unauthenticated. */
const CACHE_MS = 5 * 60_000;
const WEEK_MS = 7 * 24 * 60 * 60_000;
const TOP_BLOGS = 10;
/** A blog only appears in the public list once this many readers follow it. */
const MIN_FOLLOWERS_TO_LIST = 2;

export interface PublicStats {
  readers: number;
  activeReaders: number;
  newReadersThisWeek: number;
  follows: number;
  blogsPerReader: number;
  blogs: number;
  watchedPages: number;
  postsThisWeek: number;
  digestsSent: number;
  digestsThisWeek: number;
  lastDigestAt: Date | null;
  topBlogs: { title: string; siteUrl: string; followers: number }[];
  generatedAt: Date;
}

@Injectable()
export class StatsService {
  private cache: { value: PublicStats; expires: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async get(now = new Date()): Promise<PublicStats> {
    if (this.cache && this.cache.expires > now.getTime()) {
      return this.cache.value;
    }
    const value = await this.compute(now);
    this.cache = { value, expires: now.getTime() + CACHE_MS };
    return value;
  }

  private async compute(now: Date): Promise<PublicStats> {
    const weekAgo = new Date(now.getTime() - WEEK_MS);
    const followed = { subscriptions: { some: {} } };

    const [
      readers,
      readersFollowingSomething,
      activeReaders,
      newReadersThisWeek,
      follows,
      blogs,
      watchedPages,
      postsThisWeek,
      digestsSent,
      digestsThisWeek,
      lastDigest,
      popular,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: followed }),
      this.prisma.user.count({ where: { digestEnabled: true, ...followed } }),
      this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.subscription.count(),
      this.prisma.blog.count({ where: followed }),
      this.prisma.blog.count({
        where: { fetchMode: FetchMode.SCRAPE, ...followed },
      }),
      this.prisma.post.count({
        where: { backfill: false, discoveredAt: { gte: weekAgo } },
      }),
      this.prisma.digest.count(),
      this.prisma.digest.count({ where: { sentAt: { gte: weekAgo } } }),
      this.prisma.digest.findFirst({
        orderBy: { sentAt: 'desc' },
        select: { sentAt: true },
      }),
      this.prisma.blog.findMany({
        where: followed,
        select: {
          title: true,
          siteUrl: true,
          _count: { select: { subscriptions: true } },
        },
        orderBy: [{ subscriptions: { _count: 'desc' } }, { title: 'asc' }],
        take: TOP_BLOGS,
      }),
    ]);

    return {
      readers,
      activeReaders,
      newReadersThisWeek,
      follows,
      blogsPerReader: readersFollowingSomething
        ? Math.round((follows / readersFollowingSomething) * 10) / 10
        : 0,
      blogs,
      watchedPages,
      postsThisWeek,
      digestsSent,
      digestsThisWeek,
      lastDigestAt: lastDigest?.sentAt ?? null,
      topBlogs: popular
        .filter((b) => b._count.subscriptions >= MIN_FOLLOWERS_TO_LIST)
        .map((b) => ({
          title: b.title,
          siteUrl: b.siteUrl,
          followers: b._count.subscriptions,
        })),
      generatedAt: now,
    };
  }
}
