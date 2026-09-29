import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { MailService, type MailMessage } from '../src/mail/mail.service.js';

export class FakeMailService {
  readonly sent: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }

  lastTo(to: string): MailMessage | undefined {
    return this.sent.findLast((m) => m.to === to);
  }
}

export async function createTestApp() {
  const mail = new FakeMailService();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(mail)
    .compile();

  const app: INestApplication<App> = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, mail, moduleRef };
}

export function uniqueEmail(prefix = 'e2e') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/** Runs the real magic-link flow and returns an access token. */
export async function signIn(
  app: INestApplication<App>,
  mail: FakeMailService,
  email = uniqueEmail(),
) {
  await request(app.getHttpServer())
    .post('/auth/magic-link')
    .send({ email })
    .expect(202);
  const token = extractToken(mail.lastTo(email)!.text);
  const res = await request(app.getHttpServer())
    .post('/auth/verify')
    .send({ token })
    .expect(200);
  return { email, accessToken: res.body.accessToken as string, token };
}

export function extractToken(text: string): string {
  const match = /token=([A-Za-z0-9_-]+)/.exec(text);
  if (!match) throw new Error('No token in email');
  return match[1];
}
