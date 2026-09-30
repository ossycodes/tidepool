import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Express, NextFunction, Request, Response } from 'express';
import type { Env } from './config/env.js';

/** Shared by main.ts and the e2e tests so both run the same pipeline. */
export function configureApp(app: INestApplication) {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  const express = app.getHttpAdapter().getInstance() as Express;
  // Behind a proxy every request arrives from the proxy's address, so the
  // rate limits (keyed on req.ip) would be shared by every user. Trust
  // exactly as many hops as there are proxies: trusting more would let
  // clients pick their own IP with X-Forwarded-For.
  express.set('trust proxy', config.get('TRUST_PROXY', { infer: true }));
  express.disable('x-powered-by');
  express.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({ origin: config.get('FRONTEND_URL', { infer: true }) });
  app.enableShutdownHooks();
}
