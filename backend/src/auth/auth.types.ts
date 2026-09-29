import { RoleName } from '@prisma/client';

/** The authenticated caller, attached to `request.user` by AuthGuard. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: RoleName;
  stateCode: string | null;
  districtCode: string | null;
  personId: string | null;
}

export type AuthMode = 'dev' | 'keycloak';

export function authMode(): AuthMode {
  return process.env.AUTH_MODE === 'keycloak' ? 'keycloak' : 'dev';
}

/** Role groups used by @Roles(...). Admins are included wherever officers are. */
export const R = {
  CENTRAL: [RoleName.CENTRAL_ADMIN, RoleName.CENTRAL_OFFICER],
  STATE: [RoleName.STATE_ADMIN, RoleName.STATE_OFFICER],
  SENIOR: [RoleName.CENTRAL_ADMIN, RoleName.STATE_ADMIN],
  OFFICIALS: [
    RoleName.CENTRAL_ADMIN,
    RoleName.CENTRAL_OFFICER,
    RoleName.STATE_ADMIN,
    RoleName.STATE_OFFICER,
    RoleName.DISTRICT_OFFICER,
    RoleName.PIA_OFFICER,
    RoleName.FIELD_OFFICER,
    RoleName.RR_OFFICER,
    RoleName.FINANCE_OFFICER,
    RoleName.GIS_OFFICER,
  ],
  ACQUISITION: [RoleName.CENTRAL_ADMIN, RoleName.STATE_ADMIN, RoleName.STATE_OFFICER, RoleName.DISTRICT_OFFICER],
  FINANCE: [RoleName.CENTRAL_ADMIN, RoleName.STATE_ADMIN, RoleName.FINANCE_OFFICER, RoleName.DISTRICT_OFFICER],
  RR: [RoleName.CENTRAL_ADMIN, RoleName.STATE_ADMIN, RoleName.RR_OFFICER, RoleName.DISTRICT_OFFICER],
  GIS: [RoleName.CENTRAL_ADMIN, RoleName.STATE_ADMIN, RoleName.GIS_OFFICER, RoleName.DISTRICT_OFFICER],
  FIELD: [RoleName.CENTRAL_ADMIN, RoleName.FIELD_OFFICER, RoleName.DISTRICT_OFFICER],
  PIA: [RoleName.CENTRAL_ADMIN, RoleName.STATE_ADMIN, RoleName.PIA_OFFICER],
} as const satisfies Record<string, readonly RoleName[]>;
