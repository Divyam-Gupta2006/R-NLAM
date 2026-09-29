import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PossessionStatus } from '@prisma/client';
import { IsDateString, IsLatitude, IsLongitude, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { Clock } from '../common/clock';
import { parcelScope } from '../common/scope';
import { LifecycleService } from '../lifecycle/lifecycle.service';
import { PrismaService } from '../prisma/prisma.service';

class TakePossessionDto {
  @ApiPropertyOptional({ example: '2026-10-20' }) @IsOptional() @IsDateString() takenOn?: string;
  @ApiPropertyOptional() @IsOptional() @IsLatitude() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsLongitude() longitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) remarks?: string;
}

@ApiTags('possession')
@ApiBearerAuth()
@Roles(...R.OFFICIALS)
@Controller('possession')
export class PossessionController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: LifecycleService,
    private readonly clock: Clock,
  ) {}

  @Get()
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: PossessionStatus })
  list(@CurrentUser() user: AuthUser, @Query('projectId') projectId?: string, @Query('status') status?: PossessionStatus) {
    return this.prisma.possession.findMany({
      where: { projectId, status, parcel: parcelScope(user) },
      include: { parcel: { select: { id: true, parcelNumber: true, surveyNumber: true, villageName: true, districtName: true, totalAreaHa: true, stage: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Take possession under s.38. The parcel guard enforces full payment and
   * delivered R&R entitlements; GIS consent gates (6.3) add further guards.
   */
  @Post(':parcelId/take')
  @HttpCode(200)
  @Roles(...R.FIELD, 'STATE_ADMIN')
  @ApiOperation({ summary: 'Take possession of a parcel (s.38). 409 with blockers if payment, R&R or consent is incomplete.' })
  take(@CurrentUser() user: AuthUser, @Param('parcelId') parcelId: string, @Body() dto: TakePossessionDto) {
    const takenOn = dto.takenOn ? new Date(dto.takenOn) : this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      const parcel = await tx.parcel.findUniqueOrThrow({ where: { id: parcelId } });
      const possession = await tx.possession.upsert({
        where: { parcelId },
        create: { parcelId, projectId: parcel.projectId },
        update: {},
      });
      await this.lifecycle.transitionInTx(tx, {
        entityType: 'Parcel',
        entityId: parcelId,
        event: 'TAKE_POSSESSION',
        actor: user,
        fromDomainService: true,
        reason: dto.remarks,
        context: { takenOn },
      });
      return this.lifecycle.transitionInTx(tx, {
        entityType: 'Possession',
        entityId: possession.id,
        event: 'TAKE',
        actor: user,
        fromDomainService: true,
        data: { takenOn, latitude: dto.latitude, longitude: dto.longitude, remarks: dto.remarks, authority: user.name },
      });
    });
  }

  @Post(':parcelId/handover')
  @HttpCode(200)
  @Roles(...R.ACQUISITION)
  @ApiOperation({ summary: 'Hand the parcel over to the requiring body' })
  handover(@CurrentUser() user: AuthUser, @Param('parcelId') parcelId: string) {
    return this.prisma.$transaction(async (tx) => {
      const possession = await tx.possession.findUniqueOrThrow({ where: { parcelId } });
      await this.lifecycle.transitionInTx(tx, { entityType: 'Parcel', entityId: parcelId, event: 'HAND_OVER', actor: user, fromDomainService: true });
      return this.lifecycle.transitionInTx(tx, {
        entityType: 'Possession',
        entityId: possession.id,
        event: 'HAND_OVER',
        actor: user,
        fromDomainService: true,
        data: { handedOverOn: this.clock.now() },
      });
    });
  }
}
