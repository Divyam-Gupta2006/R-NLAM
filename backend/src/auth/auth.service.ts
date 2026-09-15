import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleName } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async validateUser(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { organization: true, jurisdiction: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    return user;
  }

  async login(email: string) {
    const user = await this.validateUser(email);
    const token = `rnlam_jwt_${user.id}_${Date.now()}`;

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organization: user.organization?.name || null,
        jurisdiction: user.jurisdiction?.stateName || null,
      },
    };
  }
}
