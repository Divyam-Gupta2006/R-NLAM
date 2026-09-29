import { Controller, Get, HttpCode, Module, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ClockStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import { parseIstDate } from '../common/dates';
import { parcelScope } from '../common/scope';
import { PrismaService } from '../prisma/prisma.service';
import { RulesService } from '../rules/rules.service';
import { StatutoryService } from './statutory.service';

@ApiTags('rules')
@Controller('rules')
class RulesController {
  constructor(private readonly rules: RulesService) {}

  /** Public: the law is public, and citizens see the rules that protect them. */
  @Public()
  @Get('packs')
  @ApiOperation({ summary: 'Rule packs (central and state), with versions and effective dates' })
  packs() {
    return this.rules.listPacks();
  }

  @Public()
  @Get('packs/:code')
  @ApiOperation({ summary: 'One rule pack with every entry, its citation and statutory text' })
  pack(@Param('code') code: string) {
    return this.rules.getPack(code);
  }

  @Public()
  @Get('resolve')
  @ApiOperation({ summary: 'The rules in force for a state on a date (state pack overlaid on the central pack)' })
  @ApiQuery({ name: 'stateCode', example: 'MH' })
  @ApiQuery({ name: 'date', example: '2026-09-29', required: false })
  async resolve(@Query('stateCode') stateCode: string, @Query('date') date?: string) {
    return this.rules.resolve(stateCode || 'MH', date ? parseIstDate(date) : new Date());
  }
}

@ApiTags('statutory')
@ApiBearerAuth()
@Controller('statutory')
class StatutoryController {
  constructor(
    private readonly statutory: StatutoryService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('calendar')
  @Roles(...R.OFFICIALS)
  @ApiOperation({ summary: 'Statutory calendar: deadlines grouped by notice, soonest first, with days left and citations' })
  @ApiQuery({ name: 'status', required: false, enum: ClockStatus })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'includeMet', required: false })
  calendar(@CurrentUser() user: AuthUser, @Query('status') status?: ClockStatus, @Query('projectId') projectId?: string, @Query('includeMet') includeMet?: string) {
    return this.statutory.calendar(user, { status, projectId, includeMet: includeMet === 'true' });
  }

  @Get('parcels/:id')
  @ApiOperation({ summary: 'Every statutory clock on one parcel (citizens: their own parcels)' })
  async parcel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const visible = await this.prisma.parcel.count({ where: { AND: [{ id }, parcelScope(user)] } });
    if (!visible) throw new NotFoundException('Parcel not found');
    return this.statutory.forParcel(id);
  }

  @Post('recompute')
  @HttpCode(200)
  @Roles(...R.SENIOR)
  @ApiOperation({ summary: 'Recompute every clock and raise due alerts now (normally hourly)' })
  async recompute(@CurrentUser() user: AuthUser) {
    const r = await this.statutory.recomputeAll();
    const alerts = await this.statutory.raiseAlerts();
    await this.audit.log({ actor: user, action: 'STATUTORY_RECOMPUTE', entityType: 'System', entityId: 'statutory', newState: { ...r, ...alerts } });
    return { ...r, ...alerts };
  }
}

@Module({
  controllers: [RulesController, StatutoryController],
  providers: [StatutoryService],
  exports: [StatutoryService],
})
export class StatutoryModule {}
