import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ObjectionStatus, ParcelStage, RoleName } from '@prisma/client';
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { parcelScope } from '../common/scope';
import { LifecycleService } from '../lifecycle/lifecycle.service';
import { PrismaService } from '../prisma/prisma.service';

const CATEGORIES = ['COMPENSATION_AMOUNT', 'MEASUREMENT', 'TITLE', 'PUBLIC_PURPOSE', 'RR_ENTITLEMENT', 'OTHER'] as const;

class FileObjectionDto {
  @ApiProperty() @IsUUID() parcelId: string;
  @ApiProperty({ example: 'Ramesh Patil' }) @IsString() @Length(2, 120) applicant: string;
  @ApiProperty({ enum: CATEGORIES }) @IsIn(CATEGORIES) category: (typeof CATEGORIES)[number];
  @ApiProperty() @IsString() @Length(10, 4000) description: string;
}

class ScheduleHearingDto {
  @ApiProperty({ example: '2026-11-05T11:00:00+05:30' }) @IsDateString() scheduledAt: string;
  @ApiProperty({ example: 'Collectorate Hall 2, Wardha' }) @IsString() @Length(3, 200) venue: string;
  @ApiProperty({ example: 'Dy. Collector (LA), Wardha' }) @IsString() @Length(3, 120) presidingOfficer: string;
}

class HearingOutcomeDto {
  @ApiProperty({ description: 'true = hearing held; false = adjourned' }) @IsBoolean() held: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) outcome?: string;
}

@ApiTags('objections')
@ApiBearerAuth()
@Controller('objections')
export class ObjectionsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: LifecycleService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiQuery({ name: 'status', required: false, enum: ObjectionStatus })
  @ApiQuery({ name: 'parcelId', required: false })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOperation({ summary: 's.15 objections in the caller’s jurisdiction, with hearings' })
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: ObjectionStatus,
    @Query('parcelId') parcelId?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.prisma.objection.findMany({
      where: { status, parcelId, parcel: { AND: [parcelScope(user), projectId ? { projectId } : {}] } },
      include: {
        hearings: { orderBy: { scheduledAt: 'asc' } },
        parcel: { select: { id: true, parcelNumber: true, surveyNumber: true, villageName: true, districtName: true, projectId: true } },
      },
      orderBy: { filedOn: 'desc' },
    });
  }

  @Post()
  @ApiOperation({ summary: 'File an objection under s.15 (citizens: only for parcels they hold)' })
  async file(@CurrentUser() user: AuthUser, @Body() dto: FileObjectionDto) {
    const parcel = await this.prisma.parcel.findFirst({ where: { AND: [{ id: dto.parcelId }, parcelScope(user)] } });
    if (!parcel) throw new NotFoundException('Parcel not found');
    if (user.role === RoleName.CITIZEN && !user.personId) throw new ForbiddenException('Citizen account is not linked to a land holder');
    if (parcel.stage !== ParcelStage.PRELIM_NOTIFIED) {
      throw new BadRequestException('Objections under s.15 can be filed only after the s.11 preliminary notification and before the s.19 declaration');
    }
    return this.prisma.$transaction(async (tx) => {
      const objection = await tx.objection.create({ data: dto });
      await this.audit.append(tx, { actor: user, action: 'OBJECTION_FILED', entityType: 'Objection', entityId: objection.id, newState: objection });
      return objection;
    });
  }

  @Post(':id/hearings')
  @Roles(...R.ACQUISITION)
  @ApiOperation({ summary: 'Schedule a hearing (moves the objection to HEARING_SCHEDULED)' })
  scheduleHearing(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ScheduleHearingDto) {
    return this.prisma.$transaction(async (tx) => {
      const objection = await tx.objection.findUnique({ where: { id } });
      if (!objection) throw new NotFoundException('Objection not found');
      const hearing = await tx.hearing.create({
        data: { objectionId: id, scheduledAt: new Date(dto.scheduledAt), venue: dto.venue, presidingOfficer: dto.presidingOfficer },
      });
      if (objection.status !== ObjectionStatus.HEARING_SCHEDULED) {
        await this.lifecycle.transitionInTx(tx, {
          entityType: 'Objection',
          entityId: id,
          event: 'SCHEDULE_HEARING',
          actor: user,
          fromDomainService: true,
          context: { hearingId: hearing.id, scheduledAt: hearing.scheduledAt },
        });
      } else {
        await this.audit.append(tx, { actor: user, action: 'HEARING_SCHEDULED', entityType: 'Hearing', entityId: hearing.id, newState: hearing });
      }
      return hearing;
    });
  }

  @Post('hearings/:hearingId/outcome')
  @Roles(...R.ACQUISITION)
  @ApiOperation({ summary: 'Record that a hearing was held (with outcome notes) or adjourned' })
  recordOutcome(@CurrentUser() user: AuthUser, @Param('hearingId') hearingId: string, @Body() dto: HearingOutcomeDto) {
    return this.lifecycle.transition({
      entityType: 'Hearing',
      entityId: hearingId,
      event: dto.held ? 'RECORD_HELD' : 'ADJOURN',
      actor: user,
      reason: dto.outcome,
      data: { outcome: dto.outcome ?? null },
    });
  }
}
