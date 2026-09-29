import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { EntitlementStatus, RRStatus } from '@prisma/client';
import { ArrayMinSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { Clock } from '../common/clock';
import { parcelScope, projectScope } from '../common/scope';
import { LifecycleService } from '../lifecycle/lifecycle.service';
import { PrismaService } from '../prisma/prisma.service';

class AssignGrantsDto {
  @ApiProperty({ example: ['HOUSE_RURAL', 'SUBSISTENCE_GRANT'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  entitlementCodes: string[];
}

class DeliverDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) remarks?: string;
}

@ApiTags('rr')
@ApiBearerAuth()
@Controller('rr')
export class RRController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: LifecycleService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  @Get('entitlements')
  @ApiOperation({ summary: 'Catalogue of R&R entitlements (Second Schedule)' })
  entitlements() {
    return this.prisma.entitlement.findMany({ orderBy: { category: 'asc' } });
  }

  @Get('families')
  @Roles(...R.OFFICIALS)
  @ApiQuery({ name: 'projectId', required: false })
  families(@CurrentUser() user: AuthUser, @Query('projectId') projectId?: string) {
    return this.prisma.affectedFamily.findMany({
      where: { projectId, project: projectScope(user) },
      include: { rrCases: { select: { id: true, status: true, parcelId: true } } },
      orderBy: { headName: 'asc' },
    });
  }

  @Get('cases')
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: RRStatus })
  @ApiOperation({ summary: 'R&R cases with family and entitlement grants' })
  cases(@CurrentUser() user: AuthUser, @Query('projectId') projectId?: string, @Query('status') status?: RRStatus) {
    return this.prisma.rRCase.findMany({
      where: { projectId, status, parcel: parcelScope(user) },
      include: {
        family: true,
        parcel: { select: { id: true, parcelNumber: true, villageName: true, districtName: true, stage: true } },
        grants: { include: { entitlement: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Post('cases/:id/grants')
  @Roles(...R.RR)
  @ApiOperation({ summary: 'Assign entitlements to a family (PLAN_CREATED → BENEFIT_ASSIGNED)' })
  assign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AssignGrantsDto) {
    return this.prisma.$transaction(async (tx) => {
      const entitlements = await tx.entitlement.findMany({ where: { code: { in: dto.entitlementCodes } } });
      if (entitlements.length !== dto.entitlementCodes.length) throw new BadRequestException('Unknown entitlement code');
      for (const e of entitlements) {
        await tx.rREntitlementGrant.create({ data: { caseId: id, entitlementId: e.id, amountPaise: e.amountPaise } });
      }
      return this.lifecycle.transitionInTx(tx, {
        entityType: 'RRCase',
        entityId: id,
        event: 'ASSIGN_BENEFITS',
        actor: user,
        fromDomainService: true,
        context: { entitlements: dto.entitlementCodes },
      });
    });
  }

  @Post('grants/:id/deliver')
  @Roles(...R.RR)
  @ApiOperation({ summary: 'Record delivery of one entitlement to the family' })
  deliver(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DeliverDto) {
    return this.prisma.$transaction(async (tx) => {
      const grant = await tx.rREntitlementGrant.findUnique({ where: { id }, include: { entitlement: true } });
      if (!grant) throw new NotFoundException('Grant not found');
      if (grant.status !== EntitlementStatus.ASSIGNED) throw new BadRequestException(`Grant is already ${grant.status}`);
      const updated = await tx.rREntitlementGrant.update({
        where: { id },
        data: { status: EntitlementStatus.DELIVERED, deliveredOn: this.clock.now(), remarks: dto.remarks },
      });
      await this.audit.append(tx, {
        actor: user,
        action: 'RR_ENTITLEMENT_DELIVERED',
        entityType: 'RREntitlementGrant',
        entityId: id,
        previousState: { status: grant.status },
        newState: { status: updated.status, entitlement: grant.entitlement.code, caseId: grant.caseId },
        reason: dto.remarks,
      });
      return updated;
    });
  }
}
