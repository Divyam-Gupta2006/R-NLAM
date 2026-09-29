import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { AuthUser } from './auth.types';

const ISSUER = 'rnlam-dev';
const TTL_SECONDS = 12 * 60 * 60;

/**
 * AUTH_MODE=dev: the backend signs its own HS256 JWTs carrying the same claims
 * Keycloak would. Lets the demo run without Keycloak's ~700 MB of RAM.
 * Never enabled when NODE_ENV=production.
 */
@Injectable()
export class DevTokenService {
  private readonly logger = new Logger(DevTokenService.name);
  private readonly secret: string;

  constructor() {
    const configured = process.env.DEV_JWT_SECRET;
    if (configured && configured.length >= 32) {
      this.secret = configured;
    } else {
      // Tokens then stop working after a restart, which is fine for dev.
      this.secret = crypto.randomBytes(32).toString('hex');
      this.logger.warn('DEV_JWT_SECRET not set (or < 32 chars); using a per-process random secret.');
    }
  }

  sign(user: AuthUser): { token: string; expiresAt: string } {
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        st: user.stateCode,
        dt: user.districtCode,
        pid: user.personId,
      },
      this.secret,
      { algorithm: 'HS256', issuer: ISSUER, expiresIn: TTL_SECONDS },
    );
    return { token, expiresAt: new Date(Date.now() + TTL_SECONDS * 1000).toISOString() };
  }

  /** Returns the claims, or throws if the signature, issuer or expiry is wrong. */
  verify(token: string): AuthUser {
    const c = jwt.verify(token, this.secret, { algorithms: ['HS256'], issuer: ISSUER }) as jwt.JwtPayload;
    return {
      id: String(c.sub),
      email: String(c.email),
      name: String(c.name),
      role: c.role,
      stateCode: c.st ?? null,
      districtCode: c.dt ?? null,
      personId: c.pid ?? null,
    };
  }
}
