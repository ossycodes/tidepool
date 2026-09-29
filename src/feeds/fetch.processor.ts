import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { FETCH_QUEUE, type FetchJob } from './constants.js';
import { IngestService, type RefreshResult } from './ingest.service.js';

@Processor(FETCH_QUEUE, { concurrency: 10 })
export class FetchProcessor extends WorkerHost {
  constructor(private readonly ingest: IngestService) {
    super();
  }

  // Failures are recorded on the blog and retried via nextFetchAt backoff,
  // so the job itself never throws.
  process(job: Job<FetchJob>): Promise<RefreshResult> {
    return this.ingest.refresh(job.data.blogId);
  }
}
