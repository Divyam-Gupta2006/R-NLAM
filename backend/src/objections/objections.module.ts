import { Module } from '@nestjs/common';
import { ObjectionsService } from './objections.service';
import { ObjectionsController } from './objections.controller';

@Module({
  controllers: [ObjectionsController],
  providers: [ObjectionsService],
  exports: [ObjectionsService],
})
export class ObjectionsModule {}
