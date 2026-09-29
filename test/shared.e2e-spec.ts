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
<item><title>Hello from ${title}</title><link>${site}hello</link>
<pubDate>Mon, 21 Sep 2026 09:00:00 GMT</pubDate></item>
</channel></rss>`;

// Requires `docker compose up -d` (Postgres + Redis from .env).
describe('Shared reading lists (e2e)', () => {
  let app: INestApplication<App>;
  let mail: FakeMailService;
  let http: FakeHttpClient;
  let auth: { Authorization: string };
  let blogId: string;

  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const zeta = `https://zeta-${run}.test/`;
  const alpha = `https://alpha-${run}.test/`;

  beforeAll(async () => {
    ({ app, mail, http } = await createTestApp());
    auth = { Authorization: `Bearer ${(await signIn(app, mail)).accessToken}` };
    http.pages.set(`${zeta}feed.xml`, rss(zeta, 'Zeta'));
    http.pages.set(`${alpha}feed.xml`, rss(alpha, 'alpha'));
    for (const url of [`${zeta}feed.xml`, `${alpha}feed.xml`]) {
      const res = await request(app.getHttpServer())
        .post('/blogs')
        .set(auth)
        .send({ url })
        .expect(201);
      blogId ??= (res.body as { id: string }).id;
    }
    // A private rename must never show on the public page.
    await request(app.getHttpServer())
      .patch(`/blogs/${blogId}`)
      .set(auth)
      .send({ title: 'My secret name' })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('is off until the reader turns it on', async () => {
    const me = await request(app.getHttpServer())
      .get('/me')
      .set(auth)
      .expect(200);
    expect((me.body as { shareId: string | null }).shareId).toBeNull();
  });

  it('shares blogs by their own titles, sorted, without the reader', async () => {
    const on = await request(app.getHttpServer())
      .post('/me/share')
      .set(auth)
      .send({})
      .expect(200);
    const { shareId } = on.body as { shareId: string };
    expect(shareId).toMatch(/^[\w-]{11}$/);

    // Turning it on again keeps the same link.
    const again = await request(app.getHttpServer())
      .post('/me/share')
      .set(auth)
      .send({})
      .expect(200);
    expect((again.body as { shareId: string }).shareId).toBe(shareId);

    const res = await request(app.getHttpServer())
      .get(`/shared/${shareId}`)
      .expect(200);
    const body = res.body as {
      blogs: {
        title: string;
        sourceUrl: string;
        latestPost: { title: string } | null;
      }[];
    };
    expect(body.blogs.map((b) => b.title)).toEqual(['alpha', 'Zeta']);
    expect(body.blogs[0]).toMatchObject({
      sourceUrl: `${alpha}feed.xml`,
      latestPost: { title: 'Hello from alpha' },
    });
    expect(JSON.stringify(body)).not.toContain('My secret name');
    expect(JSON.stringify(body)).not.toContain('@');
  });

  it('retires the old link on reset and hides the list when turned off', async () => {
    const before = await request(app.getHttpServer())
      .post('/me/share')
      .set(auth)
      .send({})
      .expect(200);
    const oldId = (before.body as { shareId: string }).shareId;

    const reset = await request(app.getHttpServer())
      .post('/me/share')
      .set(auth)
      .send({ reset: true })
      .expect(200);
    const newId = (reset.body as { shareId: string }).shareId;
    expect(newId).not.toBe(oldId);
    await request(app.getHttpServer()).get(`/shared/${oldId}`).expect(404);
    await request(app.getHttpServer()).get(`/shared/${newId}`).expect(200);

    const off = await request(app.getHttpServer())
      .delete('/me/share')
      .set(auth)
      .expect(200);
    expect((off.body as { shareId: string | null }).shareId).toBeNull();
    await request(app.getHttpServer()).get(`/shared/${newId}`).expect(404);
  });
});
