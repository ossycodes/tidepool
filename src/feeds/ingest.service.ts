import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ACCEPT_FEED, ACCEPT_HTML, HttpClient } from '../common/http-client.js';
import type { Env } from '../config/env.js';
import { FetchMode, type Blog } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DiscoveryService } from './discovery.service.js';
import {
  detectFeed,
  extractArticleLinks,
  parseFeed,
  type ExtractedPost,
} from './extract.js';

export type RefreshResult =
  { ok: true; newPosts: number } | { ok: false; error: string };

/** Failing blogs back off exponentially, capped at 2^6 intervals. */
const MAX_BACKOFF_EXPONENT = 6;
/** How often a blog we scrape is checked for a feed that appeared since. */
export const FEED_RECHECK_MS = 7 * 24 * 60 * 60_000;

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);
  private readonly intervalMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpClient,
    private readonly discovery: DiscoveryService,
    config: ConfigService<Env, true>,
  ) {
    this.intervalMs =
      config.get('FETCH_INTERVAL_MINUTES', { infer: true }) * 60_000;
  }

  /**
   * Fetches a blog and stores any posts we haven't seen. Posts found on the
   * very first fetch (or when `backfill` is set) are marked as backfill so
   * they never appear in anyone's digest.
   */
  async refresh(
    blogId: string,
    options: { backfill?: boolean } = {},
  ): Promise<RefreshResult> {
    const blog = await this.prisma.blog.findUnique({ where: { id: blogId } });
    if (!blog) return { ok: false, error: 'Blog not found' };

    const now = new Date();
    try {
      const { posts, page } = await this.fetchPosts(blog);
      const backfill = options.backfill ?? blog.lastFetchedAt === null;
      const { count } = await this.prisma.post.createMany({
        data: posts.map((post) => ({
          ...post,
          blogId,
          backfill,
          discoveredAt: now,
        })),
        skipDuplicates: true,
      });
      await this.prisma.blog.update({
        where: { id: blogId },
        data: {
          lastFetchedAt: now,
          nextFetchAt: new Date(now.getTime() + this.intervalMs),
          consecutiveFailures: 0,
          lastError: null,
        },
      });
      if (count) this.logger.log(`${blog.sourceUrl}: ${count} new posts`);
      if (page && this.feedCheckDue(blog, now)) {
        await this.switchToFeedIfFound(blog, page, now);
      }
      return { ok: true, newPosts: count };
    } catch (err) {
      const error = (err as Error).message.slice(0, 500);
      const failures = blog.consecutiveFailures + 1;
      const backoff =
        this.intervalMs * 2 ** Math.min(failures, MAX_BACKOFF_EXPONENT);
      await this.prisma.blog.update({
        where: { id: blogId },
        data: {
          consecutiveFailures: failures,
          lastError: error,
          nextFetchAt: new Date(now.getTime() + backoff),
        },
      });
      this.logger.warn(`${blog.sourceUrl} failed (${failures}x): ${error}`);
      return { ok: false, error };
    }
  }

  private feedCheckDue(blog: Blog, now: Date): boolean {
    return (
      blog.fetchMode === FetchMode.SCRAPE &&
      (!blog.feedCheckedAt ||
        now.getTime() - blog.feedCheckedAt.getTime() >= FEED_RECHECK_MS)
    );
  }

  /**
   * A blog we follow by scraping may have added a feed since. If so, switch
   * to it: the feed's current items are stored as backfill so its archive
   * doesn't flood anyone's next digest. If another blog already uses that
   * feed, its followers move over and this duplicate is removed. Never fails
   * the refresh.
   */
  private async switchToFeedIfFound(
    blog: Blog,
    page: { body: string; url: string },
    now: Date,
  ): Promise<void> {
    try {
      const found = await this.discovery.findFeed(page.body, page.url);
      if (!found) {
        await this.prisma.blog.update({
          where: { id: blog.id },
          data: { feedCheckedAt: now },
        });
        return;
      }

      const existing = await this.prisma.blog.findUnique({
        where: { sourceUrl: found.url },
      });
      if (existing && existing.id !== blog.id) {
        await this.mergeInto(blog.id, existing.id);
        this.logger.log(
          `${blog.sourceUrl}: found feed ${found.url}; merged into existing blog`,
        );
        return;
      }

      await this.prisma.blog.update({
        where: { id: blog.id },
        data: {
          fetchMode: FetchMode.FEED,
          sourceUrl: found.url,
          feedCheckedAt: now,
          description: blog.description ?? found.feed.description ?? null,
        },
      });
      await this.prisma.post.createMany({
        data: found.feed.posts.map((post) => ({
          ...post,
          blogId: blog.id,
          backfill: true,
          discoveredAt: now,
        })),
        skipDuplicates: true,
      });
      this.logger.log(`${blog.sourceUrl}: switched to its feed ${found.url}`);
    } catch (err) {
      this.logger.warn(
        `${blog.sourceUrl}: feed re-check failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Moves every follower of `fromId` to `toId`, keeping their own name,
   * pause and filters, then deletes `fromId`. Readers who already follow
   * both keep their existing subscription.
   */
  private async mergeInto(fromId: string, toId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const already = new Set(
        (
          await tx.subscription.findMany({
            where: { blogId: toId },
            select: { userId: true },
          })
        ).map((s) => s.userId),
      );
      const moving = await tx.subscription.findMany({
        where: { blogId: fromId },
        select: { id: true, userId: true },
      });
      for (const sub of moving) {
        if (already.has(sub.userId)) {
          await tx.subscription.delete({ where: { id: sub.id } });
        } else {
          await tx.subscription.update({
            where: { id: sub.id },
            data: { blogId: toId },
          });
        }
      }
      await tx.blog.delete({ where: { id: fromId } });
    });
  }

  private async fetchPosts(blog: Blog): Promise<{
    posts: ExtractedPost[];
    /** The page itself, when scraping (reused to look for a new feed) */
    page?: { body: string; url: string };
  }> {
    if (blog.fetchMode === FetchMode.FEED) {
      const res = await this.http.get(blog.sourceUrl, ACCEPT_FEED);
      const kind = detectFeed(res.body);
      if (!kind) throw new Error('Feed URL no longer returns a feed');
      return { posts: (await parseFeed(res.body, kind, res.url)).posts };
    }
    const res = await this.http.get(blog.sourceUrl, ACCEPT_HTML);
    return {
      posts: extractArticleLinks(res.body, res.url),
      page: { body: res.body, url: res.url },
    };
  }
}
