import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ACCEPT_FEED,
  ACCEPT_HTML,
  HttpClient,
} from '../common/http-client.js';
import type { Env } from '../config/env.js';
import { FetchMode, type Blog } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  detectFeed,
  extractArticleLinks,
  parseFeed,
  type ExtractedPost,
} from './extract.js';

export type RefreshResult =
  | { ok: true; newPosts: number }
  | { ok: false; error: string };

/** Failing blogs back off exponentially, capped at 2^6 intervals. */
const MAX_BACKOFF_EXPONENT = 6;

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);
  private readonly intervalMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpClient,
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
      const posts = await this.fetchPosts(blog);
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

  private async fetchPosts(blog: Blog): Promise<ExtractedPost[]> {
    if (blog.fetchMode === FetchMode.FEED) {
      const res = await this.http.get(blog.sourceUrl, ACCEPT_FEED);
      const kind = detectFeed(res.body);
      if (!kind) throw new Error('Feed URL no longer returns a feed');
      return (await parseFeed(res.body, kind, res.url)).posts;
    }
    const res = await this.http.get(blog.sourceUrl, ACCEPT_HTML);
    return extractArticleLinks(res.body, res.url);
  }
}
