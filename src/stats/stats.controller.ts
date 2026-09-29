import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators.js';
import { StatsService } from './stats.service.js';

/** Tidepool in the open: aggregate numbers only, no emails or IDs. */
@Public()
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  get() {
    return this.stats.get();
  }
}
