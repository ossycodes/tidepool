import { Module } from '@nestjs/common';
import { FeedsModule } from '../feeds/feeds.module.js';
import { BlogsController } from './blogs.controller.js';
import { BlogsService } from './blogs.service.js';

@Module({
  imports: [FeedsModule],
  controllers: [BlogsController],
  providers: [BlogsService],
})
export class BlogsModule {}
