import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
} from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/decorators.js';
import { UpdateSettingsDto } from './dto.js';
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

  @Delete()
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthUser) {
    await this.users.delete(user.id);
  }
}
