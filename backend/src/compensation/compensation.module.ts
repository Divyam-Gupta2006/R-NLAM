import { Module } from '@nestjs/common';
import { CompensationService } from './compensation.service';
import { CompensationController } from './compensation.controller';

@Module({
  controllers: [CompensationController],
  providers: [CompensationService],
  exports: [CompensationService],
})
export class CompensationModule {}
