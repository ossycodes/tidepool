import { Module } from '@nestjs/common';
import { SharedController } from './shared.controller.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController, SharedController],
  providers: [UsersService],
})
export class UsersModule {}
