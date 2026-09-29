import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@Roles(...R.OFFICIALS)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'Headline KPIs and the stage funnel for the caller’s jurisdiction' })
  kpis(@CurrentUser() user: AuthUser) {
    return this.analytics.kpis(user);
  }

  @Get('states')
  @ApiOperation({ summary: 'Progress by state' })
  states(@CurrentUser() user: AuthUser) {
    return this.analytics.breakdown(user, 'state');
  }

  @Get('districts')
  @ApiQuery({ name: 'stateCode', required: false })
  @ApiOperation({ summary: 'Progress by district' })
  districts(@CurrentUser() user: AuthUser, @Query('stateCode') stateCode?: string) {
    return this.analytics.breakdown(user, 'district', stateCode);
  }
}
