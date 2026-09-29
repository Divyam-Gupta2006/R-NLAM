import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { DocumentsController } from './documents.controller';

@Module({ imports: [AiModule], controllers: [DocumentsController] })
export class DocumentsModule {}
