import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { CitizenService } from './citizen.service';

@Controller('citizen')
export class CitizenController {
  constructor(private citizenService: CitizenService) {}

  @Get('summary')
  getSummary() {
    return this.citizenService.getSummary();
  }

  @Get('projects')
  getPublicProjects() {
    return this.citizenService.getPublicProjects();
  }

  @Get('my-land')
  getMyLand(@Query('khasra') khasra?: string) {
    return this.citizenService.getMyLand(khasra);
  }

  @Get('compensation')
  getMyCompensation() {
    return this.citizenService.getMyCompensation();
  }

  @Get('rr')
  getMyRR() {
    return this.citizenService.getMyRR();
  }

  @Post('grievance')
  submitGrievance(@Body() data: any) {
    return this.citizenService.submitGrievance(data);
  }
}

