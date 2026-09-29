import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ProjectStatus } from '@prisma/client';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { CreateProjectDto } from './projects.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'Projects in the caller’s jurisdiction, with parcel counts by stage' })
  @ApiQuery({ name: 'status', required: false, enum: ProjectStatus })
  @ApiQuery({ name: 'stateCode', required: false })
  @ApiQuery({ name: 'q', required: false })
  list(@CurrentUser() user: AuthUser, @Query('status') status?: ProjectStatus, @Query('stateCode') stateCode?: string, @Query('q') q?: string) {
    return this.projects.list(user, { status, stateCode, q });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Project detail: stage breakdown, notices, compensation totals' })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projects.get(user, id);
  }

  @Post()
  @Roles(...R.PIA)
  @ApiOperation({ summary: 'Create a project (draft)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.projects.create(user, dto);
  }
}
