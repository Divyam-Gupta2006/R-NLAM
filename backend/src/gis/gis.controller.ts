import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { parcelScope } from '../common/scope';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('gis')
@ApiBearerAuth()
@Controller('gis')
export class GisController {
  constructor(private readonly prisma: PrismaService) {}

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
}
