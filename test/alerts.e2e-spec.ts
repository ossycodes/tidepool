import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { IngestService } from '../src/feeds/ingest.service.js';
import {
  createTestApp,
  signIn,
  uniqueEmail,
  type FakeAlertsService,
  type FakeHttpClient,
  type FakeMailService,
} from './helpers.js';

const rss = (site: string) => `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Alerted Blog</title><link>${site}</link>
<item><title>Post</title><link>${site}post</link></item></channel></rss>`;

// Requires `docker compose up -d` (Postgres + Redis from .env).
describe('Ops alerts (e2e)', () => {
  let app: INestApplication<App>;
  let mail: FakeMailService;
  let http: FakeHttpClient;
  let alerts: FakeAlertsService;

  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const site = `https://alerts-${run}.test/`;
  const feed = `${site}feed.xml`;

  beforeAll(async () => {
    ({ app, mail, http, alerts } = await createTestApp());
    http.pages.set(feed, rss(site));
  });

  afterAll(async () => {
    await app.close();
  });

  const matching = (text: string) =>
    alerts.sent.filter((a) => a.includes(text));

  it('alerts on a new reader once, with the email masked', async () => {
    const email = uniqueEmail('newreader');
    await signIn(app, mail, email);
    await signIn(app, mail, email);

    const welcomes = matching('New reader');
    expect(welcomes).toHaveLength(1);
    expect(welcomes[0]).toContain('n***@example.com');
    expect(welcomes[0]).not.toContain(email);
  });

  it('alerts when a blog new to Tidepool is added, not when more people follow it', async () => {
    const first = await signIn(app, mail);
    const second = await signIn(app, mail);
    for (const { accessToken } of [first, second]) {
      await request(app.getHttpServer())
        .post('/blogs')
        .set({ Authorization: `Bearer ${accessToken}` })
        .send({ url: feed })
        .expect(201);
    }

    const added = matching('New blog');
    expect(added).toHaveLength(1);
    expect(added[0]).toContain('Alerted Blog');
    expect(added[0]).toContain('has a feed');
  });

  it('alerts once when a blog crosses into failing', async () => {
    const { accessToken } = await signIn(app, mail);
    const failingSite = `https://failing-${run}.test/`;
    http.pages.set(`${failingSite}feed.xml`, rss(failingSite));
    const blog = await request(app.getHttpServer())
      .post('/blogs')
      .set({ Authorization: `Bearer ${accessToken}` })
      .send({ url: `${failingSite}feed.xml` })
      .expect(201);

    // The site goes away; the 3rd failure in a row is when readers see it.
    http.pages.delete(`${failingSite}feed.xml`);
    const ingest = app.get(IngestService);
    for (let i = 0; i < 4; i++) await ingest.refresh(blog.body.id as string);

    const failing = matching('Blog failing');
    expect(failing).toHaveLength(1);
    expect(failing[0]).toContain(`${failingSite}feed.xml`);
  });
});
