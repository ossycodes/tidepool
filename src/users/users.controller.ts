import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/decorators.js';
import { ShareDto, UpdateSettingsDto } from './dto.js';
import { UsersService } from './users.service.js';

@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.users.get(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto) {
    return this.users.updateSettings(user.id, dto);
  }

  /** Turns on the public reading list (or, with `reset`, issues a new link). */
  @Post('share')
  @HttpCode(200)
  share(@CurrentUser() user: AuthUser, @Body() dto: ShareDto) {
    return this.users.share(user.id, dto.reset ?? false);
  }

  @Delete('share')
  @HttpCode(200)
  unshare(@CurrentUser() user: AuthUser) {
    return this.users.unshare(user.id);
  }

  @Delete()
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthUser) {
    await this.users.delete(user.id);
  }
}
