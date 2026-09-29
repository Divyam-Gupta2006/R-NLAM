import { Module } from '@nestjs/common';
import { GisController } from './gis.controller';

@Module({ controllers: [GisController] })
export class GisModule {}
