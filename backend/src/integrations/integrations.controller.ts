import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
export class IntegrationsController {
  constructor(private integrationsService: IntegrationsService) {}

  @Get('status')
  getStatus() {
    return this.integrationsService.getStatus();
  }

  @Get('bhoomi/:khasra')
  fetchBhoomiRecord(@Param('khasra') khasra: string) {
    return this.integrationsService.fetchBhoomiRecord(khasra);
  }

  @Post('pfms')
  processPFMSPayout(@Body() data: any) {
    return this.integrationsService.processPFMSPayout(data);
  }
}

