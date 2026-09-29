import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { AuthUser } from './auth.types';

export const IS_PUBLIC_KEY = 'isPublic';
/** Opt a route out of authentication. Everything else requires a valid token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** Restrict a route to these roles (on top of authentication). */
export const Roles = (...roles: readonly RoleName[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user as AuthUser;
});
