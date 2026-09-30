import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  createTestApp,
  signIn,
  uniqueEmail,
  type FakeMailService,
} from './helpers.js';

// Its own file (and app) so its sign-ins get their own rate-limit budget.
// Requires `docker compose up -d` (Postgres + Redis from .env).
describe('Sessions (e2e)', () => {
  let app: INestApplication<App>;
  let mail: FakeMailService;

  beforeAll(async () => {
    ({ app, mail } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('signs out every device at once', async () => {
    const email = uniqueEmail();
    const phone = await signIn(app, mail, email);
    const laptop = await signIn(app, mail, email);
    const onPhone = { Authorization: `Bearer ${phone.accessToken}` };
    const onLaptop = { Authorization: `Bearer ${laptop.accessToken}` };
    await request(app.getHttpServer()).get('/me').set(onLaptop).expect(200);

    await request(app.getHttpServer())
      .post('/me/sign-out-everywhere')
      .set(onPhone)
      .expect(204);

    await request(app.getHttpServer()).get('/me').set(onPhone).expect(401);
    await request(app.getHttpServer()).get('/me').set(onLaptop).expect(401);

    // Signing in again works as usual.
    const fresh = await signIn(app, mail, email);
    await request(app.getHttpServer())
      .get('/me')
      .set({ Authorization: `Bearer ${fresh.accessToken}` })
      .expect(200);
  });
});
