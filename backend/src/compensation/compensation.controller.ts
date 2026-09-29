import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CompensationStatus } from '@prisma/client';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { CompensationService } from './compensation.service';

/** Approve / hold / dispute / retry go through /lifecycle/Compensation/:id/transitions. */
@ApiTags('compensation')
@ApiBearerAuth()
@Roles(...R.OFFICIALS)
@Controller('compensation')
export class CompensationController {
  constructor(private readonly compensation: CompensationService) {}

  @Get()
  @ApiOperation({ summary: 'Compensation lines with payment references and totals by status' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'parcelId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: CompensationStatus })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  list(
    @CurrentUser() user: AuthUser,
    @Query('projectId') projectId?: string,
    @Query('parcelId') parcelId?: string,
    @Query('status') status?: CompensationStatus,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.compensation.list(user, { projectId, parcelId, status, page, pageSize });
  }

  @Post(':id/pay')
  @HttpCode(200)
  @Roles(...R.FINANCE)
  @ApiOperation({ summary: 'Disburse an approved compensation through the payment gateway (synthetic PFMS in dev)' })
  pay(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.compensation.pay(user, id);
  }
}
