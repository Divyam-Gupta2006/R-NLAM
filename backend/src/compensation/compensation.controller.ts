import { Controller, Get, Post, Body, Query, Patch, Param, UseGuards } from '@nestjs/common';
import { CompensationService } from './compensation.service';
import { CompensationStatus, RoleName } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('compensation')
@UseGuards(RolesGuard)
export class CompensationController {
  constructor(private readonly compensationService: CompensationService) {}

  @Get('cases')
  async getCases(@Query('projectId') projectId?: string) {
    return this.compensationService.getCases(projectId);
  }

  @Post('initiate-payment')
  @Roles(RoleName.FINANCE_OFFICER, RoleName.DISTRICT_OFFICER, RoleName.CENTRAL_ADMIN)
  async initiatePayment(
    @Body()
    body: {
      compensationId: string;
      utrNumber?: string;
      gatewaySource?: string;
    },
  ) {
    return this.compensationService.initiatePayment(body);
  }

  @Patch(':id/status')
  @Roles(RoleName.FINANCE_OFFICER, RoleName.DISTRICT_OFFICER, RoleName.CENTRAL_ADMIN)
  async updateStatus(@Param('id') id: string, @Body() body: { status: CompensationStatus }) {
    return this.compensationService.updateStatus(id, body.status);
  }
}
