import type { Blog, Post } from '../generated/prisma/client.js';

/** Failures before a blog is reported as unhealthy to the user. */
const UNHEALTHY_AFTER_FAILURES = 3;

/** Prisma orderBy for newest posts first; scraped posts have no publishedAt. */
export const latestPostFirst = [
  { publishedAt: { sort: 'desc', nulls: 'last' } },
  { discoveredAt: 'desc' },
] as const;

export function toPostResponse(post: Post) {
  return {
    id: post.id,
    url: post.url,
    title: post.title,
    summary: post.summary,
    author: post.author,
    publishedAt: post.publishedAt,
    discoveredAt: post.discoveredAt,
  };
}

export function toBlogResponse(
  blog: Blog,
  subscription: {
    createdAt: Date;
    customTitle: string | null;
    paused: boolean;
  },
  latestPost?: Post,
) {
  return {
    id: blog.id,
    /** What this reader sees: their own name for the blog, if they set one */
    title: subscription.customTitle ?? blog.title,
    originalTitle: blog.title,
    customTitle: subscription.customTitle,
    paused: subscription.paused,
    description: blog.description,
    siteUrl: blog.siteUrl,
    sourceUrl: blog.sourceUrl,
    fetchMode: blog.fetchMode,
    subscribedAt: subscription.createdAt,
    lastFetchedAt: blog.lastFetchedAt,
    healthy: blog.consecutiveFailures < UNHEALTHY_AFTER_FAILURES,
    lastError: blog.consecutiveFailures ? blog.lastError : null,
    latestPost: latestPost ? toPostResponse(latestPost) : null,
  };
}
