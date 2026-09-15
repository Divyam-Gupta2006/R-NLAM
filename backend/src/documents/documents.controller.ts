import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { RoleName } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('documents')
@UseGuards(RolesGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  async findAll(@Query('projectId') projectId?: string, @Query('parcelId') parcelId?: string) {
    return this.documentsService.findAll(projectId, parcelId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Post('upload')
  @Roles(RoleName.PIA_OFFICER, RoleName.DISTRICT_OFFICER, RoleName.FIELD_OFFICER, RoleName.CENTRAL_ADMIN)
  async upload(
    @Body()
    body: {
      fileName: string;
      minioKey: string;
      mimeType: string;
      fileSize: number;
      bucket?: string;
      projectId?: string;
      parcelId?: string;
      uploadedBy: string;
    },
  ) {
    return this.documentsService.upload(body);
  }
}
