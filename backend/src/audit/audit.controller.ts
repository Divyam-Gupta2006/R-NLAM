import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { R } from '../auth/auth.types';
import { Roles } from '../auth/decorators';
import { AuditService } from './audit.service';

@ApiTags('audit')
@ApiBearerAuth()
@Roles(...R.OFFICIALS)
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Audit entries, newest first' })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'highlighted', required: false, description: 'true = overrides and other highlighted entries only' })
  @ApiQuery({ name: 'limit', required: false })
  list(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('highlighted') highlighted?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.list({ entityType, entityId, highlightedOnly: highlighted === 'true', limit: limit ? Number(limit) : undefined });
  }

  @Get('verify')
  @ApiOperation({ summary: 'Recompute every hash in the chain and report the first break, if any' })
  verify() {
    return this.audit.verify();
  }
}
