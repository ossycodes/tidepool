import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { FETCH_QUEUE } from './constants.js';
import { DiscoveryService } from './discovery.service.js';
import { FetchProcessor } from './fetch.processor.js';
import { FetchScheduler } from './fetch.scheduler.js';
import { IngestService } from './ingest.service.js';

@Module({
  imports: [BullModule.registerQueue({ name: FETCH_QUEUE })],
  providers: [DiscoveryService, IngestService, FetchScheduler, FetchProcessor],
  exports: [DiscoveryService, IngestService],
})
export class FeedsModule {}
