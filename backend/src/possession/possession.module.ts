import { Module } from '@nestjs/common';
import { PossessionController } from './possession.controller';

@Module({ controllers: [PossessionController] })
export class PossessionModule {}
