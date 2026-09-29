import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators.js';
import { UsersService } from './users.service.js';

/** A reader's shared reading list: blogs only, never who the reader is. */
@Public()
@Controller('shared')
export class SharedController {
  constructor(private readonly users: UsersService) {}

  @Get(':id')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  get(@Param('id') id: string) {
    return this.users.getShared(id);
  }
}
