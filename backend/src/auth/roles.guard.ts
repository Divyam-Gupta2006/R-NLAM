import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleName } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';
import { KeycloakVerifierService } from './keycloak-verifier.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private keycloakVerifier: KeycloakVerifierService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<RoleName[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    let userRole: RoleName | undefined = undefined;

    // 1. Try Keycloak RS256 Bearer Token verification
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const verified = await this.keycloakVerifier.verifyToken(token);
        request.user = verified.user;
        userRole = verified.role;
      } catch (err: any) {
        throw new UnauthorizedException(`Keycloak authentication error: ${err.message}`);
      }
    }

    // 2. Dev Persona Mode Handling
    const isDevAuthAllowed = process.env.ENABLE_DEV_AUTH !== 'false' && process.env.NODE_ENV !== 'production';
    const headerRole = request.headers['x-user-role'] as RoleName | undefined;

    if (!userRole) {
      if (headerRole && isDevAuthAllowed) {
        userRole = headerRole;
      } else if (!isDevAuthAllowed) {
        throw new UnauthorizedException('Production authentication required. Valid Keycloak Bearer JWT token is missing.');
      }
    }

    // If endpoint has no specific role requirements, allow if identity resolved or public
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Fail closed if no role claim or identity present
    if (!userRole) {
      throw new UnauthorizedException('Authentication required. Missing user role identity.');
    }

    // Enforce Role RBAC
    const hasRole = requiredRoles.includes(userRole);
    if (!hasRole) {
      throw new ForbiddenException(`User role '${userRole}' lacks permission. Required: [${requiredRoles.join(', ')}]`);
    }

    return true;
  }
}
