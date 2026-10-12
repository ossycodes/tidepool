import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiService } from './ai.service.js';
import { ArticleProcessor } from './article.processor.js';
import { LibraryController } from './library.controller.js';
import { ARTICLE_QUEUE, LibraryService } from './library.service.js';
@Module({
  imports: [BullModule.registerQueue({ name: ARTICLE_QUEUE })],
  providers: [LibraryService, AiService, ArticleProcessor],
  controllers: [LibraryController],
})
export class LibraryModule {}
