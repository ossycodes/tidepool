import {
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser, Public, type AuthUser } from '../common/decorators.js';
import { escapeHtml, layout } from '../mail/templates.js';
import { DigestService } from './digest.service.js';

@Controller('digests')
export class DigestController {
  constructor(private readonly digests: DigestService) {}

  @Get()
  history(@CurrentUser() user: AuthUser) {
    return this.digests.history(user.id);
  }

  @Get('preview')
  preview(@CurrentUser() user: AuthUser) {
    return this.digests.preview(user.id);
  }

  /** Emails the current preview to yourself. */
  @Post('test')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60 * 60_000 } })
  sendTest(@CurrentUser() user: AuthUser) {
    return this.digests.sendTest(user.id);
  }

  /**
   * Link from the email footer. Only shows a confirm button: mail scanners
   * prefetch GET links, so unsubscribing here would unsubscribe people.
   */
  @Public()
  @Get('unsubscribe')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async confirmUnsubscribe(
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ) {
    if (!token || !(await this.digests.verifyUnsubscribeToken(token))) {
      res.status(400).send(page('This unsubscribe link is invalid.'));
      return;
    }
    res.send(
      page(`<p>Stop receiving the weekly Tidepool digest?</p>
        <form method="post" action="?token=${escapeHtml(encodeURIComponent(token))}">
          <button type="submit" style="background:#0969da;color:#fff;border:0;padding:10px 18px;border-radius:6px;font-weight:600;cursor:pointer;">Unsubscribe</button>
        </form>`),
    );
  }

  /** Confirm button above, and RFC 8058 one-click unsubscribe from mail clients. */
  @Public()
  @Post('unsubscribe')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async unsubscribe(
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ) {
    const userId = token ? await this.digests.unsubscribe(token) : null;
    if (!userId) {
      res.status(400).send(page('This unsubscribe link is invalid.'));
      return;
    }
    // Explicit 200: with @Res() Nest would otherwise keep its POST default of 201.
    res
      .status(200)
      .send(
        page(
          "You're unsubscribed and won't get any more digests. You can turn them back on from your settings.",
        ),
      );
  }
}

function page(body: string): string {
  return layout(body.startsWith('<') ? body : `<p>${body}</p>`);
}
