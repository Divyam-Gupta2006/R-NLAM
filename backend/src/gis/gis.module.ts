import { Global, Module } from '@nestjs/common';
import { GisGateService } from './gis-gate.service';
import { GisController } from './gis.controller';

@Global()
@Module({
  controllers: [GisController],
  providers: [GisGateService],
  exports: [GisGateService],
})
export class GisModule {}
