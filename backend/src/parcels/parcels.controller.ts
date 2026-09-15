import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ParcelsService } from './parcels.service';
import { VerificationStatus, RoleName } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('parcels')
@UseGuards(RolesGuard)
export class ParcelsController {
  constructor(private readonly parcelsService: ParcelsService) {}

  @Get()
  async findAll(@Query('projectId') projectId?: string, @Query('villageName') villageName?: string) {
    return this.parcelsService.findAll({ projectId, villageName });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.parcelsService.findOne(id);
  }

  @Post()
  @Roles(RoleName.PIA_OFFICER, RoleName.DISTRICT_OFFICER, RoleName.CENTRAL_ADMIN)
  async create(
    @Body()
    body: {
      projectId: string;
      parcelNumber: string;
      khasraNumber: string;
      villageName: string;
      districtName: string;
      stateName: string;
      totalArea: number;
      landOwnerName: string;
      landClass: string;
      geometry?: any;
    },
  ) {
    return this.parcelsService.create(body);
  }

  @Post('verify')
  @Roles(RoleName.FIELD_OFFICER, RoleName.DISTRICT_OFFICER, RoleName.CENTRAL_ADMIN)
  async verifyParcel(
    @Body()
    body: {
      parcelId: string;
      verifiedBy: string;
      latitude: number;
      longitude: number;
      photoUrl?: string;
      notes?: string;
      status?: VerificationStatus;
      isOfflineSync?: boolean;
    },
  ) {
    return this.parcelsService.verifyParcel(body);
  }
}
