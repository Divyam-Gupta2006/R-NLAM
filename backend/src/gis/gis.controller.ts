import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GisService } from './gis.service';
import { RolesGuard } from '../auth/roles.guard';

@Controller('gis')
@UseGuards(RolesGuard)
export class GisController {
  constructor(private readonly gisService: GisService) {}

  @Get('geojson')
  async getGeoJson(@Query('projectId') projectId?: string) {
    return this.gisService.getGeoJson(projectId);
  }

  @Get('stats')
  async getSpatialStats(@Query('projectId') projectId?: string) {
    return this.gisService.getSpatialStats(projectId);
  }
}
