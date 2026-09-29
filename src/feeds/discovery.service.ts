import { Injectable } from '@nestjs/common';
import {
  ACCEPT_FEED,
  ACCEPT_HTML,
  HttpClient,
} from '../common/http-client.js';
import { normalizeUrl } from '../common/url.js';
import type { FetchResult } from '../common/safe-fetch.js';
import { FetchMode } from '../generated/prisma/client.js';
import {
  detectFeed,
  extractArticleLinks,
  findFeedLinks,
  pageMeta,
  parseFeed,
  type ParsedFeed,
} from './extract.js';

export interface DiscoveredBlog {
  fetchMode: FetchMode;
  /** What we poll: the feed URL, or the page itself in SCRAPE mode */
  sourceUrl: string;
  siteUrl: string;
  title: string;
  description?: string;
}

/** User-facing reason we couldn't add a blog. */
export class DiscoveryError extends Error {}

const COMMON_FEED_PATHS = [
  'feed',
  'rss.xml',
  'feed.xml',
  'atom.xml',
  'index.xml',
  'rss',
];

@Injectable()
export class DiscoveryService {
  constructor(private readonly http: HttpClient) {}

  async discover(url: string): Promise<DiscoveredBlog> {
    let page: FetchResult;
    try {
      page = await this.http.get(url, ACCEPT_HTML);
    } catch (err) {
      throw new DiscoveryError(
        `Couldn't load ${url}: ${(err as Error).message}`,
      );
    }

    // The user may have pasted a feed URL directly.
    const kind = detectFeed(page.body);
    if (kind) {
      const feed = await parseFeed(page.body, kind, page.url).catch(() => null);
      if (feed) {
        const siteUrl = feed.siteUrl ?? normalizeUrl(new URL(page.url).origin);
        return {
          fetchMode: FetchMode.FEED,
          sourceUrl: page.url,
          siteUrl,
          title: feed.title ?? new URL(siteUrl).hostname,
          description: feed.description,
        };
      }
    }

    const meta = pageMeta(page.body);
    const siteUrl = normalizeUrl(page.url);
    const fallbackTitle = meta.title ?? new URL(page.url).hostname;

    const found =
      (await this.firstFeed(findFeedLinks(page.body, page.url))) ??
      (await this.guessFeed(page.url));
    if (found) {
      return {
        fetchMode: FetchMode.FEED,
        sourceUrl: found.url,
        siteUrl,
        title: meta.title ?? found.feed.title ?? fallbackTitle,
        description: meta.description ?? found.feed.description,
      };
    }

    if (extractArticleLinks(page.body, page.url).length === 0) {
      throw new DiscoveryError(
        "Couldn't find a feed or any posts on that page",
      );
    }
    return {
      fetchMode: FetchMode.SCRAPE,
      sourceUrl: page.url,
      siteUrl,
      title: fallbackTitle,
      description: meta.description,
    };
  }

  /** Advertised feeds, tried in page order. */
  private async firstFeed(candidates: string[]) {
    for (const candidate of candidates.slice(0, 5)) {
      const found = await this.tryFeed(candidate);
      if (found) return found;
    }
    return null;
  }

  /** Common feed locations under the page path and the site root, in parallel. */
  private async guessFeed(pageUrl: string) {
    const page = new URL(pageUrl);
    const bases = new Set([
      `${page.origin}${page.pathname.replace(/\/*$/, '/')}`,
      `${page.origin}/`,
    ]);
    const candidates = [
      ...new Set(
        [...bases].flatMap((base) =>
          COMMON_FEED_PATHS.map((path) => new URL(path, base).toString()),
        ),
      ),
    ];
    const results = await Promise.all(candidates.map((c) => this.tryFeed(c)));
    return results.find((r) => r !== null) ?? null;
  }

  private async tryFeed(
    url: string,
  ): Promise<{ url: string; feed: ParsedFeed } | null> {
    try {
      const res = await this.http.get(url, ACCEPT_FEED);
      const kind = detectFeed(res.body);
      if (!kind) return null;
      const feed = await parseFeed(res.body, kind, res.url);
      return { url: res.url, feed };
    } catch {
      return null;
    }
  }
}
