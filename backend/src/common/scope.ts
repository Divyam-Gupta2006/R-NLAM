import { Prisma, RoleName } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';

const NATIONAL: RoleName[] = [RoleName.CENTRAL_ADMIN, RoleName.CENTRAL_OFFICER];

/**
 * Row-level scoping by jurisdiction. Central roles see the nation; state roles
 * their state; district-bound officers their district; citizens only parcels
 * they hold. Applied in every list query so a guessed URL cannot widen access.
 */
export function parcelScope(user: AuthUser): Prisma.ParcelWhereInput {
  if (NATIONAL.includes(user.role)) return {};
  if (user.role === RoleName.CITIZEN) {
    return user.personId ? { holders: { some: { personId: user.personId } } } : { id: '__none__' };
  }
  if (user.districtCode) return { districtCode: user.districtCode };
  if (user.stateCode) return { stateCode: user.stateCode };
  return {};
}

export function projectScope(user: AuthUser): Prisma.ProjectWhereInput {
  if (NATIONAL.includes(user.role)) return {};
  if (user.role === RoleName.CITIZEN) {
    return user.personId ? { parcels: { some: { holders: { some: { personId: user.personId } } } } } : { id: '__none__' };
  }
  if (user.districtCode) return { districtCodes: { has: user.districtCode } };
  if (user.stateCode) return { stateCode: user.stateCode };
  return {};
}

/** Parse ?page=&pageSize= with sane bounds. */
export function paging(page?: string, pageSize?: string): { skip: number; take: number; page: number; pageSize: number } {
  const p = Math.max(1, Number(page) || 1);
  const size = Math.min(500, Math.max(1, Number(pageSize) || 50));
  return { skip: (p - 1) * size, take: size, page: p, pageSize: size };
}
