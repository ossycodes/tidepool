import type { Blog, Post } from '../generated/prisma/client.js';

/** Failures before a blog is reported as unhealthy to the user. */
const UNHEALTHY_AFTER_FAILURES = 3;

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
  subscribedAt: Date,
  latestPost?: Post,
) {
  return {
    id: blog.id,
    title: blog.title,
    description: blog.description,
    siteUrl: blog.siteUrl,
    sourceUrl: blog.sourceUrl,
    fetchMode: blog.fetchMode,
    subscribedAt,
    lastFetchedAt: blog.lastFetchedAt,
    healthy: blog.consecutiveFailures < UNHEALTHY_AFTER_FAILURES,
    lastError: blog.consecutiveFailures ? blog.lastError : null,
    latestPost: latestPost ? toPostResponse(latestPost) : null,
  };
}
