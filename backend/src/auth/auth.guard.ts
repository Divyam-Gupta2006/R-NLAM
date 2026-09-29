import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleName } from '@prisma/client';
import { IS_PUBLIC_KEY, ROLES_KEY } from './decorators';
import { authMode, AuthUser } from './auth.types';
import { DevTokenService } from './dev-token.service';
import { KeycloakVerifierService } from './keycloak-verifier.service';

/**
 * Global guard, closed by default: every route needs a valid Bearer token unless
 * marked @Public(). Then @Roles(...) is enforced. There is no header-based
 * role override: the role comes only from a verified token.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly devTokens: DevTokenService,
    private readonly keycloak: KeycloakVerifierService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Authentication required');

    let user: AuthUser;
    if (authMode() === 'keycloak') {
      user = await this.keycloak.verify(token);
    } else {
      try {
        user = this.devTokens.verify(token);
      } catch {
        throw new UnauthorizedException('Invalid or expired token');
      }
    }
    request.user = user;

    const required = this.reflector.getAllAndOverride<RoleName[]>(ROLES_KEY, targets);
    if (required?.length && !required.includes(user.role)) {
      throw new ForbiddenException(`Role ${user.role} is not permitted here`);
    }
    return true;
  }
}
