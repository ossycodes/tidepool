import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { IngestService } from '../src/feeds/ingest.service.js';
import {
  createTestApp,
  signIn,
  type FakeHttpClient,
  type FakeMailService,
} from './helpers.js';

const rss = (site: string, slugs: string[]) => `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Essays</title><link>${site}</link>
${slugs.map((s) => `<item><title>Post ${s}</title><link>${site}${s}</link></item>`).join('\n')}
</channel></rss>`;

// Requires `docker compose up -d` (Postgres + Redis from .env).
describe('Renaming and pausing blogs (e2e)', () => {
  let app: INestApplication<App>;
  let mail: FakeMailService;
  let http: FakeHttpClient;
  let me: { Authorization: string };
  let other: { Authorization: string };
  let blogId: string;

  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const site = `https://essays-${run}.test/`;
  const feed = `${site}feed.xml`;

  beforeAll(async () => {
    ({ app, mail, http } = await createTestApp());
    http.pages.set(feed, rss(site, ['a']));
    me = { Authorization: `Bearer ${(await signIn(app, mail)).accessToken}` };
    other = {
      Authorization: `Bearer ${(await signIn(app, mail)).accessToken}`,
    };

    const res = await request(app.getHttpServer())
      .post('/blogs')
      .set(me)
      .send({ url: feed })
      .expect(201);
    blogId = res.body.id;
    await request(app.getHttpServer())
      .post('/blogs')
      .set(other)
      .send({ url: feed })
      .expect(201);

    // A new post after following, so it's digest-eligible.
    http.pages.set(feed, rss(site, ['a', 'b']));
    await app.get(IngestService).refresh(blogId);
  });

  afterAll(async () => {
    await app.close();
  });

  const patch = (body: object, auth = me) =>
    request(app.getHttpServer()).patch(`/blogs/${blogId}`).set(auth).send(body);
  const preview = async () =>
    (
      await request(app.getHttpServer())
        .get('/digests/preview')
        .set(me)
        .expect(200)
    ).body.sections as { blog: { id: string; title: string } }[];

  it('renames a blog for this reader only', async () => {
    const res = await patch({ title: '  Paul Graham  ' }).expect(200);
    expect(res.body).toMatchObject({
      title: 'Paul Graham',
      customTitle: 'Paul Graham',
      originalTitle: 'Essays',
    });

    const theirs = await request(app.getHttpServer())
      .get(`/blogs/${blogId}`)
      .set(other)
      .expect(200);
    expect(theirs.body.title).toBe('Essays');

    const section = (await preview()).find((s) => s.blog.id === blogId);
    expect(section?.blog.title).toBe('Paul Graham');
  });

  it('restores the original title when cleared', async () => {
    const res = await patch({ title: '' }).expect(200);
    expect(res.body).toMatchObject({ title: 'Essays', customTitle: null });
    await patch({ title: 'Paul Graham' }).expect(200);
    const again = await patch({ title: null }).expect(200);
    expect(again.body.customTitle).toBeNull();
  });

  it('validates titles', async () => {
    await patch({ title: 'x'.repeat(121) }).expect(400);
    await patch({ paused: 'yes' }).expect(400);
  });

  it('leaves paused blogs out of the digest until resumed', async () => {
    const paused = await patch({ paused: true }).expect(200);
    expect(paused.body.paused).toBe(true);
    expect((await preview()).map((s) => s.blog.id)).not.toContain(blogId);

    // Still listed and still followed.
    const list = await request(app.getHttpServer())
      .get('/blogs')
      .set(me)
      .expect(200);
    expect(list.body.find((b: { id: string }) => b.id === blogId)?.paused).toBe(
      true,
    );

    await patch({ paused: false }).expect(200);
    expect((await preview()).map((s) => s.blog.id)).toContain(blogId);
  });

  it("can't change a blog you don't follow", async () => {
    const stranger = {
      Authorization: `Bearer ${(await signIn(app, mail)).accessToken}`,
    };
    await patch({ paused: true }, stranger).expect(404);
  });
});
