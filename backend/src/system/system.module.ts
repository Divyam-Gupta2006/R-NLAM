import { Controller, Get, Module } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { authMode } from '../auth/auth.types';
import { Public } from '../auth/decorators';
import { Clock } from '../common/clock';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('system')
@Controller('system')
class SystemController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness plus database/PostGIS check and active adapter modes' })
  async health() {
    let database = 'down';
    let postgis: string | null = null;
    try {
      const [row] = await this.prisma.$queryRaw<Array<{ v: string }>>`SELECT extensions.postgis_lib_version() AS v`;
      database = 'up';
      postgis = row.v;
    } catch {
      /* reported as down */
    }
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      postgis,
      now: this.clock.now().toISOString(),
      clockPinned: this.clock.isPinned(),
      adapters: {
        auth: authMode(),
        eventBus: process.env.EVENT_BUS ?? 'outbox',
        storage: process.env.STORAGE_BACKEND ?? 'local',
        payments: 'PFMS_SYNTHETIC',
        llm: process.env.LLM_PROVIDER ?? 'template',
      },
    };
  }
}

@Module({ controllers: [SystemController] })
export class SystemModule {}
