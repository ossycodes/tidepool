import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import { normalizeUrl, sameSite } from '../common/url.js';

export type FeedKind = 'xml' | 'json';

export interface ExtractedPost {
  url: string;
  title: string;
  summary?: string;
  author?: string;
  publishedAt?: Date;
}

export interface ParsedFeed {
  title?: string;
  description?: string;
  siteUrl?: string;
  posts: ExtractedPost[];
}

const MAX_POSTS = 100;
const SUMMARY_LENGTH = 280;

const FEED_LINK_TYPES = new Set([
  'application/rss+xml',
  'application/atom+xml',
  'application/rdf+xml',
  'application/feed+json',
  'application/json',
]);

// Paths that are almost never individual posts when scraping a page.
const NON_ARTICLE_PATH =
  /\/(tags?|categor(y|ies)|topics?|page|authors?|about|contact|search|log-?in|sign-?in|sign-?up|register|subscribe|feed|rss|privacy|terms|archives?|newsletter|cart|account)(\/|$)/i;
const ASSET_PATH =
  /\.(png|jpe?g|gif|svg|webp|avif|ico|pdf|zip|xml|json|css|js|mp3|mp4|webm)$/i;

const rssParser = new Parser();

export function detectFeed(body: string): FeedKind | null {
  const head = body.trimStart().slice(0, 2000);
  if (head.startsWith('{')) {
    return /jsonfeed\.org\/version/i.test(head) ? 'json' : null;
  }
  if (/<(rss|feed|rdf:RDF)[\s>]/i.test(head) && !/<html[\s>]/i.test(head)) {
    return 'xml';
  }
  return null;
}

export async function parseFeed(
  body: string,
  kind: FeedKind,
  feedUrl: string,
): Promise<ParsedFeed> {
  if (kind === 'json') return parseJsonFeed(body, feedUrl);

  const feed = await rssParser.parseString(body);
  const siteUrl = resolveUrl(feed.link, feedUrl);
  const posts = feed.items.map((item) => {
    const url = resolveUrl(
      item.link ?? (looksLikeUrl(item.guid) ? item.guid : undefined),
      siteUrl ?? feedUrl,
    );
    if (!url) return null;
    return {
      url,
      title: clean(item.title, 300) ?? url,
      summary: clean(item.contentSnippet ?? item.summary, SUMMARY_LENGTH),
      author: clean(item.creator, 200),
      publishedAt: toDate(item.isoDate ?? item.pubDate),
    };
  });

  return {
    title: clean(feed.title, 200),
    description: clean(feed.description, 500),
    siteUrl,
    posts: uniquePosts(posts),
  };
}

interface JsonFeed {
  title?: string;
  description?: string;
  home_page_url?: string;
  items?: {
    url?: string;
    external_url?: string;
    title?: string;
    summary?: string;
    content_text?: string;
    content_html?: string;
    date_published?: string;
    authors?: { name?: string }[];
    author?: { name?: string };
  }[];
}

function parseJsonFeed(body: string, feedUrl: string): ParsedFeed {
  let data: JsonFeed;
  try {
    data = JSON.parse(body) as JsonFeed;
  } catch {
    throw new Error('Invalid JSON Feed');
  }
  const siteUrl = resolveUrl(data.home_page_url, feedUrl);
  const posts = (Array.isArray(data.items) ? data.items : []).map((item) => {
    const url = resolveUrl(item.url ?? item.external_url, siteUrl ?? feedUrl);
    if (!url) return null;
    const text =
      item.summary ??
      item.content_text ??
      (item.content_html ? cheerio.load(item.content_html).text() : undefined);
    return {
      url,
      title: clean(item.title, 300) ?? clean(text, 80) ?? url,
      summary: clean(text, SUMMARY_LENGTH),
      author: clean(item.authors?.[0]?.name ?? item.author?.name, 200),
      publishedAt: toDate(item.date_published),
    };
  });

  return {
    title: clean(data.title, 200),
    description: clean(data.description, 500),
    siteUrl,
    posts: uniquePosts(posts),
  };
}

