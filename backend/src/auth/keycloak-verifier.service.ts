import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import type { JwksClient } from 'jwks-rsa';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './auth.types';

/**
 * AUTH_MODE=keycloak: verify RS256 tokens against the realm's JWKS. The user's
 * role and jurisdiction come from our database (matched by email); a token for
 * an unknown user is rejected rather than defaulted to some role.
 */
@Injectable()
export class KeycloakVerifierService {
  private readonly logger = new Logger(KeycloakVerifierService.name);
  private readonly issuer = process.env.KEYCLOAK_ISSUER || 'http://localhost:8085/realms/rnlam';
  private jwksClient: JwksClient | null = null;

  /** Loaded lazily: only Keycloak mode needs it (and its ESM dependency). */
  private jwks(): JwksClient {
    if (!this.jwksClient) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const jwksRsa = require('jwks-rsa') as typeof import('jwks-rsa');
      this.jwksClient = jwksRsa({
        jwksUri: process.env.KEYCLOAK_JWKS_URI || `${this.issuer}/protocol/openid-connect/certs`,
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
      });
    }
    return this.jwksClient;
  }

  constructor(private readonly prisma: PrismaService) {}

  private getKey: jwt.GetPublicKeyOrSecret = (header, callback) => {
    if (!header.kid) return callback(new Error('JWT header has no kid'));
    this.jwks().getSigningKey(header.kid, (err, key) => callback(err, key?.getPublicKey()));
  };

  async verify(token: string): Promise<AuthUser> {
    const claims = await new Promise<jwt.JwtPayload>((resolve, reject) => {
      jwt.verify(token, this.getKey, { algorithms: ['RS256'], issuer: this.issuer }, (err, decoded) => {
        if (err || !decoded || typeof decoded === 'string') return reject(err ?? new Error('bad token'));
        resolve(decoded);
      });
    }).catch((err: Error) => {
      this.logger.warn(`Keycloak token rejected: ${err.message}`);
      throw new UnauthorizedException('Invalid or expired token');
    });

    const email = String(claims.email ?? claims.preferred_username ?? '');
    const user = await this.prisma.user.findUnique({ where: { email }, include: { jurisdiction: true } });
    if (!user || !user.active) throw new UnauthorizedException('User is not registered in R-NLAM');

    return toAuthUser(user);
  }
}

export function toAuthUser(user: {
  id: string;
  email: string;
  name: string;
  role: RoleName;
  personId: string | null;
  jurisdiction: { level: string; code: string; stateCode: string } | null;
}): AuthUser {
  const j = user.jurisdiction;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    personId: user.personId,
    stateCode: j?.stateCode ?? null,
    districtCode: j && j.level === 'DISTRICT' ? j.code : null,
  };
}
