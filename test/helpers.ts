import type { INestApplication } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { HttpClient } from '../src/common/http-client.js';
import { FetchError, type FetchResult } from '../src/common/safe-fetch.js';
import { DigestProcessor } from '../src/digest/digest.processor.js';
import { FetchProcessor } from '../src/feeds/fetch.processor.js';
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

/** Serves in-memory pages instead of hitting the network. */
export class FakeHttpClient {
  readonly pages = new Map<string, string>();
  readonly requests: string[] = [];

  get(url: string): Promise<FetchResult> {
    this.requests.push(url);
    const body = this.pages.get(url);
    if (body === undefined) {
      return Promise.reject(new FetchError(`HTTP 404 fetching ${url}`));
    }
    return Promise.resolve({ url, status: 200, contentType: '', body });
  }
}

export async function createTestApp() {
  const mail = new FakeMailService();
  const http = new FakeHttpClient();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(mail)
    .overrideProvider(HttpClient)
    .useValue(http)
    .compile();

  const app: INestApplication<App> = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  // Tests call the schedulers and services directly. Background crons and
  // queue workers would race them, and each other across test files that
  // run in parallel, so every test app switches them off.
  for (const job of app.get(SchedulerRegistry).getCronJobs().values()) {
    void job.stop();
  }
  await Promise.all([
    app.get(DigestProcessor).worker.close(),
    app.get(FetchProcessor).worker.close(),
  ]);
  return { app, mail, http, moduleRef };
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