/** Feeds advertised with <link rel="alternate">, in page order. */
export function findFeedLinks(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];
  $('link[rel~="alternate"][href]').each((_, el) => {
    const type = ($(el).attr('type') ?? '').toLowerCase().split(';')[0].trim();
    if (!FEED_LINK_TYPES.has(type)) return;
    const href = $(el).attr('href')!;
    const title = $(el).attr('title') ?? '';
    if (/comments/i.test(href) || /comments/i.test(title)) return;
    try {
      links.push(new URL(href, pageUrl).toString());
    } catch {
      // ignore malformed hrefs
    }
  });
  return [...new Set(links)];
}

export function pageMeta(html: string): {
  title?: string;
  description?: string;
} {
  const $ = cheerio.load(html);
  return {
    title:
      clean($('meta[property="og:site_name"]').attr('content'), 200) ??
      clean($('title').first().text(), 200),
    description:
      clean($('meta[name="description"]').attr('content'), 500) ??
      clean($('meta[property="og:description"]').attr('content'), 500),
  };
}

/**
 * Best-effort list of post links on a blog index page, for sites without a
 * feed. Tries post-like selectors first (headings, <article>) and only falls
 * back to every same-site link if those find too little.
 */
export function extractArticleLinks(
  html: string,
  pageUrl: string,
): ExtractedPost[] {
  const $ = cheerio.load(html);
  const page = new URL(pageUrl);
  const pagePath = page.pathname.replace(/\/+$/, '');

  const collect = (selector: string) => {
    const found = new Map<string, ExtractedPost>();
    $(selector).each((_, el) => {
      const anchor = $(el);
      const href = anchor.attr('href');
      if (!href || href.startsWith('#')) return;

      let url: URL;
      try {
        url = new URL(href, page);
      } catch {
        return;
      }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
      if (!sameSite(url, page)) return;
      const path = url.pathname.replace(/\/+$/, '');
      if (!path || path === pagePath) return;
      if (NON_ARTICLE_PATH.test(url.pathname) || ASSET_PATH.test(url.pathname))
        return;

      const title =
        clean(anchor.text(), 300) ?? clean(anchor.attr('title'), 300);
      if (!title || title.length < 4) return;

      const normalized = normalizeUrl(url.toString());
      if (!found.has(normalized))
        found.set(normalized, { url: normalized, title });
    });
    return [...found.values()];
  };

  const selectors = [
    'article h1 a[href], article h2 a[href], article h3 a[href], h2 a[href], h3 a[href], a[href]:has(h2), a[href]:has(h3)',
    'article a[href], main a[href]',
  ];
  for (const selector of selectors) {
    const posts = collect(selector);
    if (posts.length >= 3) return posts.slice(0, MAX_POSTS);
  }
  return collect('a[href]').slice(0, MAX_POSTS);
}

function clean(text: string | undefined, max: number): string | undefined {
  if (!text) return undefined;
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (!collapsed) return undefined;
  return collapsed.length > max
    ? `${collapsed.slice(0, max - 1).trimEnd()}…`
    : collapsed;
}

function toDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function looksLikeUrl(value: string | undefined): boolean {
  return !!value && /^https?:\/\//i.test(value);
}

function resolveUrl(
  href: string | undefined,
  base: string,
): string | undefined {
  if (!href) return undefined;
  try {
    return normalizeUrl(new URL(href.trim(), base).toString());
  } catch {
    return undefined;
  }
}

function uniquePosts(posts: (ExtractedPost | null)[]): ExtractedPost[] {
  const byUrl = new Map<string, ExtractedPost>();
  for (const post of posts) {
    if (post && !byUrl.has(post.url)) byUrl.set(post.url, post);
  }
  return [...byUrl.values()].slice(0, MAX_POSTS);
}
