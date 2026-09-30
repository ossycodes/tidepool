import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { AlertsService, tg } from '../alerts/alerts.service.js';
import { DIGEST_QUEUE, type DigestJob } from './constants.js';
import { DigestService, type SendResult } from './digest.service.js';

@Processor(DIGEST_QUEUE, { concurrency: 5 })
export class DigestProcessor extends WorkerHost {
  constructor(
    private readonly digests: DigestService,
    private readonly alerts: AlertsService,
  ) {
    super();
  }

  // Throws on mail failure so BullMQ retries; send() releases its claim first.
  process(job: Job<DigestJob>): Promise<SendResult> {
    return this.digests.send(job.data.userId);
  }

  /**
   * Alerts once the last retry has failed. Keyed on the error, so a mail
   * outage that fails every reader's digest is one alert, not hundreds.
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job<DigestJob> | undefined, error: Error) {
    if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
    this.alerts.notify(
      `✉️ Digest failed after ${job.attemptsMade} tries (user ${tg(job.data.userId)}):\n${tg(error.message.slice(0, 300))}\n<i>Same error muted for 30 min.</i>`,
      { key: `digest-failed:${error.message}`, cooldownMs: 30 * 60_000 },
    );
  }
}
