import { Controller, Get, Module, NotFoundException, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { R } from '../auth/auth.types';
import { Roles } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';

/**
 * External government systems. Every adapter here is SYNTHETIC in this build
 * and says so in its response; production adapters implement the same shapes.
 */
@ApiTags('integrations')
@ApiBearerAuth()
@Roles(...R.OFFICIALS)
@Controller('integrations')
class IntegrationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('status')
  @ApiOperation({ summary: 'Adapters, their mode (SYNTHETIC / LIVE) and what they would connect to' })
  status() {
    return [
      { key: 'land-records', name: 'State land records (Bhulekh / Mahabhumi)', mode: 'SYNTHETIC', note: 'Reads seeded LandRecordReference rows' },
      { key: 'pfms', name: 'PFMS / State Treasury', mode: 'SYNTHETIC', note: 'UTRs prefixed SYN; no money moves' },
      { key: 'digilocker', name: 'DigiLocker', mode: 'SYNTHETIC', note: 'Planned for citizen document pull (6.11)' },
      { key: 'ecourts', name: 'eCourts / NJDG', mode: 'SYNTHETIC', note: 'Planned for candidate case links (6.9)' },
      { key: 'bhashini', name: 'Bhashini translation', mode: 'NOT_CONNECTED', note: 'TranslationProvider stub (6.11)' },
      { key: 'postgis', name: 'PostGIS spatial engine', mode: 'LIVE', note: 'Local user-space PostgreSQL 17 + PostGIS 3.6' },
    ];
  }

  @Get('land-records/:villageCode/:surveyNo')
  @ApiOperation({ summary: 'SYNTHETIC land-record lookup by village and survey number' })
  async landRecord(@Param('villageCode') villageCode: string, @Param('surveyNo') surveyNo: string) {
    const rec = await this.prisma.landRecordReference.findFirst({ where: { villageCode, surveyNo: decodeURIComponent(surveyNo) } });
    if (!rec) throw new NotFoundException('No synthetic land record for that survey number');
    return { ...rec, synthetic: true };
  }
}

@Module({ controllers: [IntegrationsController] })
export class IntegrationsModule {}
