import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as jwksRsa from 'jwks-rsa';
import { PrismaService } from '../prisma/prisma.service';
import { RoleName } from '@prisma/client';

@Injectable()
export class KeycloakVerifierService {
  private readonly logger = new Logger(KeycloakVerifierService.name);
  private jwksClientInstance: jwksRsa.JwksClient;
  private jwksUri: string;
  private issuer: string;

  constructor(private prisma: PrismaService) {
    this.jwksUri = process.env.KEYCLOAK_JWKS_URI || 'http://localhost:8085/realms/master/protocol/openid-connect/certs';
    this.issuer = process.env.KEYCLOAK_ISSUER || 'http://localhost:8085/realms/master';
    
    this.jwksClientInstance = jwksRsa({
      jwksUri: this.jwksUri,
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
  }

  private getKey = (header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) => {
    if (!header.kid) {
      return callback(new Error('JWT Header missing kid (key id)'));
    }
    this.jwksClientInstance.getSigningKey(header.kid, (err, key) => {
      if (err) return callback(err);
      const signingKey = key?.getPublicKey();
      callback(null, signingKey);
    });
  };

  async verifyToken(token: string): Promise<{ user: any; role: RoleName }> {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        this.getKey,
        {
          algorithms: ['RS256'],
          issuer: [this.issuer, 'http://localhost:8085/realms/master', 'http://localhost:8085/realms/rnlam'],
        },
        async (err, decoded: any) => {
          if (err) {
            this.logger.error(`Keycloak RS256 token verification failed: ${err.message}`);
            return reject(new UnauthorizedException(`Keycloak authentication failed: ${err.message}`));
          }

          // Check expiration
          const nowSeconds = Math.floor(Date.now() / 1000);
          if (decoded.exp && decoded.exp < nowSeconds) {
            return reject(new UnauthorizedException('Keycloak JWT token has expired.'));
          }

          // Extract identity & role
          const username = decoded.preferred_username || decoded.sub;
          const email = decoded.email || (username.includes('@') ? username : `${username}@rnlam.gov.in`);

          // Attempt database lookup for user & role
          let dbUser = await this.prisma.user.findFirst({
            where: {
              OR: [
                { email },
                { email: { contains: username, mode: 'insensitive' } },
              ],
            },
          });

          // Role mapping from Keycloak realm roles or fallback to user role in DB
          let assignedRole: RoleName = RoleName.CITIZEN;
          if (dbUser) {
            assignedRole = dbUser.role;
          } else {
            const kcRoles: string[] = decoded.realm_access?.roles || [];
            if (kcRoles.includes('admin') || kcRoles.includes('CENTRAL_ADMIN')) {
              assignedRole = RoleName.CENTRAL_ADMIN;
            } else if (kcRoles.includes('STATE_OFFICER')) {
              assignedRole = RoleName.STATE_OFFICER;
            } else if (kcRoles.includes('DISTRICT_OFFICER')) {
              assignedRole = RoleName.DISTRICT_OFFICER;
            } else if (kcRoles.includes('PIA_OFFICER')) {
              assignedRole = RoleName.PIA_OFFICER;
            } else if (kcRoles.includes('FIELD_OFFICER')) {
              assignedRole = RoleName.FIELD_OFFICER;
            } else if (kcRoles.includes('FINANCE_OFFICER')) {
              assignedRole = RoleName.FINANCE_OFFICER;
            } else if (kcRoles.includes('RR_OFFICER')) {
              assignedRole = RoleName.RR_OFFICER;
            } else if (kcRoles.includes('GIS_OFFICER')) {
              assignedRole = RoleName.GIS_OFFICER;
            }
          }

          resolve({
            user: {
              id: dbUser?.id || decoded.sub,
              email: email,
              name: dbUser?.name || username,
              role: assignedRole,
              keycloakSub: decoded.sub,
            },
            role: assignedRole,
          });
        },
      );
    });
  }
}

