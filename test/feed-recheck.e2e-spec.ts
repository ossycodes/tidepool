import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { IngestService } from '../src/feeds/ingest.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  createTestApp,
  signIn,
  type FakeHttpClient,
  type FakeMailService,
} from './helpers.js';

const page = (feedHref?: string) => `<html><head><title>Watched Blog</title>
${feedHref ? `<link rel="alternate" type="application/rss+xml" href="${feedHref}">` : ''}
</head><body>
<h2><a href="/a">First article</a></h2><h2><a href="/b">Second article</a></h2>
<h2><a href="/c">Third article</a></h2></body></html>`;

const rss = (site: string, slugs: string[]) => `<?xml version="1.0"?>
<rss version="2.0"><channel><title>The Feed</title><link>${site}</link>
${slugs.map((s) => `<item><title>Post ${s}</title><link>${site}${s}</link></item>`).join('\n')}
</channel></rss>`;

const WEEK_AGO = () => new Date(Date.now() - 8 * 24 * 60 * 60_000);

// Requires `docker compose up -d` (Postgres + Redis from .env).
describe('Re-checking scraped blogs for feeds (e2e)', () => {
  let app: INestApplication<App>;
  let mail: FakeMailService;
  let http: FakeHttpClient;
  let prisma: PrismaService;
  let ingest: IngestService;

  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  beforeAll(async () => {
    ({ app, mail, http } = await createTestApp());
    prisma = app.get(PrismaService);
    ingest = app.get(IngestService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function follow(auth: { Authorization: string }, url: string) {
    const res = await request(app.getHttpServer())
      .post('/blogs')
      .set(auth)
      .send({ url })
      .expect(201);
    return res.body as { id: string; fetchMode: string };
  }

  it('switches to a feed that appeared, without flooding the next digest', async () => {
    const site = `https://watched-${run}.test/`;
    http.pages.set(site, page());
    const auth = {
      Authorization: `Bearer ${(await signIn(app, mail)).accessToken}`,
    };
    const blog = await follow(auth, site);
    expect(blog.fetchMode).toBe('SCRAPE');
    await request(app.getHttpServer())
      .patch(`/blogs/${blog.id}`)
      .set(auth)
      .send({ title: 'My name for it' })
      .expect(200);

    // Checked at follow time, so the next refresh doesn't look again.
    const created = await prisma.blog.findUniqueOrThrow({
      where: { id: blog.id },
    });
    expect(created.feedCheckedAt).not.toBeNull();

    // A week later the site has added a feed with its archive in it.
    await prisma.blog.update({
      where: { id: blog.id },
      data: { feedCheckedAt: WEEK_AGO() },
    });
    http.pages.set(site, page('/feed.xml'));
    http.pages.set(`${site}feed.xml`, rss(site, ['a', 'old-1', 'old-2']));
    expect(await ingest.refresh(blog.id)).toMatchObject({ ok: true });

    const switched = await prisma.blog.findUniqueOrThrow({
      where: { id: blog.id },
    });
    expect(switched.fetchMode).toBe('FEED');
    expect(switched.sourceUrl).toBe(`${site}feed.xml`);

    const preview = await request(app.getHttpServer())
      .get('/digests/preview')
      .set(auth)
      .expect(200);
    expect(preview.body.sections).toEqual([]);

    const mine = await request(app.getHttpServer())
      .get(`/blogs/${blog.id}`)
      .set(auth)
      .expect(200);
    expect(mine.body.title).toBe('My name for it');

    // From now on, new feed items reach the digest as usual.
    http.pages.set(
      `${site}feed.xml`,
      rss(site, ['a', 'old-1', 'old-2', 'new-1']),
    );
    await ingest.refresh(blog.id);
    const next = await request(app.getHttpServer())
      .get('/digests/preview')
      .set(auth)
      .expect(200);
    expect(
      next.body.sections[0].posts.map((p: { title: string }) => p.title),
    ).toEqual(['Post new-1']);
  });

  it('merges into a blog that already follows that feed', async () => {
    const site = `https://merge-${run}.test/`;
    // An address discovery can't guess, so the page must link it.
    const feed = `${site}posts.rss`;
    http.pages.set(site, page());
    http.pages.set(feed, rss(site, ['x', 'y']));

    const reader = {
      Authorization: `Bearer ${(await signIn(app, mail)).accessToken}`,
    };
    const both = {
      Authorization: `Bearer ${(await signIn(app, mail)).accessToken}`,
    };
    const scraped = await follow(reader, site);
    await follow(both, site);
    const feedBlog = await follow(both, feed);
    expect(scraped.fetchMode).toBe('SCRAPE');
    expect(feedBlog.fetchMode).toBe('FEED');

    await prisma.blog.update({
      where: { id: scraped.id },
      data: { feedCheckedAt: WEEK_AGO() },
    });
    http.pages.set(site, page('/posts.rss'));
    await ingest.refresh(scraped.id);

    expect(
      await prisma.blog.findUnique({ where: { id: scraped.id } }),
    ).toBeNull();
    const readerBlogs = await request(app.getHttpServer())
      .get('/blogs')
      .set(reader)
      .expect(200);
    expect(readerBlogs.body.map((b: { id: string }) => b.id)).toEqual([
      feedBlog.id,
    ]);
    const bothBlogs = await request(app.getHttpServer())
      .get('/blogs')
      .set(both)
      .expect(200);
    expect(bothBlogs.body.map((b: { id: string }) => b.id)).toEqual([
      feedBlog.id,
    ]);
  });

  it('only looks again after a week when no feed turned up', async () => {
    const site = `https://nofeed-${run}.test/`;
    http.pages.set(site, page());
    const auth = {
      Authorization: `Bearer ${(await signIn(app, mail)).accessToken}`,
    };
    const blog = await follow(auth, site);
    await prisma.blog.update({
      where: { id: blog.id },
      data: { feedCheckedAt: WEEK_AGO() },
    });

    await ingest.refresh(blog.id);
    const checked = await prisma.blog.findUniqueOrThrow({
      where: { id: blog.id },
    });
    expect(checked.fetchMode).toBe('SCRAPE');
    expect(Date.now() - checked.feedCheckedAt!.getTime()).toBeLessThan(60_000);
  });
  it('keeps saved article IDs when a scraped source merges into an existing feed', async () => {
    const site = `https://saved-merge-${run}.test/`;
    const feed = `${site}posts.rss`;
    http.pages.set(site, page());
    http.pages.set(feed, rss(site, ['x', 'y']));
    const reader = {
      Authorization: `Bearer ${(await signIn(app, mail)).accessToken}`,
    };
    const scraped = await follow(reader, site);
    const target = await follow(reader, feed);
    const post = await prisma.post.findFirstOrThrow({
      where: { blogId: scraped.id },
    });
    await request(app.getHttpServer())
      .patch(`/library/posts/${post.id}`)
      .set(reader)
      .send({ saved: true })
      .expect(200);
    await prisma.blog.update({
      where: { id: scraped.id },
      data: { feedCheckedAt: WEEK_AGO() },
    });
    http.pages.set(site, page('/posts.rss'));
    await ingest.refresh(scraped.id);
    expect(
      await prisma.blog.findUnique({ where: { id: scraped.id } }),
    ).not.toBeNull();
    expect(
      await prisma.subscription.count({ where: { blogId: scraped.id } }),
    ).toBe(0);
    await request(app.getHttpServer())
      .get(`/library/posts/${post.id}`)
      .set(reader)
      .expect(200);
    const blogs = await request(app.getHttpServer())
      .get('/blogs')
      .set(reader)
      .expect(200);
    expect(blogs.body.map((b: { id: string }) => b.id)).toEqual([target.id]);
  });
});
