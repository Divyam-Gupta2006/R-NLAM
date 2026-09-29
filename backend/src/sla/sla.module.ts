import { Controller, Get, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { Clock } from '../common/clock';
import { projectScope } from '../common/scope';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('sla')
@ApiBearerAuth()
@Roles(...R.OFFICIALS)
@Controller('sla')
class SlaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  @Get('tasks')
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOperation({ summary: 'Administrative SLA tasks with live breach status' })
  async tasks(@CurrentUser() user: AuthUser, @Query('projectId') projectId?: string) {
    const now = this.clock.now();
    const tasks = await this.prisma.sLATask.findMany({
      where: { projectId, project: projectScope(user) },
      include: { project: { select: { code: true, name: true, stateCode: true } } },
      orderBy: { targetDate: 'asc' },
    });
    return tasks.map((t) => ({
      ...t,
      isBreached: !t.completedDate && t.targetDate < now,
      daysRemaining: t.completedDate ? null : Math.ceil((t.targetDate.getTime() - now.getTime()) / 86_400_000),
    }));
  }
}

@Module({ controllers: [SlaController] })
export class SlaModule {}
