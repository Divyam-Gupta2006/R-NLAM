import { Module } from '@nestjs/common';
import { ObjectionsController } from './objections.controller';

@Module({ controllers: [ObjectionsController] })
export class ObjectionsModule {}
