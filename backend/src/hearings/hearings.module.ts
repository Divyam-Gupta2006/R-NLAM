import { Module } from '@nestjs/common';
import { HearingsService } from './hearings.service';
import { HearingsController } from './hearings.controller';

@Module({
  controllers: [HearingsController],
  providers: [HearingsService],
  exports: [HearingsService],
})
export class HearingsModule {}
