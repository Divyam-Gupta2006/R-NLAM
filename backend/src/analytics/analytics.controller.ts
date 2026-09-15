import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { RoleName } from '@prisma/client';
import { RolesGuard } from '../auth/roles.guard';

@Controller('analytics')
@UseGuards(RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('kpis')
  async getDashboardKpis() {
    return this.analyticsService.getDashboardKpis();
  }

  @Get('project/:id')
  async getProjectAnalytics(@Param('id') id: string) {
    return this.analyticsService.getProjectAnalytics(id);
  }

  @Get('states')
  async getStatesAnalytics() {
    return this.analyticsService.getStatesAnalytics();
  }

  @Get('districts')
  async getDistrictsAnalytics(@Query('stateCode') stateCode?: string) {
    return this.analyticsService.getDistrictsAnalytics(stateCode);
  }

  @Post('record-query')
  async recordQuery(@Body() body: { question: string; sqlQuery: string; userRole: RoleName }) {
    return this.analyticsService.recordAnalyticsQuery(body.question, body.sqlQuery, body.userRole);
  }
}
