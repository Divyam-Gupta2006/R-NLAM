import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ParcelStage, Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { rupeesToPaise } from '../common/money';
import { paging, parcelScope } from '../common/scope';
import { GisGateService } from '../gis/gis-gate.service';
import { PrismaService } from '../prisma/prisma.service';

class GeoJsonPolygonDto {
  @ApiProperty({ enum: ['Polygon', 'MultiPolygon'] })
  @IsIn(['Polygon', 'MultiPolygon'])
  type: 'Polygon' | 'MultiPolygon';

  @ApiProperty({ description: 'GeoJSON coordinates, EPSG:4326 (lng, lat)' })
  @IsArray()
  coordinates: unknown[];
}

class CreateParcelDto {
  @ApiProperty() @IsUUID() projectId: string;
  @ApiProperty({ example: 'WRD-SLD-0142' }) @IsString() @Length(1, 40) parcelNumber: string;
  @ApiProperty({ example: '142/2' }) @IsString() @Length(1, 40) surveyNumber: string;
  @ApiPropertyOptional({ example: '27123456789012' }) @IsOptional() @Matches(/^[0-9A-Z]{14}$/) ulpin?: string;
  @ApiProperty() @IsUUID() villageId: string;
  @ApiProperty({ example: 1.25 }) @IsNumber() @IsPositive() totalAreaHa: number;
  @ApiProperty({ example: 'Agricultural (irrigated)' }) @IsString() landClass: string;
  @ApiProperty({ example: 'Ramesh Patil' }) @IsString() displayOwnerName: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isRural?: boolean;
  @ApiPropertyOptional({ example: 18 }) @IsOptional() @IsNumber() distanceFromUrbanKm?: number;
  @ApiPropertyOptional({ example: 850000, description: 'Rupees per hectare' }) @IsOptional() @IsNumber() @IsPositive() marketRateRupeesPerHa?: number;
  @ApiPropertyOptional({ type: GeoJsonPolygonDto }) @IsOptional() @IsObject() @ValidateNested() @Type(() => GeoJsonPolygonDto) geometry?: GeoJsonPolygonDto;
}

@ApiTags('parcels')
@ApiBearerAuth()
@Controller('parcels')
export class ParcelsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly gate: GisGateService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Parcels in the caller’s jurisdiction (paged)' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'stage', required: false, enum: ParcelStage })
  @ApiQuery({ name: 'districtCode', required: false })
  @ApiQuery({ name: 'villageId', required: false })
  @ApiQuery({ name: 'q', required: false, description: 'survey no., parcel no., owner or village' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async list(
    @CurrentUser() user: AuthUser,
    @Query('projectId') projectId?: string,
    @Query('stage') stage?: ParcelStage,
    @Query('districtCode') districtCode?: string,
    @Query('villageId') villageId?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const where: Prisma.ParcelWhereInput = {
      AND: [
        parcelScope(user),
        { projectId, stage, districtCode, villageId },
        q
          ? {
              OR: [
                { surveyNumber: { contains: q, mode: 'insensitive' } },
                { parcelNumber: { contains: q, mode: 'insensitive' } },
                { displayOwnerName: { contains: q, mode: 'insensitive' } },
                { villageName: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    };
    const pg = paging(page, pageSize);
    const [items, total] = await Promise.all([
      this.prisma.parcel.findMany({
        where,
        skip: pg.skip,
        take: pg.take,
        orderBy: [{ villageName: 'asc' }, { parcelNumber: 'asc' }],
        include: { project: { select: { code: true, name: true } } },
      }),
      this.prisma.parcel.count({ where }),
    ]);
    return { items, total, page: pg.page, pageSize: pg.pageSize };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Everything about one parcel: holders, notices, objections, award, payments, R&R, possession, documents, history' })
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const parcel = await this.prisma.parcel.findFirst({
      where: { AND: [{ id }, parcelScope(user)] },
      include: {
        project: { select: { id: true, code: true, name: true, sector: true, piaName: true } },
        village: { select: { code: true, name: true, nameLocal: true } },
        holders: { include: { person: true } },
        notices: { orderBy: { publishedOn: 'asc' } },
        objections: { include: { hearings: { orderBy: { scheduledAt: 'asc' } } }, orderBy: { filedOn: 'asc' } },
        awards: { orderBy: { awardDate: 'desc' } },
        compensations: { include: { paymentReferences: true }, orderBy: { beneficiaryName: 'asc' } },
        rrCases: { include: { family: true, grants: { include: { entitlement: true } } } },
        possessions: true,
        documents: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!parcel) throw new NotFoundException('Parcel not found');
    const history = await this.prisma.stateTransition.findMany({
      where: { entityType: 'Parcel', entityId: id },
      orderBy: { createdAt: 'asc' },
      include: { actor: { select: { name: true, designation: true } } },
    });
    return { ...parcel, history };
  }

  @Post()
  @Roles(...R.GIS)
  @ApiOperation({ summary: 'Register a parcel (GeoJSON geometry is synced into PostGIS by trigger)' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateParcelDto) {
    const village = await this.prisma.jurisdiction.findUnique({ where: { id: dto.villageId }, include: { parent: { include: { parent: true } } } });
    if (!village || village.level !== 'VILLAGE') throw new NotFoundException('Village not found');
    // village → tehsil/district → state; walk up to find the district
    const district = village.parent?.level === 'DISTRICT' ? village.parent : village.parent?.parent;
    const state = await this.prisma.jurisdiction.findFirst({ where: { level: 'STATE', stateCode: village.stateCode } });

    return this.prisma.$transaction(async (tx) => {
      const parcel = await tx.parcel.create({
        data: {
          projectId: dto.projectId,
          parcelNumber: dto.parcelNumber,
          surveyNumber: dto.surveyNumber,
          ulpin: dto.ulpin,
          villageId: village.id,
          villageName: village.name,
          districtCode: district?.code ?? '',
          districtName: district?.name ?? '',
          stateCode: village.stateCode,
          stateName: state?.name ?? village.stateCode,
          totalAreaHa: dto.totalAreaHa,
          landClass: dto.landClass,
          displayOwnerName: dto.displayOwnerName,
          isRural: dto.isRural ?? true,
          distanceFromUrbanKm: dto.distanceFromUrbanKm,
          marketRatePaisePerHa: dto.marketRateRupeesPerHa ? rupeesToPaise(dto.marketRateRupeesPerHa) : undefined,
          geometry: dto.geometry ? (dto.geometry as unknown as Prisma.InputJsonValue) : undefined,
          isSynthetic: false,
        },
      });
      await this.audit.append(tx, { actor: user, action: 'PARCEL_REGISTERED', entityType: 'Parcel', entityId: parcel.id, newState: parcel });
      // Screen the new boundary against every constraint layer straight away.
      await this.gate.screen([parcel.id], tx);
      return parcel;
    });
  }
}
