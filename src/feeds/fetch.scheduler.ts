import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import { FETCH_QUEUE, type FetchJob } from './constants.js';

const BATCH_SIZE = 500;
/** Pushes nextFetchAt forward while a job is queued; the processor sets the real value. */
const LEASE_MS = 30 * 60_000;

@Injectable()
export class FetchScheduler {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(FETCH_QUEUE) private readonly queue: Queue<FetchJob>,
  ) {}

  /** Queues every blog that is due and still has at least one subscriber. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async enqueueDueBlogs(): Promise<number> {
    const now = new Date();
    const due = await this.prisma.blog.findMany({
      where: { nextFetchAt: { lte: now }, subscriptions: { some: {} } },
      select: { id: true },
      orderBy: { nextFetchAt: 'asc' },
      take: BATCH_SIZE,
    });
    if (due.length === 0) return 0;

    const ids = due.map((blog) => blog.id);
    await this.prisma.blog.updateMany({
      where: { id: { in: ids } },
      data: { nextFetchAt: new Date(now.getTime() + LEASE_MS) },
    });
    // A fixed jobId dedupes against a job for the same blog that's still queued.
    await this.queue.addBulk(
      ids.map((blogId) => ({
        name: 'refresh',
        data: { blogId },
        opts: {
          jobId: `refresh-${blogId}`,
          removeOnComplete: true,
          removeOnFail: 100,
        },
      })),
    );
    return ids.length;
  }
}
