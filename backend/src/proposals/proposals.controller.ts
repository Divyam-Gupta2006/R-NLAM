import { Controller, Get, Post, Body, Param, Query, Patch, UseGuards } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { ProposalStatus, RoleName } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('proposals')
@UseGuards(RolesGuard)
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Get()
  async findAll(@Query('projectId') projectId?: string) {
    return this.proposalsService.findAll(projectId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.proposalsService.findOne(id);
  }

  @Post()
  @Roles(RoleName.PIA_OFFICER, RoleName.CENTRAL_ADMIN)
  async create(@Body() body: { projectId: string; title: string; landRequired: number; alignmentGeo?: any; remarks?: string }) {
    return this.proposalsService.create(body);
  }

  @Patch(':id/status')
  @Roles(RoleName.DISTRICT_OFFICER, RoleName.STATE_OFFICER, RoleName.CENTRAL_ADMIN)
  async updateStatus(@Param('id') id: string, @Body() body: { status: ProposalStatus; remarks?: string }) {
    return this.proposalsService.updateStatus(id, body.status, body.remarks);
  }
}
