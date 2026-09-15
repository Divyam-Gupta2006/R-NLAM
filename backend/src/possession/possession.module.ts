import { Module } from '@nestjs/common';
import { PossessionService } from './possession.service';
import { PossessionController } from './possession.controller';

@Module({
  controllers: [PossessionController],
  providers: [PossessionService],
  exports: [PossessionService],
})
export class PossessionModule {}
