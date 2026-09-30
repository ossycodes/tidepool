import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  createTestApp,
  extractToken,
  signIn,
  uniqueEmail,
  type FakeMailService,
} from './helpers.js';

// Requires `docker compose up -d` (uses the database from .env).
describe('Auth & settings (e2e)', () => {
  let app: INestApplication<App>;
  let mail: FakeMailService;

  beforeAll(async () => {
    ({ app, mail } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects protected routes without a token', () => {
    return request(app.getHttpServer()).get('/me').expect(401);
  });

  it('validates the email', () => {
    return request(app.getHttpServer())
      .post('/auth/magic-link')
      .send({ email: 'nope' })
      .expect(400);
  });

  it('signs in with a magic link, and the link is single-use', async () => {
    const { email, accessToken, token } = await signIn(app, mail);

    const me = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body).toMatchObject({
      email,
      digestEnabled: true,
      timezone: 'UTC',
    });

    await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ token })
      .expect(401);
  });

  it('applies the browser timezone on first sign-in', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/auth/magic-link')
      .send({ email: email.toUpperCase() })
      .expect(202);
    const token = extractToken(mail.lastTo(email)!.text);
    const res = await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ token, timezone: 'Africa/Lagos' })
      .expect(200);
    expect(res.body.user).toMatchObject({ email, timezone: 'Africa/Lagos' });
  });

  it('updates settings and validates them', async () => {
    const { accessToken } = await signIn(app, mail);
    const auth = { Authorization: `Bearer ${accessToken}` };

    await request(app.getHttpServer())
      .patch('/me')
      .set(auth)
      .send({ timezone: 'Mars/Olympus' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/me')
      .set(auth)
      .send({ digestHour: 24 })
      .expect(400);

    const res = await request(app.getHttpServer())
      .patch('/me')
      .set(auth)
      .send({ digestDay: 5, digestHour: 17, timezone: 'Europe/London' })
      .expect(200);
    expect(res.body).toMatchObject({
      digestDay: 5,
      digestHour: 17,
      timezone: 'Europe/London',
    });

    await request(app.getHttpServer()).delete('/me').set(auth).expect(204);
    // A deleted account's token no longer signs anyone in.
    await request(app.getHttpServer()).get('/me').set(auth).expect(401);
  });
});
