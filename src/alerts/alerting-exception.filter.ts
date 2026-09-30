import {
  Catch,
  HttpException,
  type ArgumentsHost,
  type HttpServer,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request } from 'express';
import { AlertsService, tg } from './alerts.service.js';

/**
 * Reports server errors (5xx) to the ops chat, then responds exactly as Nest
 * normally would. 4xx are the client's problem and stay quiet. Uses the route
 * pattern (`/blogs/:id`), not the URL, so no ids or query strings leak.
 */
@Catch()
export class AlertingExceptionFilter extends BaseExceptionFilter {
  constructor(
    applicationRef: HttpServer,
    private readonly alerts: AlertsService,
  ) {
    super(applicationRef);
  }

  override catch(exception: unknown, host: ArgumentsHost) {
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    if (status >= 500 && host.getType() === 'http') {
      const req = host.switchToHttp().getRequest<Request>();
      const route = `${req.method} ${(req.route as { path?: string } | undefined)?.path ?? req.path}`;
      const message =
        exception instanceof Error ? exception.message : String(exception);
      this.alerts.notify(
        `🔥 ${status} on <code>${tg(route)}</code>\n${tg(message.slice(0, 300))}`,
        { key: `5xx:${route}:${message}` },
      );
    }
    super.catch(exception, host);
  }
}
