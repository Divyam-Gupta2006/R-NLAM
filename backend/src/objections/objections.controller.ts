import { Controller, Get, Post, Body, Param, Query, Patch, UseGuards } from '@nestjs/common';
import { ObjectionsService } from './objections.service';
import { ObjectionStatus, RoleName } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('objections')
@UseGuards(RolesGuard)
export class ObjectionsController {
  constructor(private readonly objectionsService: ObjectionsService) {}

  @Get()
  async findAll(@Query('parcelId') parcelId?: string) {
    return this.objectionsService.findAll(parcelId);
  }

  @Post()
  @Roles(RoleName.CITIZEN, RoleName.DISTRICT_OFFICER, RoleName.CENTRAL_ADMIN)
  async create(@Body() body: { parcelId: string; applicant: string; category: string; description: string }) {
    return this.objectionsService.create(body);
  }

  @Patch(':id/status')
  @Roles(RoleName.DISTRICT_OFFICER, RoleName.STATE_OFFICER, RoleName.CENTRAL_ADMIN)
  async updateStatus(@Param('id') id: string, @Body() body: { status: ObjectionStatus }) {
    return this.objectionsService.updateStatus(id, body.status);
  }
}
