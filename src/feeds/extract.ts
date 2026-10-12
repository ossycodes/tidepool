import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import { normalizeUrl, sameSite } from '../common/url.js';

export type FeedKind = 'xml' | 'json';

export interface ExtractedPost {
  url: string;
  title: string;
  summary?: string;
  feedContent?: string;
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

// An "&" that doesn't start a character or entity reference, e.g.
// title="Cinnamon Buns & Commit Bits". Invalid XML, but common in real feeds.
const BARE_AMPERSAND = /&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#x[0-9a-fA-F]+);)/g;
const CDATA = /(<!\[CDATA\[[\s\S]*?\]\]>)/;

/** Escapes bare ampersands outside CDATA so the strict XML parser accepts the feed. */
export function repairXml(xml: string): string {
  return xml
    .split(CDATA)
    .map((part, i) =>
      i % 2 === 1 ? part : part.replace(BARE_AMPERSAND, '&amp;'),
    )
    .join('');
}

// sax's loose mode upper-cases names, so normalise them back for rss-parser.
const LENIENT_XML = {
  strict: false,
  normalizeTags: true,
  attrNameProcessors: [(name: string) => name.toLowerCase()],
};

/**
 * Strict parse first; if the feed is malformed in ways repairXml can't fix
 * (e.g. title="How to "Sustain Heroku""), retry in loose mode like browsers
 * and feed readers do. A fresh parser each time: a shared one keeps state from
 * a failed parse and makes the next result depend on what came before.
 */
async function parseXmlFeed(body: string) {
  const xml = repairXml(body);
  try {
    return await new Parser().parseString(xml);
  } catch (strictError) {
    try {
      return await new Parser({ xml2js: LENIENT_XML }).parseString(xml);
    } catch {
      throw strictError;
    }
  }
}

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

  const feed = await parseXmlFeed(body);
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
      // contentSnippet is already plain text, but Atom <summary type="html">
      // arrives as markup when there is no <content> to derive a snippet from.
      summary: clean(
        item.contentSnippet ?? htmlToText(item.summary),
        SUMMARY_LENGTH,
      ),
      ...(typeof (item['content:encoded'] ?? item.content) === 'string'
        ? {
            feedContent: (item['content:encoded'] ?? item.content).slice(
              0,
              2_000_000,
            ),
          }
        : {}),
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
      item.summary ?? item.content_text ?? htmlToText(item.content_html);
    return {
      url,
      title: clean(item.title, 300) ?? clean(text, 80) ?? url,
      summary: clean(text, SUMMARY_LENGTH),
      ...(item.content_html
        ? { feedContent: item.content_html.slice(0, 2_000_000) }
        : item.content_text
          ? {
              feedContent:
                '<p>' +
                item.content_text
                  .slice(0, 2_000_000)
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/\n\n/g, '</p><p>') +
                '</p>',
            }
          : {}),
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

/**
 * A bot check served instead of the site: SiteGround-style "One moment,
 * please..." pages and Cloudflare's "Just a moment..." interstitial. Matches
 * only markers unique to the challenge; Cloudflare also injects scripts into
 * ordinary pages, so those aren't used.
 */
export function isChallengePage(html: string): boolean {
  const head = html.slice(0, 20_000);
  return (
    /<title>\s*(One moment, please|Just a moment)\.{0,3}\s*<\/title>/i.test(
      head,
    ) || /\bwsidchk\b|window\._cf_chl_opt/.test(head)
  );
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

      // A link wrapping a whole card (date, byline, heading, blurb) would make
      // all of that the title; the heading inside it is the real one, and a
      // paragraph next to it is the summary.
      const heading = anchor.find('h1, h2, h3, h4, h5, h6').first();
      const title =
        (heading.length ? clean(heading.text(), 300) : undefined) ??
        clean(anchor.text(), 300) ??
        clean(anchor.attr('title'), 300);
      if (!title || title.length < 4) return;
      const summary = heading.length
        ? clean(anchor.find('p').first().text(), SUMMARY_LENGTH)
        : undefined;

      const normalized = normalizeUrl(url.toString());
      if (!found.has(normalized))
        found.set(normalized, {
          url: normalized,
          title,
          ...(summary ? { summary } : {}),
        });
    });
    return [...found.values()];
  };

  const selectors = [
    'article h1 a[href], article h2 a[href], article h3 a[href], h2 a[href], h3 a[href], a[href]:has(h2), a[href]:has(h3), a[href]:has(h4), a[href]:has(h5), a[href]:has(h6)',
    'article a[href], main a[href]',
  ];
  for (const selector of selectors) {
    const posts = collect(selector);
    if (posts.length >= 3) return posts.slice(0, MAX_POSTS);
  }
  return collect('a[href]').slice(0, MAX_POSTS);
}

/**
 * Feed fields are usually strings, but not always: blog.google puts a
 * structured Atom author inside RSS items (`<author><name>…</name><title>…`),
 * which the parser hands back as an object. Take the name (or text) from it.
 */
function textOf(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return textOf(value[0]);
  if (value && typeof value === 'object') {
    const fields = value as Record<string, unknown>;
    return textOf(fields.name ?? fields._ ?? fields['#text']);
  }
  return undefined;
}

function clean(value: unknown, max: number): string | undefined {
  const text = textOf(value);
  if (!text) return undefined;
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (!collapsed) return undefined;
  return collapsed.length > max
    ? `${collapsed.slice(0, max - 1).trimEnd()}…`
    : collapsed;
}

function htmlToText(html: string | undefined): string | undefined {
  return html ? cheerio.load(html).text() : undefined;
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
