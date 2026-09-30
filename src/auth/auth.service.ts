import { createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Env } from '../config/env.js';
import { MailService } from '../mail/mail.service.js';
import { magicLinkEmail } from '../mail/templates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toUserResponse, type UserResponse } from '../users/user.response.js';

/** Per-email cap on sign-in links, on top of the per-IP HTTP throttle. */
const MAX_LINKS_PER_WINDOW = 5;
const LINK_WINDOW_MS = 15 * 60_000;

export interface AccessTokenPayload {
  sub: string;
  typ: 'access';
  /** User.tokenVersion at sign-in; tokens from before it existed count as 0 */
  ver?: number;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Always resolves the same way whether or not the email has an account. */
  async requestMagicLink(rawEmail: string): Promise<void> {
    const email = rawEmail.trim().toLowerCase();

    const recent = await this.prisma.loginToken.count({
      where: {
        email,
        createdAt: { gt: new Date(Date.now() - LINK_WINDOW_MS) },
      },
    });
    if (recent >= MAX_LINKS_PER_WINDOW) {
      this.logger.warn(`Magic-link limit reached for ${email}`);
      return;
    }

    const token = randomBytes(32).toString('base64url');
    const ttlMinutes = this.config.get('MAGIC_LINK_TTL_MINUTES', {
      infer: true,
    });
    await this.prisma.loginToken.create({
      data: {
        email,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      },
    });

    const link = new URL(
      '/auth/callback',
      this.config.get('FRONTEND_URL', { infer: true }),
    );
    link.searchParams.set('token', token);
    await this.mail.send({
      to: email,
      ...magicLinkEmail(link.toString(), ttlMinutes),
    });
  }

  async verifyMagicLink(
    token: string,
    timezone?: string,
  ): Promise<{ accessToken: string; user: UserResponse }> {
    const invalid = new UnauthorizedException(
      'This sign-in link is invalid or has expired',
    );
    const now = new Date();

    const record = await this.prisma.loginToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!record || record.usedAt || record.expiresAt <= now) throw invalid;

    // Conditional update so two concurrent clicks can't both succeed.
    const claimed = await this.prisma.loginToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: now },
    });
    if (claimed.count === 0) throw invalid;

    const user = await this.prisma.user.upsert({
      where: { email: record.email },
      create: { email: record.email, ...(timezone && { timezone }) },
      update: {},
    });

    const payload: AccessTokenPayload = {
      sub: user.id,
      typ: 'access',
      ver: user.tokenVersion,
    };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, user: toUserResponse(user) };
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredTokens() {
    const { count } = await this.prisma.loginToken.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) } },
    });
    if (count) this.logger.log(`Purged ${count} expired login tokens`);
  }
}
