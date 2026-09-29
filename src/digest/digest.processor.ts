import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { DIGEST_QUEUE, type DigestJob } from './constants.js';
import { DigestService, type SendResult } from './digest.service.js';

@Processor(DIGEST_QUEUE, { concurrency: 5 })
export class DigestProcessor extends WorkerHost {
  constructor(private readonly digests: DigestService) {
    super();
  }

  // Throws on mail failure so BullMQ retries; send() releases its claim first.
  process(job: Job<DigestJob>): Promise<SendResult> {
    return this.digests.send(job.data.userId);
  }
}
