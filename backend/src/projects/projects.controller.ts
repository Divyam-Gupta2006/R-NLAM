import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { RoleName } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('projects')
@UseGuards(RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async findAll(@Query('stateCode') stateCode?: string, @Query('districtCode') districtCode?: string) {
    return this.projectsService.findAll({ stateCode, districtCode });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Post()
  @Roles(RoleName.PIA_OFFICER, RoleName.CENTRAL_ADMIN)
  async create(
    @Body()
    body: {
      code: string;
      name: string;
      sector: string;
      stateCode: string;
      stateName: string;
      districtCodes: string[];
      districtNames: string[];
      piaName: string;
      requiredLand: number;
      estimatedCost: number;
    },
  ) {
    return this.projectsService.create(body);
  }
}
