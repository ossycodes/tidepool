import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DigestScheduler } from '../src/digest/digest.scheduler.js';
import { DigestService } from '../src/digest/digest.service.js';
import { localDayAndHour } from '../src/digest/schedule.js';
import { IngestService } from '../src/feeds/ingest.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  createTestApp,
  signIn,
  type FakeHttpClient,
  type FakeMailService,
} from './helpers.js';

const rss = (site: string, slugs: string[]) => `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Digest Blog</title><link>${site}</link>
${slugs.map((s) => `<item><title>Post ${s}</title><link>${site}posts/${s}</link></item>`).join('\n')}
</channel></rss>`;

// Requires `docker compose up -d` (Postgres + Redis from .env).
describe('Digests (e2e)', () => {
  let app: INestApplication<App>;
  let mail: FakeMailService;
  let http: FakeHttpClient;
  let prisma: PrismaService;
  let digests: DigestService;

  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const site = `https://digest-${run}.test/`;
  const feed = `${site}feed.xml`;

  let email: string;
  let userId: string;
  let auth: { Authorization: string };
  let blogId: string;

  beforeAll(async () => {
    ({ app, mail, http } = await createTestApp());
    prisma = app.get(PrismaService);
    digests = app.get(DigestService);

    const session = await signIn(app, mail);
    email = session.email;
    auth = { Authorization: `Bearer ${session.accessToken}` };
    userId = (await request(app.getHttpServer()).get('/me').set(auth)).body.id;

    http.pages.set(feed, rss(site, ['old-1', 'old-2']));
    const blog = await request(app.getHttpServer())
      .post('/blogs')
      .set(auth)
      .send({ url: feed })
      .expect(201);
    blogId = blog.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const mailsTo = () =>
    mail.sent.filter(
      (m) => m.to === email && m.subject.includes('Tidepool No.'),
    );

  it('previews only posts that appeared after following', async () => {
    const empty = await request(app.getHttpServer())
      .get('/digests/preview')
      .set(auth)
      .expect(200);
    expect(empty.body.sections).toEqual([]);

    http.pages.set(feed, rss(site, ['old-1', 'old-2', 'new-1']));
    await app.get(IngestService).refresh(blogId);

    const res = await request(app.getHttpServer())
      .get('/digests/preview')
      .set(auth)
      .expect(200);
    expect(res.body.sections).toHaveLength(1);
    expect(res.body.sections[0].blog.title).toBe('Digest Blog');
    expect(
      res.body.sections[0].posts.map((p: { url: string }) => p.url),
    ).toEqual([`${site}posts/new-1`]);
  });

  it('sends a test digest without touching the schedule', async () => {
    const res = await request(app.getHttpServer())
      .post('/digests/test')
      .set(auth)
      .expect(200);
    expect(res.body).toEqual({ sent: true, postCount: 1 });
    expect(mailsTo()).toHaveLength(1);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.lastDigestSentAt).toBeNull();
  });

  it('sends the weekly digest once, then skips until next week', async () => {
    expect(await digests.send(userId)).toBe('sent');
    const message = mailsTo().at(-1)!;
    expect(message.subject).toBe('Tidepool No. 1: 1 new post from 1 blog');
    expect(message.text).toContain(`${site}posts/new-1`);
    expect(message.headers?.['List-Unsubscribe-Post']).toBe(
      'List-Unsubscribe=One-Click',
    );

    expect(await digests.send(userId)).toBe('skipped');

    const history = await request(app.getHttpServer())
      .get('/digests')
      .set(auth)
      .expect(200);
    expect(history.body).toHaveLength(1);
    expect(history.body[0].postCount).toBe(1);
  });

  it('never sends the same post twice, and skips empty weeks', async () => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000);
    await prisma.user.update({
      where: { id: userId },
      data: { lastDigestSentAt: weekAgo },
    });
    // Pretend new-1 was discovered before the "last" digest.
    await prisma.post.updateMany({
      where: { blogId },
      data: { discoveredAt: new Date(weekAgo.getTime() - 1000) },
    });
    const before = mailsTo().length;
    expect(await digests.send(userId)).toBe('empty');
    expect(mailsTo()).toHaveLength(before);
  });

  it('holds the issue until the minimum number of posts, then sends them all', async () => {
    const settings = await request(app.getHttpServer())
      .patch('/me')
      .set(auth)
      .send({ digestFrequency: 'DAILY', digestMinPosts: 2 })
      .expect(200);
    expect(settings.body).toMatchObject({
      digestFrequency: 'DAILY',
      digestMinPosts: 2,
    });
    await request(app.getHttpServer())
      .patch('/me')
      .set(auth)
      .send({ digestFrequency: 'HOURLY' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/me')
      .set(auth)
      .send({ digestMinPosts: 0 })
      .expect(400);

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60_000);
    await prisma.user.update({
      where: { id: userId },
      data: { lastDigestSentAt: twoDaysAgo },
    });
    const before = mailsTo().length;

    // One new post: below the minimum, so nothing goes out and the window stays open.
    http.pages.set(feed, rss(site, ['old-1', 'old-2', 'new-1', 'new-2']));
    await app.get(IngestService).refresh(blogId);
    expect(await digests.send(userId)).toBe('held');
    expect(mailsTo()).toHaveLength(before);
    const held = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(held.lastDigestSentAt).toEqual(twoDaysAgo);

    // A second post meets the minimum; both arrive together.
    http.pages.set(
      feed,
      rss(site, ['old-1', 'old-2', 'new-1', 'new-2', 'new-3']),
    );
    await app.get(IngestService).refresh(blogId);
    expect(await digests.send(userId)).toBe('sent');
    const message = mailsTo().at(-1)!;
    expect(message.text).toContain(`${site}posts/new-2`);
    expect(message.text).toContain(`${site}posts/new-3`);

    await prisma.user.update({
      where: { id: userId },
      data: { digestFrequency: 'WEEKLY', digestMinPosts: 1 },
    });
  });

  it('queues users whose local delivery hour is now', async () => {
    const { day, hour } = localDayAndHour(new Date(), 'Asia/Tokyo');
    await prisma.user.update({
      where: { id: userId },
      data: {
        timezone: 'Asia/Tokyo',
        digestDay: day,
        digestHour: hour,
        lastDigestSentAt: null,
      },
    });
    const queued = await app.get(DigestScheduler).enqueueDueDigests();
    expect(queued).toContain(userId);

    await prisma.user.update({
      where: { id: userId },
      data: { digestHour: (hour + 1) % 24 },
    });
    expect(await app.get(DigestScheduler).enqueueDueDigests()).not.toContain(
      userId,
    );
  });

  it('unsubscribes via the email link, with a confirm step', async () => {
    const link = /Unsubscribe: (\S+)/.exec(mailsTo().at(-1)!.text)![1];
    const path = new URL(link).pathname + new URL(link).search;
    const token = new URL(link).searchParams.get('token')!;

    // Unsubscribe tokens must not work as logins.
    await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    const confirm = await request(app.getHttpServer()).get(path).expect(200);
    expect(confirm.text).toContain('<form method="post"');
    let user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.digestEnabled).toBe(true);

    await request(app.getHttpServer())
      .post(path)
      .type('form')
      .send('List-Unsubscribe=One-Click')
      .expect(200);
    user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.digestEnabled).toBe(false);
    expect(await digests.send(userId)).toBe('skipped');
  });

  it('rejects bad unsubscribe tokens, including access tokens', async () => {
    await request(app.getHttpServer())
      .post('/digests/unsubscribe?token=garbage')
      .expect(400);
    const accessToken = auth.Authorization.replace('Bearer ', '');
    await request(app.getHttpServer())
      .post(`/digests/unsubscribe?token=${accessToken}`)
      .expect(400);
  });
});
