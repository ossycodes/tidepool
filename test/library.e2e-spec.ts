import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { articleContent } from '../src/library/article.js';
import { ArticleProcessor } from '../src/library/article.processor.js';
import { createTestApp, signIn, type FakeHttpClient } from './helpers.js';

describe('Library and reader (e2e)', () => {
  let app: INestApplication<App>, prisma: PrismaService, http: FakeHttpClient;
  let auth: { Authorization: string },
    other: { Authorization: string },
    userId: string,
    postId: string,
    blogId: string,
    collectionId: string,
    noteId: string;
  const text =
    'A small wonder is something you notice when you leave enough room for curiosity. Reading carefully helps us find the connections between ideas, and keeping a few notes lets those connections stay with us.';
  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    http = setup.http;
    prisma = app.get(PrismaService);
    const signedIn = await signIn(app, setup.mail);
    const stranger = await signIn(app, setup.mail);
    auth = { Authorization: `Bearer ${signedIn.accessToken}` };
    other = { Authorization: `Bearer ${stranger.accessToken}` };
    userId = (
      await prisma.user.findUniqueOrThrow({ where: { email: signedIn.email } })
    ).id;
    const blog = await prisma.blog.create({
      data: {
        sourceUrl: `https://library-${Date.now()}.test/feed`,
        siteUrl: 'https://example.com',
        title: 'Small wonders',
        fetchMode: 'FEED',
        subscriptions: { create: { userId } },
        posts: {
          create: {
            url: 'https://example.com/wonder',
            title: 'A small wonder',
            summary: text,
          },
        },
      },
      include: { posts: true },
    });
    blogId = blog.id;
    postId = blog.posts[0].id;
  });
  afterAll(async () => {
    if (app) await app.close();
  });
  it('checks ownership before reading, saving or extracting an article', async () => {
    await request(app.getHttpServer())
      .get(`/library/posts/${postId}`)
      .set(other)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/library/posts/${postId}`)
      .set(other)
      .send({ saved: true })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/library/posts/${postId}/extract`)
      .set(other)
      .expect(404);
    await request(app.getHttpServer()).get('/library').expect(401);
  });
  it('saves an article with its own reading state and collections', async () => {
    const c = await request(app.getHttpServer())
      .post('/library/collections')
      .set(auth)
      .send({ name: ' Curiosity ' })
      .expect(201);
    collectionId = c.body.id;
    await request(app.getHttpServer())
      .patch(`/library/posts/${postId}`)
      .set(auth)
      .send({ saved: true, favourite: true, collectionIds: [collectionId] })
      .expect(200);
    const list = await request(app.getHttpServer())
      .get('/library')
      .set(auth)
      .expect(200);
    expect(list.body.items[0]).toMatchObject({
      id: postId,
      state: {
        saved: true,
        favourite: true,
        collections: [{ id: collectionId }],
      },
    });
    expect(list.body.collections[0].count).toBe(1);
    await request(app.getHttpServer())
      .patch(`/library/posts/${postId}`)
      .set(auth)
      .send({ collectionIds: ['other-collection'] })
      .expect(400);
    expect(
      (
        await request(app.getHttpServer())
          .get('/library')
          .set(other)
          .expect(200)
      ).body.items,
    ).toEqual([]);
  });
  it('rejects null reading state instead of producing database errors', async () => {
    await request(app.getHttpServer())
      .patch(`/library/posts/${postId}`)
      .set(auth)
      .send({ saved: null })
      .expect(400);
  });
  it('extracts once using the protected HTTP client and serves safe cached content', async () => {
    http.pages.set(
      'https://example.com/wonder',
      `<article><h1>A small wonder</h1>${Array.from({ length: 5 }, () => `<p>${text}</p>`).join('')}<script>alert(1)</script></article>`,
    );
    await app.get(ArticleProcessor).process({ data: { postId } } as never);
    const before = http.requests.length;
    await app.get(ArticleProcessor).process({ data: { postId } } as never);
    expect(http.requests.length).toBe(before);
    const res = await request(app.getHttpServer())
      .get(`/library/posts/${postId}`)
      .set(auth)
      .expect(200);
    expect(res.body.content.html).not.toContain('<script>');
    expect(res.body.content.readingTime).toBeGreaterThan(0);
    await request(app.getHttpServer())
      .patch(`/library/posts/${postId}`)
      .set(auth)
      .send({ progress: 2 })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/library/posts/${postId}`)
      .set(auth)
      .send({ progress: 0.4, status: 'READING', paragraph: 'p1' })
      .expect(200);
  });
  it('validates passage anchors and keeps notes private', async () => {
    const content = await prisma.articleContent.findUniqueOrThrow({
      where: { postId },
    });
    const dom = content.text.match(/\[p1\] (.*)/)![1];
    const quote = dom.slice(0, 10);
    const data = {
      paragraph: 'p1',
      quote,
      start: 0,
      end: 10,
      version: content.version,
      note: 'Remember this.',
    };
    await request(app.getHttpServer())
      .post(`/library/posts/${postId}/notes`)
      .set(auth)
      .send({ ...data, quote: 'fabricated' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/library/posts/${postId}/notes`)
      .set(auth)
      .send({ ...data, version: 'stale' })
      .expect(400);
    const note = await request(app.getHttpServer())
      .post(`/library/posts/${postId}/notes`)
      .set(auth)
      .send(data)
      .expect(201);
    noteId = note.body.id;
    await request(app.getHttpServer())
      .patch(`/library/notes/${noteId}`)
      .set(other)
      .send({ note: 'stolen' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/library/notes/${noteId}`)
      .set(other)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/library/notes/${noteId}`)
      .set(auth)
      .send({ note: 'A revised thought.' })
      .expect(204);
    expect(
      (
        await request(app.getHttpServer())
          .get(`/library/posts/${postId}`)
          .set(auth)
          .expect(200)
      ).body.annotations[0].note,
    ).toBe('A revised thought.');
  });
  it('streams and persists private AI conversations, including follow-ups', async () => {
    const config = app.get(ConfigService);
    config.set('AI_API_KEY', 'test-only');
    config.set('AI_MODEL', 'fixture');
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (_url, init) => {
        const body = JSON.parse(
          typeof init?.body === 'string' ? init.body : '{}',
        );
        expect(body.stream).toBe(true);
        expect(body.max_tokens).toBe(500);
        expect(body.messages[0].content).toContain('untrusted');
        return new Response(
          'data: {"choices":[{"delta":{"content":"A thoughtful answer [p1]."}}]}\n\ndata: [DONE]\n\n',
          { headers: { 'Content-Type': 'text/event-stream' } },
        );
      });
    try {
      const answer = await request(app.getHttpServer())
        .post(`/library/posts/${postId}/ask`)
        .set(auth)
        .send({ question: 'Explain this', annotationId: noteId, mode: 'quick' })
        .expect(201);
      expect(answer.text).toContain('event: delta');
      expect(answer.text).toContain('event: done');
      expect(answer.text).not.toContain('event: error');
      const note = await prisma.annotation.findUniqueOrThrow({
        where: { id: noteId },
      });
      expect(note.messages).toEqual([
        { role: 'user', content: 'Explain this' },
        { role: 'assistant', content: 'A thoughtful answer [p1].' },
      ]);
      await request(app.getHttpServer())
        .post(`/library/posts/${postId}/ask`)
        .set(auth)
        .send({ question: 'And why?', annotationId: noteId })
        .expect(201);
      const updated = await prisma.annotation.findUniqueOrThrow({
        where: { id: noteId },
      });
      expect(updated.messages).toHaveLength(4);
      await prisma.aiRequest.createMany({
        data: Array.from({ length: 30 }, () => ({ userId })),
      });
      await request(app.getHttpServer())
        .post(`/library/posts/${postId}/ask`)
        .set(auth)
        .send({ question: 'Too many requests' })
        .expect(400);
      await prisma.aiRequest.deleteMany({ where: { userId } });
    } finally {
      spy.mockRestore();
      config.set('AI_API_KEY', '');
      config.set('AI_MODEL', '');
    }
  });
  it('keeps saved reads after unfollowing and removes collections without losing articles', async () => {
    await prisma.subscription.deleteMany({ where: { userId, blogId } });
    await request(app.getHttpServer())
      .get(`/library/posts/${postId}`)
      .set(auth)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/library/collections/${collectionId}`)
      .set(other)
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/library/collections/${collectionId}`)
      .set(auth)
      .expect(204);
    const list = await request(app.getHttpServer())
      .get('/library')
      .set(auth)
      .expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].state.collections).toEqual([]);
  });
  it('can use full feed content without fetching the article page', async () => {
    const p = await prisma.post.create({
      data: {
        blogId,
        url: 'https://example.com/feed-only',
        title: 'A feed article',
        feedContent: `<p>${text}</p>`,
      },
    });
    const before = http.requests.length;
    await app
      .get(ArticleProcessor)
      .process({ data: { postId: p.id } } as never);
    expect(http.requests.length).toBe(before);
    expect(
      await prisma.articleContent.findUnique({ where: { postId: p.id } }),
    ).not.toBeNull();
    // Also exercise a representative deterministic extraction for later regressions.
    expect(articleContent(`<p>${text}</p>`, p.url, true).text).toContain(
      '[p1]',
    );
  });
});
