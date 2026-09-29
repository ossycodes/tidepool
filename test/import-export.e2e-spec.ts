import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  createTestApp,
  signIn,
  type FakeHttpClient,
  type FakeMailService,
} from './helpers.js';

const rss = (site: string, title: string) => `<?xml version="1.0"?>
<rss version="2.0"><channel><title>${title}</title><link>${site}</link>
<item><title>Post</title><link>${site}post</link></item>
</channel></rss>`;

// Requires `docker compose up -d` (Postgres + Redis from .env).
describe('Batch follow and OPML export (e2e)', () => {
  let app: INestApplication<App>;
  let mail: FakeMailService;
  let http: FakeHttpClient;
  let auth: { Authorization: string };

  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const one = `https://one-${run}.test/`;
  const two = `https://two-${run}.test/`;
  const page = `https://page-${run}.test/`;

  beforeAll(async () => {
    ({ app, mail, http } = await createTestApp());
    auth = { Authorization: `Bearer ${(await signIn(app, mail)).accessToken}` };
    http.pages.set(`${one}feed.xml`, rss(one, 'Tom & Jerry'));
    http.pages.set(`${two}feed.xml`, rss(two, 'Two'));
    http.pages.set(
      page,
      `<html><head><title>No feed</title></head><body>
        <h2><a href="/a">First article</a></h2><h2><a href="/b">Second article</a></h2>
        <h2><a href="/c">Third article</a></h2></body></html>`,
    );
    await request(app.getHttpServer())
      .post('/blogs')
      .set(auth)
      .send({ url: `${two}feed.xml` })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports each URL separately without failing the batch', async () => {
    const res = await request(app.getHttpServer())
      .post('/blogs/batch')
      .set(auth)
      .send({
        urls: [
          `${one}feed.xml`,
          `${two}feed.xml`,
          page,
          `https://missing-${run}.test/`,
          'not a url',
        ],
      })
      .expect(200);

    expect(res.body.map((r: { status: string }) => r.status)).toEqual([
      'followed',
      'already',
      'followed',
      'failed',
      'failed',
    ]);
    expect(res.body[0].blog.title).toBe('Tom & Jerry');
    expect(res.body[3].error).toMatch(/Couldn't load/);
    expect(res.body[4].error).toMatch(/valid URL/);
  });

  it('rejects oversized batches', async () => {
    const urls = Array.from({ length: 11 }, (_, i) => `https://x${i}.test/`);
    await request(app.getHttpServer())
      .post('/blogs/batch')
      .set(auth)
      .send({ urls })
      .expect(400);
  });

  it('exports OPML with custom names, feeds and scraped pages', async () => {
    const list = await request(app.getHttpServer()).get('/blogs').set(auth);
    const twoId = list.body.find(
      (b: { title: string }) => b.title === 'Two',
    ).id;
    await request(app.getHttpServer())
      .patch(`/blogs/${twoId}`)
      .set(auth)
      .send({ title: 'Second "Blog"' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/blogs/export.opml')
      .set(auth)
      .expect(200);
    expect(res.headers['content-type']).toContain('text/x-opml');
    expect(res.headers['content-disposition']).toContain('tidepool.opml');
    expect(res.text).toContain('<opml version="2.0">');
    expect(res.text).toContain(
      `<outline type="rss" text="Tom &amp; Jerry" title="Tom &amp; Jerry" xmlUrl="${one}feed.xml"`,
    );
    expect(res.text).toContain('title="Second &quot;Blog&quot;"');
    expect(res.text).toContain(`<outline type="link" text="No feed"`);
  });
});
