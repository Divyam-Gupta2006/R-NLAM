import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { PossessionService } from './possession.service';
import { PossessionStatus, RoleName } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('possession')
@UseGuards(RolesGuard)
export class PossessionController {
  constructor(private readonly possessionService: PossessionService) {}

  @Get('cases')
  async getCases(@Query('projectId') projectId?: string) {
    return this.possessionService.getCases(projectId);
  }

  @Post('record')
  @Roles(RoleName.DISTRICT_OFFICER, RoleName.PIA_OFFICER, RoleName.CENTRAL_ADMIN)
  async recordPossession(
    @Body()
    body: {
      projectId: string;
      parcelId: string;
      authority?: string;
      latitude?: number;
      longitude?: number;
      documentUrl?: string;
      remarks?: string;
      status?: PossessionStatus;
    },
  ) {
    return this.possessionService.recordPossession(body);
  }
}
