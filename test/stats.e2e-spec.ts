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
describe('Public stats (e2e)', () => {
  let app: INestApplication<App>;
  let mail: FakeMailService;
  let http: FakeHttpClient;

  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const shared = `https://shared-${run}.test/`;
  const lonely = `https://lonely-${run}.test/`;

  beforeAll(async () => {
    ({ app, mail, http } = await createTestApp());
    http.pages.set(`${shared}feed.xml`, rss(shared, `Shared ${run}`));
    http.pages.set(`${lonely}feed.xml`, rss(lonely, `Lonely ${run}`));

    const follow = async (token: string, url: string) =>
      request(app.getHttpServer())
        .post('/blogs')
        .set('Authorization', `Bearer ${token}`)
        .send({ url })
        .expect(201);

    const a = await signIn(app, mail);
    const b = await signIn(app, mail);
    await follow(a.accessToken, `${shared}feed.xml`);
    await follow(b.accessToken, `${shared}feed.xml`);
    await follow(a.accessToken, `${lonely}feed.xml`);
  });

  afterAll(async () => {
    await app.close();
  });

  it('is public and returns aggregate numbers only', async () => {
    const res = await request(app.getHttpServer()).get('/stats').expect(200);
    expect(res.body).toMatchObject({
      readers: expect.any(Number),
      follows: expect.any(Number),
      blogs: expect.any(Number),
      digestsSent: expect.any(Number),
    });
    expect(res.body.readers).toBeGreaterThanOrEqual(2);
    expect(res.body.newReadersThisWeek).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(res.body)).not.toMatch(/@example\.com/);
  });

  it('lists popular blogs but never ones with a single follower', async () => {
    const res = await request(app.getHttpServer()).get('/stats').expect(200);
    const titles = res.body.topBlogs.map((b: { title: string }) => b.title);
    const followerCounts = res.body.topBlogs.map(
      (b: { followers: number }) => b.followers,
    );
    expect(titles).not.toContain(`Lonely ${run}`);
    expect(Math.min(...followerCounts, 2)).toBeGreaterThanOrEqual(2);
    // The shared blog has 2 followers; it's listed unless 10 busier blogs exist.
    if (res.body.topBlogs.length < 10) {
      expect(titles).toContain(`Shared ${run}`);
    }
  });
});
