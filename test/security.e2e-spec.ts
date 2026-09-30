import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createTestApp, uniqueEmail } from './helpers.js';

// This file's app runs as if one proxy sat in front of it (e.g. Railway).
// Hoisted: ConfigModule reads the environment when app.module is imported.
vi.hoisted(() => {
  process.env.TRUST_PROXY = '1';
});

// Requires `docker compose up -d` (Postgres + Redis from .env).
describe('Security hardening (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  const askForLink = (clientIp: string) =>
    request(app.getHttpServer())
      .post('/auth/magic-link')
      .set('X-Forwarded-For', clientIp)
      .send({ email: uniqueEmail('limit') });

  it('rate-limits each client behind the proxy separately', async () => {
    // The sign-in route allows 5 requests a minute per client.
    for (let i = 0; i < 5; i++) await askForLink('203.0.113.1').expect(202);
    await askForLink('203.0.113.1').expect(429);
    // Another visitor behind the same proxy isn't affected.
    await askForLink('203.0.113.2').expect(202);
  });

  it('sends hardening headers and hides the framework', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
