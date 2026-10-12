import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { HttpClient } from '../common/http-client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { articleContent } from './article.js';
import { ARTICLE_QUEUE } from './library.service.js';

@Processor(ARTICLE_QUEUE, { concurrency: 2 })
export class ArticleProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpClient,
  ) {
    super();
  }
  async process(job: Job<{ postId: string }>) {
    const post = await this.prisma.post.findUnique({
      where: { id: job.data.postId },
      include: { content: true },
    });
    if (!post || post.content) return;
    let content: ReturnType<typeof articleContent> | undefined;
    if (post.feedContent) {
      try {
        content = articleContent(post.feedContent, post.url, true);
      } catch {
        /* Fall back to the source page. */
      }
    }
    if (!content) {
      const page = await this.http.get(post.url);
      content = articleContent(page.body, page.url);
    }
    await this.prisma.articleContent.upsert({
      where: { postId: post.id },
      create: { postId: post.id, ...content },
      update: {},
    });
  }
}
