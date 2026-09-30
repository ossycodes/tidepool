import { Global, Module } from '@nestjs/common';
import { AlertsService } from './alerts.service.js';

/** Global so any service can raise an ops alert. */
@Global()
@Module({
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
