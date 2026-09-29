import { Module } from '@nestjs/common';
import { RRController } from './rr.controller';

@Module({ controllers: [RRController] })
export class RRModule {}
