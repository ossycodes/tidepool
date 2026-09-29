import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, type AuthUser } from '../common/decorators.js';
import { BlogsService } from './blogs.service.js';
import { AddBlogDto, ListPostsQuery, UpdateBlogDto } from './dto.js';

@Controller('blogs')
export class BlogsController {
  constructor(private readonly blogs: BlogsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.blogs.list(user.id);
  }

  /** Discovery fetches remote pages, so this is throttled harder. */
  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  add(@CurrentUser() user: AuthUser, @Body() dto: AddBlogDto) {
    return this.blogs.subscribe(user.id, dto.url);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.blogs.get(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateBlogDto,
  ) {
    return this.blogs.update(user.id, id, dto);
  }

  @Get(':id/posts')
  posts(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() query: ListPostsQuery,
  ) {
    return this.blogs.posts(user.id, id, query.limit);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.blogs.unsubscribe(user.id, id);
  }
}
