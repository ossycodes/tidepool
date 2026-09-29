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
import { ConfigService } from '@nestjs/config';
import { CurrentUser, Public, type AuthUser } from '../common/decorators.js';
import type { Env } from '../config/env.js';
import {
  button,
  COLORS,
  escapeHtml,
  layout,
  paragraph,
  SANS,
  SERIF,
} from '../mail/templates.js';
import { DigestService } from './digest.service.js';

@Controller('digests')
export class DigestController {
  constructor(
    private readonly digests: DigestService,
    private readonly config: ConfigService<Env, true>,
  ) {}

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
      res.status(400).send(invalidLinkPage());
      return;
    }
    res.send(
      page(
        'Unsubscribe from Tidepool?',
        `${paragraph("You'll stop getting the weekly digest. Your reading list stays saved, and you can turn digests back on any time.", 12)}
        <form method="post" action="?token=${escapeHtml(encodeURIComponent(token))}" style="margin:28px 0 0;">
          <button type="submit" style="padding:13px 24px;border:0;border-radius:10px;background:${COLORS.tide};color:${COLORS.onTide};font-family:${SANS};font-size:15px;font-weight:600;line-height:1;cursor:pointer;">Unsubscribe</button>
        </form>`,
      ),
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
      res.status(400).send(invalidLinkPage());
      return;
    }
    const settingsUrl = new URL(
      '/settings',
      this.config.get('FRONTEND_URL', { infer: true }),
    ).toString();
    // Explicit 200: with @Res() Nest would otherwise keep its POST default of 201.
    res
      .status(200)
      .send(
        page(
          "You're unsubscribed",
          `${paragraph("You won't get any more digests. Your reading list is still saved if you change your mind.", 12)}${button('Open settings', settingsUrl)}`,
        ),
      );
  }
}

function page(title: string, body: string): string {
  return layout({
    body: `<h1 class="tp-ink" style="margin:28px 0 0;font-family:${SERIF};font-size:28px;font-weight:500;line-height:1.15;letter-spacing:-0.01em;color:${COLORS.ink};">${escapeHtml(title)}</h1>${body}`,
  });
}

function invalidLinkPage(): string {
  return page(
    "That link didn't work",
    paragraph(
      'This unsubscribe link is invalid. Use the link from your most recent digest, or change your delivery settings in Tidepool.',
      12,
    ),
  );
}
