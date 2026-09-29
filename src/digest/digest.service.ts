import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { latestPostFirst, toPostResponse } from '../blogs/blog.response.js';
import type { Env } from '../config/env.js';
import type { User } from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { digestEmail } from '../mail/templates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MIN_DIGEST_GAP_MS } from './schedule.js';

/** Old posts that resurface in a feed (e.g. after a redesign) aren't news. */
const STALE_POST_MS = 30 * 24 * 60 * 60_000;
const MAX_POSTS = 200;
const UNSUBSCRIBE_TOKEN_TTL_SECONDS = 10 * 365 * 24 * 60 * 60;

export type SendResult = 'sent' | 'empty' | 'skipped';

interface UnsubscribePayload {
  sub: string;
  typ: 'unsubscribe';
}

export interface DigestSection {
  blog: { id: string; title: string; siteUrl: string };
  posts: ReturnType<typeof toPostResponse>[];
}

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * New posts discovered in (since, until], only from blogs the user followed
   * before the post appeared, grouped by blog.
   */
  async collect(
    userId: string,
    since: Date,
    until: Date,
  ): Promise<DigestSection[]> {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { userId },
      include: { blog: { select: { id: true, title: true, siteUrl: true } } },
    });
    if (subscriptions.length === 0) return [];
    const byBlog = new Map(subscriptions.map((s) => [s.blogId, s]));

    const posts = await this.prisma.post.findMany({
      where: {
        blogId: { in: [...byBlog.keys()] },
        backfill: false,
        discoveredAt: { gt: since, lte: until },
        OR: [
          { publishedAt: null },
          { publishedAt: { gte: new Date(until.getTime() - STALE_POST_MS) } },
        ],
      },
      orderBy: [...latestPostFirst],
      take: MAX_POSTS,
    });

    const sections = new Map<string, DigestSection>();
    for (const post of posts) {
      const subscription = byBlog.get(post.blogId)!;
      if (post.discoveredAt <= subscription.createdAt) continue;
      let section = sections.get(post.blogId);
      if (!section) {
        section = { blog: subscription.blog, posts: [] };
        sections.set(post.blogId, section);
      }
      section.posts.push(toPostResponse(post));
    }
    return [...sections.values()];
  }

  /** What the next digest would contain right now. */
  async preview(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const since = user.lastDigestSentAt ?? user.createdAt;
    return { since, sections: await this.collect(userId, since, new Date()) };
  }

  async history(userId: string) {
    return this.prisma.digest.findMany({
      where: { userId },
      orderBy: { sentAt: 'desc' },
      take: 20,
      select: { id: true, sentAt: true, postCount: true },
    });
  }

  /** Sends this week's digest. Safe to call concurrently and to retry. */
  async send(userId: string): Promise<SendResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.digestEnabled) return 'skipped';

    const now = new Date();
    const previous = user.lastDigestSentAt;
    if (previous && now.getTime() - previous.getTime() < MIN_DIGEST_GAP_MS) {
      return 'skipped';
    }

    // Claim the week with a compare-and-set so two workers can't both send.
    const claimed = await this.prisma.user.updateMany({
      where: { id: userId, lastDigestSentAt: previous },
      data: { lastDigestSentAt: now },
    });
    if (claimed.count === 0) return 'skipped';

    const sections = await this.collect(userId, previous ?? user.createdAt, now);
    if (sections.length === 0) return 'empty';

    try {
      await this.deliver(user, sections);
    } catch (err) {
      // Release the claim so the job's retry can send it.
      await this.prisma.user.updateMany({
        where: { id: userId, lastDigestSentAt: now },
        data: { lastDigestSentAt: previous },
      });
      throw err;
    }

    const postIds = sections.flatMap((s) => s.posts.map((p) => p.id));
    await this.prisma.digest.create({
      data: {
        userId,
        sentAt: now,
        postCount: postIds.length,
        items: { create: postIds.map((postId) => ({ postId })) },
      },
    });
    this.logger.log(`Sent digest to ${userId} (${postIds.length} posts)`);
    return 'sent';
  }

  /** Emails the current preview to the user without affecting their schedule. */
  async sendTest(userId: string): Promise<{ sent: boolean; postCount: number }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const { sections } = await this.preview(userId);
    const postCount = sections.reduce((n, s) => n + s.posts.length, 0);
    if (postCount === 0) return { sent: false, postCount };
    await this.deliver(user, sections);
    return { sent: true, postCount };
  }

  /** Returns the user id, or null for an invalid token. */
  async unsubscribe(token: string): Promise<string | null> {
    let payload: UnsubscribePayload;
    try {
      payload = await this.jwt.verifyAsync<UnsubscribePayload>(token);
    } catch {
      return null;
    }
    if (payload.typ !== 'unsubscribe') return null;
    await this.prisma.user.updateMany({
      where: { id: payload.sub },
      data: { digestEnabled: false },
    });
    return payload.sub;
  }

  async verifyUnsubscribeToken(token: string): Promise<boolean> {
    try {
      const payload = await this.jwt.verifyAsync<UnsubscribePayload>(token);
      return payload.typ === 'unsubscribe';
    } catch {
      return false;
    }
  }

  private async deliver(user: User, sections: DigestSection[]) {
    const payload: UnsubscribePayload = { sub: user.id, typ: 'unsubscribe' };
    const token = await this.jwt.signAsync(payload, {
      expiresIn: UNSUBSCRIBE_TOKEN_TTL_SECONDS,
    });
    const unsubscribeUrl = new URL(
      '/digests/unsubscribe',
      this.config.get('APP_URL', { infer: true }),
    );
    unsubscribeUrl.searchParams.set('token', token);
    const settingsUrl = new URL(
      '/settings',
      this.config.get('FRONTEND_URL', { infer: true }),
    ).toString();

    await this.mail.send({
      to: user.email,
      ...digestEmail({
        sections: sections.map((s) => ({
          blogTitle: s.blog.title,
          siteUrl: s.blog.siteUrl,
          posts: s.posts,
        })),
        timezone: user.timezone,
        settingsUrl,
        unsubscribeUrl: unsubscribeUrl.toString(),
      }),
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl.toString()}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
  }
}
