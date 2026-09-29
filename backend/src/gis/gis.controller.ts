import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ConstraintKind } from '@prisma/client';
import { IsEnum, IsObject, IsString, Length, Matches } from 'class-validator';
import { Prisma } from '@prisma/client';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { parcelScope } from '../common/scope';
import { PrismaService } from '../prisma/prisma.service';
import { GisGateService } from './gis-gate.service';

class LoadLayerDto {
  @ApiProperty({ example: 'MH-YTL-RF-KHARSHI' }) @Matches(/^[A-Z0-9-]{3,40}$/) code: string;
  @ApiProperty({ enum: ConstraintKind }) @IsEnum(ConstraintKind) kind: ConstraintKind;
  @ApiProperty({ example: 'Kharshi Reserved Forest' }) @IsString() @Length(3, 200) name: string;
  @ApiProperty({ example: 'State Forest Department compartment map, 2024' }) @IsString() @Length(3, 300) source: string;
  @ApiProperty({ description: 'GeoJSON Polygon, MultiPolygon, Feature or FeatureCollection (EPSG:4326)' }) @IsObject() geojson: Record<string, unknown>;
}

@ApiTags('gis')
@ApiBearerAuth()
@Controller('gis')
export class GisController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gate: GisGateService,
  ) {}

  @Get('parcels')
  @ApiOperation({ summary: 'Parcels as a GeoJSON FeatureCollection (EPSG:4326) with stage and area' })
  @ApiQuery({ name: 'projectId', required: false })
  async parcels(@CurrentUser() user: AuthUser, @Query('projectId') projectId?: string) {
    const rows = await this.prisma.parcel.findMany({
      where: { AND: [parcelScope(user), projectId ? { projectId } : {}, { NOT: { geometry: { equals: Prisma.AnyNull } } }] },
      select: {
        id: true,
        parcelNumber: true,
        surveyNumber: true,
        villageName: true,
        districtName: true,
        totalAreaHa: true,
        areaSqm: true,
        landClass: true,
        stage: true,
        displayOwnerName: true,
        projectId: true,
        geometry: true,
        isSynthetic: true,
      },
    });
    return {
      type: 'FeatureCollection',
      features: rows.map(({ geometry, ...properties }) => ({ type: 'Feature', id: properties.id, geometry, properties })),
    };
  }

  @Get('stats')
  @Roles(...R.OFFICIALS)
  @ApiOperation({ summary: 'Spatial totals computed by PostGIS (true ellipsoidal area)' })
  @ApiQuery({ name: 'projectId', required: false })
  async stats(@Query('projectId') projectId?: string) {
    const rows = await this.prisma.$queryRaw<Array<{ parcels: bigint; with_geom: bigint; area_ha: number | null; bbox: string | null }>>`
      SELECT count(*)                                         AS parcels,
             count("geom")                                    AS with_geom,
             sum(extensions.ST_Area("geom"::extensions.geography)) / 10000.0 AS area_ha,
             extensions.ST_AsGeoJSON(extensions.ST_Extent("geom")) AS bbox
      FROM "Parcel"
      WHERE (${projectId ?? null}::text IS NULL OR "projectId" = ${projectId ?? null})`;
    const r = rows[0];
    return {
      parcels: Number(r.parcels),
      parcelsWithGeometry: Number(r.with_geom),
      surveyedAreaHa: r.area_ha ? Math.round(r.area_ha * 100) / 100 : 0,
      extent: r.bbox ? JSON.parse(r.bbox) : null,
      engine: 'PostGIS',
    };
  }

  @Get('layers')
  @ApiOperation({ summary: 'Constraint layers (forest, Scheduled Area, FRA claims, CRZ, protected areas) with geometry' })
  layers() {
    return this.gate.layers();
  }

  @Post('layers')
  @Roles(...R.GIS)
  @ApiOperation({ summary: 'Load or replace a constraint layer from GeoJSON, then rescreen every parcel' })
  loadLayer(@CurrentUser() user: AuthUser, @Body() dto: LoadLayerDto) {
    return this.gate.loadLayer(user, dto);
  }

  @Get('conflicts')
  @Roles(...R.OFFICIALS)
  @ApiOperation({ summary: 'Parcels overlapping constraint layers, with the documents required and on file (the consent gate)' })
  @ApiQuery({ name: 'projectId', required: false })
  conflicts(@CurrentUser() user: AuthUser, @Query('projectId') projectId?: string) {
    return this.gate.conflicts(user, projectId);
  }

  @Get('parcels/:id/gate')
  @ApiOperation({ summary: 'Consent gate status for one parcel' })
  async parcelGate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const visible = await this.prisma.parcel.count({ where: { AND: [{ id }, parcelScope(user)] } });
    if (!visible) throw new NotFoundException('Parcel not found');
    return this.gate.evaluate(id);
  }

  @Post('screen')
  @HttpCode(200)
  @Roles(...R.GIS)
  @ApiOperation({ summary: 'Rescreen every parcel against every layer (ST_Intersects + overlap area)' })
  screen() {
    return this.gate.screen();
  }
}
