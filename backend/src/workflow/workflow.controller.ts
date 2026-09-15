import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { RoleName } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('workflow')
@UseGuards(RolesGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('templates')
  async getTemplates() {
    return this.workflowService.getTemplates();
  }

  @Get('instance/:projectId')
  async getInstance(@Param('projectId') projectId: string) {
    return this.workflowService.getInstanceByProjectId(projectId);
  }

  @Post('action')
  @Roles(RoleName.CENTRAL_ADMIN, RoleName.STATE_OFFICER, RoleName.DISTRICT_OFFICER, RoleName.PIA_OFFICER)
  async executeAction(@Body() body: { instanceId: string; actionName: string; performedBy: string; fromStage: string; toStage: string; remarks?: string }) {
    return this.workflowService.executeAction(body);
  }
}
