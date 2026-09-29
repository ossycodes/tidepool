import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DIGEST_QUEUE } from './constants.js';
import { DigestController } from './digest.controller.js';
import { DigestProcessor } from './digest.processor.js';
import { DigestScheduler } from './digest.scheduler.js';
import { DigestService } from './digest.service.js';

@Module({
  imports: [BullModule.registerQueue({ name: DIGEST_QUEUE })],
  controllers: [DigestController],
  providers: [DigestService, DigestScheduler, DigestProcessor],
})
export class DigestModule {}
