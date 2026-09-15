import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { AwardsService } from './awards.service';
import { RoleName } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('awards')
@UseGuards(RolesGuard)
export class AwardsController {
  constructor(private readonly awardsService: AwardsService) {}

  @Get()
  async findAll(@Query('projectId') projectId?: string) {
    return this.awardsService.findAll(projectId);
  }

  @Post()
  @Roles(RoleName.DISTRICT_OFFICER, RoleName.STATE_OFFICER, RoleName.CENTRAL_ADMIN)
  async create(
    @Body()
    body: {
      awardNumber: string;
      projectId: string;
      parcelId: string;
      valuationLand: number;
      valuationAssets?: number;
      solatiumAmount?: number;
    },
  ) {
    return this.awardsService.create(body);
  }
}
