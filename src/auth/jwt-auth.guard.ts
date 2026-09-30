import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC, type AuthenticatedRequest } from '../common/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AccessTokenPayload } from './auth.service.js';

/**
 * Global guard: every route needs a Bearer access token unless @Public().
 * The token must also still be current: the account exists and its
 * tokenVersion hasn't moved on ("Sign out everywhere" bumps it).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }
    // Other signed tokens (e.g. unsubscribe links) must not work as logins.
    if (payload.typ !== 'access') throw new UnauthorizedException();

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { tokenVersion: true },
    });
    // Deleted accounts and signed-out-everywhere sessions stop working.
    if (!user || (payload.ver ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException();
    }

    request.user = { id: payload.sub };
    return true;
  }
}
