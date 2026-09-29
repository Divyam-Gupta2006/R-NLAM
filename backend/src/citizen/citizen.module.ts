import { Controller, ForbiddenException, Get, Module } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('citizen')
@Controller('citizen')
class CitizenController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('projects')
  @ApiOperation({ summary: 'Public list of acquisition projects (no personal data)' })
  projects() {
    return this.prisma.project.findMany({
      where: { status: { in: ['APPROVED', 'ACTIVE', 'COMPLETED'] } },
      select: { id: true, code: true, name: true, sector: true, stateName: true, districtNames: true, status: true, requiredAreaHa: true, piaName: true, isSynthetic: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * The citizen's own digital twin: every parcel they hold, its stage, notices,
   * award breakdown, their compensation lines, R&R entitlements, objections and
   * hearings. Only rows linked to the caller's person record are returned.
   */
  @ApiBearerAuth()
  @Roles(RoleName.CITIZEN)
  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    if (!user.personId) throw new ForbiddenException('Account is not linked to a land holder');
    const person = await this.prisma.person.findUniqueOrThrow({ where: { id: user.personId } });
    const holdings = await this.prisma.parcelHolder.findMany({
      where: { personId: user.personId },
      include: {
        parcel: {
          include: {
            project: { select: { id: true, code: true, name: true, sector: true, piaName: true } },
            village: { select: { name: true, nameLocal: true } },
            notices: { orderBy: { publishedOn: 'asc' } },
            awards: { orderBy: { awardDate: 'desc' } },
            compensations: { where: { personId: user.personId }, include: { paymentReferences: true } },
            objections: { include: { hearings: { orderBy: { scheduledAt: 'asc' } } } },
            possessions: true,
          },
        },
      },
    });
    const families = await this.prisma.rRCase.findMany({
      where: { parcel: { holders: { some: { personId: user.personId } } } },
      include: { family: true, grants: { include: { entitlement: true } } },
    });
    return {
      person: { name: person.name, fatherName: person.fatherName, villageCode: person.villageCode },
      holdings: holdings.map((h) => ({ sharePct: h.sharePct, nameAsRecorded: h.nameAsRecorded, parcel: h.parcel })),
      rrCases: families,
    };
  }
}

@Module({ controllers: [CitizenController] })
export class CitizenModule {}
