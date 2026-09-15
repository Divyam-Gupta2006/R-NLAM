import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { RRService } from './rr.service';
import { RoleName, RRStatus } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('rr')
@UseGuards(RolesGuard)
export class RRController {
  constructor(private readonly rrService: RRService) {}

  @Get('families')
  async getFamilies(@Query('projectId') projectId?: string) {
    return this.rrService.getFamilies(projectId);
  }

  @Get('cases')
  async getCases(@Query('projectId') projectId?: string) {
    return this.rrService.getCases(projectId);
  }

  @Post('eligibility')
  @Roles(RoleName.RR_OFFICER, RoleName.DISTRICT_OFFICER, RoleName.CENTRAL_ADMIN)
  async verifyEligibility(@Body() body: { projectId: string; parcelId: string; familyId: string; status: RRStatus }) {
    return this.rrService.verifyEligibility(body);
  }

  @Post('delivery')
  @Roles(RoleName.RR_OFFICER, RoleName.DISTRICT_OFFICER, RoleName.CENTRAL_ADMIN)
  async recordDelivery(@Body() body: { caseId: string; benefitName: string; remarks?: string }) {
    return this.rrService.recordDelivery(body);
  }
}
