import { Controller, Get, Post, Body, Param, Query, Patch, UseGuards } from '@nestjs/common';
import { HearingsService } from './hearings.service';
import { RoleName } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('hearings')
@UseGuards(RolesGuard)
export class HearingsController {
  constructor(private readonly hearingsService: HearingsService) {}

  @Get()
  async findAll(@Query('objectionId') objectionId?: string) {
    return this.hearingsService.findAll(objectionId);
  }

  @Post()
  @Roles(RoleName.DISTRICT_OFFICER, RoleName.STATE_OFFICER, RoleName.CENTRAL_ADMIN)
  async schedule(
    @Body()
    body: {
      objectionId: string;
      hearingDate: string;
      venue: string;
      presidingOfficer: string;
    },
  ) {
    return this.hearingsService.schedule({
      objectionId: body.objectionId,
      hearingDate: new Date(body.hearingDate),
      venue: body.venue,
      presidingOfficer: body.presidingOfficer,
    });
  }

  @Patch(':id/decision')
  @Roles(RoleName.DISTRICT_OFFICER, RoleName.STATE_OFFICER, RoleName.CENTRAL_ADMIN)
  async recordDecision(@Param('id') id: string, @Body() body: { decision: string; status?: string }) {
    return this.hearingsService.recordDecision(id, body.decision, body.status);
  }
}
