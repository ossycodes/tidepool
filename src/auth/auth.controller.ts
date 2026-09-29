import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators.js';
import { AuthService } from './auth.service.js';
import { RequestMagicLinkDto, VerifyMagicLinkDto } from './dto.js';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('magic-link')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async requestMagicLink(@Body() dto: RequestMagicLinkDto) {
    await this.auth.requestMagicLink(dto.email);
    return { ok: true };
  }

  @Post('verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verify(@Body() dto: VerifyMagicLinkDto) {
    return this.auth.verifyMagicLink(dto.token, dto.timezone);
  }
}
