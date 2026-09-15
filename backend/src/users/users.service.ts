import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      include: {
        organization: true,
        jurisdiction: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { organization: true, jurisdiction: true },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }
    return user;
  }

  async create(data: { email: string; name: string; role: any; organizationId?: string; jurisdictionId?: string }) {
    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: data.role,
        organizationId: data.organizationId || null,
        jurisdictionId: data.jurisdictionId || null,
      },
    });
  }
}

