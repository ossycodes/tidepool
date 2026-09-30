import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import { DIGEST_QUEUE, type DigestJob } from './constants.js';
import { isDigestDue, SHORTEST_GAP_MS } from './schedule.js';

const BATCH_SIZE = 500;

@Injectable()
export class DigestScheduler {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(DIGEST_QUEUE) private readonly queue: Queue<DigestJob>,
  ) {}

  /** Queues a digest for every user whose local delivery hour is now. */
  @Cron('*/15 * * * *')
  async enqueueDueDigests(): Promise<string[]> {
    const now = new Date();
    // Exact per-frequency gaps are checked by isDigestDue below.
    const cutoff = new Date(now.getTime() - SHORTEST_GAP_MS);
    const day = now.toISOString().slice(0, 10);
    const queued: string[] = [];

    let cursor: string | undefined;
    for (;;) {
      const users = await this.prisma.user.findMany({
        where: {
          digestEnabled: true,
          subscriptions: { some: {} },
          OR: [
            { lastDigestSentAt: null },
            { lastDigestSentAt: { lte: cutoff } },
          ],
        },
        select: {
          id: true,
          digestFrequency: true,
          digestDay: true,
          digestHour: true,
          timezone: true,
          lastDigestSentAt: true,
        },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      });
      if (users.length === 0) break;

      const due = users.filter((user) => isDigestDue(user, now));
      if (due.length) {
        // One job per user per day: the 15-minute ticks within the hour dedupe.
        await this.queue.addBulk(
          due.map((user) => ({
            name: 'send',
            data: { userId: user.id },
            opts: {
              jobId: `digest-${user.id}-${day}`,
              attempts: 3,
              backoff: { type: 'exponential', delay: 60_000 },
              removeOnComplete: { age: 2 * 24 * 60 * 60 },
              removeOnFail: { age: 7 * 24 * 60 * 60 },
            },
          })),
        );
        queued.push(...due.map((user) => user.id));
      }

      if (users.length < BATCH_SIZE) break;
      cursor = users[users.length - 1].id;
    }
    return queued;
  }
}
