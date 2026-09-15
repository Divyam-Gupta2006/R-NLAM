import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RolesGuard } from '../auth/roles.guard';

@Controller('audit')
@UseGuards(RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async findAll(@Query('entityType') entityType?: string, @Query('entityId') entityId?: string) {
    return this.auditService.findAll({ entityType, entityId });
  }

  @Get('verify-chain')
  async verifyChain() {
    return this.auditService.verifyChain();
  }
}
