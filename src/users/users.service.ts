import { Injectable, NotFoundException } from '@nestjs/common';
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
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId },
      data: dto,
    });
    if (count === 0) throw new NotFoundException('User not found');
    return this.get(userId);
  }

  async delete(userId: string): Promise<void> {
    await this.prisma.user.deleteMany({ where: { id: userId } });
  }
}
