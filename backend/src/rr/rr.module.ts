import { Module } from '@nestjs/common';
import { RRService } from './rr.service';
import { RRController } from './rr.controller';

@Module({
  controllers: [RRController],
  providers: [RRService],
  exports: [RRService],
})
export class RRModule {}
