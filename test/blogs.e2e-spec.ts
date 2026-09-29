import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { FetchScheduler } from '../src/feeds/fetch.scheduler.js';
import { IngestService } from '../src/feeds/ingest.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  createTestApp,
  signIn,
  type FakeHttpClient,
  type FakeMailService,
} from './helpers.js';

const rss = (site: string, slugs: string[]) => `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Feed Blog</title><link>${site}</link>
${slugs.map((s) => `<item><title>Post ${s}</title><link>${site}posts/${s}</link></item>`).join('\n')}
</channel></rss>`;

// Requires `docker compose up -d` (Postgres + Redis from .env).
describe('Blogs (e2e)', () => {
  let app: INestApplication<App>;
  let mail: FakeMailService;
  let http: FakeHttpClient;
  let prisma: PrismaService;
  let auth: { Authorization: string };

  // Unique hosts per run so blogs from earlier runs don't dedupe against these.
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const feedSite = `https://feed-${run}.test/`;
  const scrapeSite = `https://scrape-${run}.test/`;

  beforeAll(async () => {
    ({ app, mail, http } = await createTestApp());
    prisma = app.get(PrismaService);
    auth = {
      Authorization: `Bearer ${(await signIn(app, mail)).accessToken}`,
    };

    http.pages.set(
      feedSite,
      `<html><head><title>Feed Blog</title><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head></html>`,
    );
    http.pages.set(`${feedSite}feed.xml`, rss(feedSite, ['a', 'b']));
    http.pages.set(
      scrapeSite,
      `<html><head><title>No Feed Here</title></head><body>
        <h2><a href="/2025/one">First article</a></h2>
        <h2><a href="/2025/two">Second article</a></h2>
        <h2><a href="/2025/three">Third article</a></h2>
      </body></html>`,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  let feedBlogId: string;

  it('adds a blog via its advertised feed and baselines existing posts', async () => {
    const res = await request(app.getHttpServer())
      .post('/blogs')
      .set(auth)
      .send({ url: `feed-${run}.test` })
      .expect(201);
    expect(res.body).toMatchObject({
      fetchMode: 'FEED',
      sourceUrl: `${feedSite}feed.xml`,
      siteUrl: feedSite,
      title: 'Feed Blog',
      healthy: true,
    });
    expect(res.body.latestPost).not.toBeNull();
    feedBlogId = res.body.id;

    const posts = await prisma.post.findMany({ where: { blogId: feedBlogId } });
    expect(posts).toHaveLength(2);
    expect(posts.every((p) => p.backfill)).toBe(true);
  });

  it('shares one blog between users without re-discovering it', async () => {
    const other = await signIn(app, mail);
    const before = http.requests.length;
    const res = await request(app.getHttpServer())
      .post('/blogs')
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ url: feedSite })
      .expect(201);
    expect(res.body.id).toBe(feedBlogId);
    expect(http.requests.length).toBe(before);
  });

  it('stores new posts found on refresh as digest-eligible', async () => {
    http.pages.set(`${feedSite}feed.xml`, rss(feedSite, ['a', 'b', 'c']));
    const result = await app.get(IngestService).refresh(feedBlogId);
    expect(result).toEqual({ ok: true, newPosts: 1 });

    const fresh = await prisma.post.findFirstOrThrow({
      where: { blogId: feedBlogId, url: `${feedSite}posts/c` },
    });
    expect(fresh.backfill).toBe(false);

    const list = await request(app.getHttpServer())
      .get(`/blogs/${feedBlogId}/posts?limit=2`)
      .set(auth)
      .expect(200);
    expect(list.body).toHaveLength(2);
  });

  it('records failures and backs off', async () => {
    http.pages.delete(`${feedSite}feed.xml`);
    const result = await app.get(IngestService).refresh(feedBlogId);
    expect(result.ok).toBe(false);

    const blog = await prisma.blog.findUniqueOrThrow({
      where: { id: feedBlogId },
    });
    expect(blog.consecutiveFailures).toBe(1);
    expect(blog.lastError).toMatch(/404/);
    // 60 min interval * 2^1
    expect(blog.nextFetchAt.getTime()).toBeGreaterThan(
      Date.now() + 110 * 60_000,
    );
    http.pages.set(`${feedSite}feed.xml`, rss(feedSite, ['a', 'b', 'c']));
  });

  it('queues due blogs and leases them', async () => {
    await prisma.blog.update({
      where: { id: feedBlogId },
      data: { nextFetchAt: new Date(Date.now() - 1000) },
    });
    const queued = await app.get(FetchScheduler).enqueueDueBlogs();
    expect(queued).toBeGreaterThanOrEqual(1);

    const blog = await prisma.blog.findUniqueOrThrow({
      where: { id: feedBlogId },
    });
    expect(blog.nextFetchAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('scrapes sites that have no feed', async () => {
    const res = await request(app.getHttpServer())
      .post('/blogs')
      .set(auth)
      .send({ url: scrapeSite })
      .expect(201);
    expect(res.body).toMatchObject({
      fetchMode: 'SCRAPE',
      title: 'No Feed Here',
    });

    const posts = await request(app.getHttpServer())
      .get(`/blogs/${res.body.id}/posts`)
      .set(auth)
      .expect(200);
    expect(posts.body.map((p: { title: string }) => p.title).sort()).toEqual([
      'First article',
      'Second article',
      'Third article',
    ]);
  });

  it('rejects invalid and unreachable URLs', async () => {
    await request(app.getHttpServer())
      .post('/blogs')
      .set(auth)
      .send({ url: 'not a url' })
      .expect(400);
    const res = await request(app.getHttpServer())
      .post('/blogs')
      .set(auth)
      .send({ url: `https://missing-${run}.test/` })
      .expect(422);
    expect(res.body.message).toMatch(/Couldn't load/);
  });

  it('lists and unsubscribes', async () => {
    const list = await request(app.getHttpServer())
      .get('/blogs')
      .set(auth)
      .expect(200);
    expect(list.body.map((b: { id: string }) => b.id)).toContain(feedBlogId);

    await request(app.getHttpServer())
      .delete(`/blogs/${feedBlogId}`)
      .set(auth)
      .expect(204);
    await request(app.getHttpServer())
      .delete(`/blogs/${feedBlogId}`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/blogs/${feedBlogId}/posts`)
      .set(auth)
      .expect(404);
  });
});
