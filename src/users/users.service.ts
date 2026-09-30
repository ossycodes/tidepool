import { randomBytes } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { latestPostFirst } from '../blogs/blog.response.js';
import { normalizeKeywords } from '../digest/keywords.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpdateSettingsDto } from './dto.js';
import { toUserResponse, type UserResponse } from './user.response.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return toUserResponse(user);
  }

  async updateSettings(
    userId: string,
    dto: UpdateSettingsDto,
  ): Promise<UserResponse> {
    if (dto.mutedKeywords) {
      dto.mutedKeywords = normalizeKeywords(dto.mutedKeywords);
    }
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId },
      data: dto,
    });
    if (count === 0) throw new NotFoundException('User not found');
    return this.get(userId);
  }

  async share(userId: string, reset: boolean): Promise<UserResponse> {
    const user = await this.get(userId);
    if (user.shareId && !reset) return user;
    // 64 random bits: unguessable, and short enough to paste anywhere.
    const shareId = randomBytes(8).toString('base64url');
    await this.prisma.user.update({ where: { id: userId }, data: { shareId } });
    return this.get(userId);
  }

  async unshare(userId: string): Promise<UserResponse> {
    await this.prisma.user.updateMany({
      where: { id: userId },
      data: { shareId: null },
    });
    return this.get(userId);
  }

  /**
   * The public view of a reader's list. Only what's already public about each
   * blog: its own title (never the reader's rename), address and latest post.
   */
  async getShared(shareId: string) {
    const user = await this.prisma.user.findUnique({
      where: { shareId },
      select: {
        subscriptions: {
          select: {
            blog: {
              include: {
                posts: { orderBy: [...latestPostFirst], take: 1 },
              },
            },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('This shared list doesn’t exist');
    const blogs = user.subscriptions
      .map(({ blog }) => {
        const post = blog.posts[0];
        return {
          title: blog.title,
          description: blog.description,
          siteUrl: blog.siteUrl,
          /** The address to follow: the feed, or the page we scrape */
          sourceUrl: blog.sourceUrl,
          latestPost: post
            ? {
                title: post.title,
                url: post.url,
                publishedAt: post.publishedAt ?? post.discoveredAt,
              }
            : null,
        };
      })
      .sort((a, b) =>
        a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }),
      );
    return { blogs };
  }

  async delete(userId: string): Promise<void> {
    await this.prisma.user.deleteMany({ where: { id: userId } });
  }
}
