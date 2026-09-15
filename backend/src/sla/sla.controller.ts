import { Controller, Get, Post } from '@nestjs/common';
import { SlaService } from './sla.service';

@Controller('sla')
export class SlaController {
  constructor(private slaService: SlaService) {}

  @Get('tasks')
  getTasks() {
    return this.slaService.getTasks();
  }

  @Post('check-breaches')
  checkBreaches() {
    return this.slaService.checkBreaches();
  }
}

