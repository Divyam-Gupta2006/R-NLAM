import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { authMode, AuthUser } from './auth.types';
import { DevTokenService } from './dev-token.service';
import { toAuthUser } from './keycloak-verifier.service';

interface PendingOtp {
  userId: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
}

@Injectable()
export class AuthService {
  /** In-memory OTP store: fine for a single dev process; use Redis for more. */
  private readonly otps = new Map<string, PendingOtp>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly devTokens: DevTokenService,
  ) {}

  private assertDevMode() {
    if (authMode() !== 'dev' || process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Dev login is disabled (AUTH_MODE is not dev)');
    }
  }

  /** Demo personas for the role switcher: one active user per role. */
  async personas() {
    this.assertDevMode();
    const users = await this.prisma.user.findMany({
      where: { active: true, email: { endsWith: '@demo.rnlam.in' } },
      include: { jurisdiction: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    return users.map((u) => ({
      email: u.email,
      name: u.name,
      role: u.role,
      designation: u.designation,
      jurisdiction: u.jurisdiction ? `${u.jurisdiction.name} (${u.jurisdiction.level.toLowerCase()})` : 'National',
    }));
  }

  async devLogin(email: string) {
    this.assertDevMode();
    const user = await this.prisma.user.findUnique({ where: { email }, include: { jurisdiction: true } });
    if (!user || !user.active) throw new NotFoundException('No active user with that email');
    return this.issue(toAuthUser(user));
  }

  /** Citizen login step 1. In dev mode the OTP is returned so the demo needs no SMS gateway. */
  async requestOtp(phone: string) {
    const user = await this.prisma.user.findFirst({
      where: { phone, role: RoleName.CITIZEN, active: true },
    });
    const requestId = crypto.randomUUID();
    const code = crypto.randomInt(100000, 1000000).toString();
    // Respond identically whether or not the number is registered (no enumeration).
    if (user) {
      this.otps.set(requestId, {
        userId: user.id,
        codeHash: crypto.createHash('sha256').update(code).digest('hex'),
        expiresAt: Date.now() + 5 * 60 * 1000,
        attempts: 0,
      });
    }
    return {
      requestId,
      expiresInSeconds: 300,
      ...(authMode() === 'dev' && process.env.NODE_ENV !== 'production'
        ? { devOtp: user ? code : null, note: 'DEV MODE: no SMS is sent; the code is shown here.' }
        : {}),
    };
  }

  async verifyOtp(requestId: string, code: string) {
    const pending = this.otps.get(requestId);
    if (!pending || pending.expiresAt < Date.now()) throw new UnauthorizedException('OTP expired or unknown');
    pending.attempts += 1;
    const ok = crypto.timingSafeEqual(
      Buffer.from(pending.codeHash),
      Buffer.from(crypto.createHash('sha256').update(code).digest('hex')),
    );
    if (!ok) {
      if (pending.attempts >= 5) this.otps.delete(requestId);
      throw new UnauthorizedException('Incorrect OTP');
    }
    this.otps.delete(requestId);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: pending.userId }, include: { jurisdiction: true } });
    return this.issue(toAuthUser(user));
  }

  private issue(user: AuthUser) {
    const { token, expiresAt } = this.devTokens.sign(user);
    return { token, expiresAt, user };
  }
}
