import { Controller, Get, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JurisdictionLevel, RoleName } from '@prisma/client';
import { Public, Roles } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles(RoleName.CENTRAL_ADMIN, RoleName.STATE_ADMIN)
  @ApiQuery({ name: 'role', required: false, enum: RoleName })
  @ApiOperation({ summary: 'Officers and their jurisdictions' })
  list(@Query('role') role?: RoleName) {
    return this.prisma.user.findMany({
      where: { role },
      select: { id: true, name: true, email: true, role: true, designation: true, active: true, jurisdiction: { select: { level: true, name: true, code: true } }, organization: { select: { name: true } } },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
  }
}

@ApiTags('jurisdictions')
@Controller('jurisdictions')
class JurisdictionsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Public: administrative names are not sensitive and the citizen portal needs them. */
  @Public()
  @Get()
  @ApiQuery({ name: 'level', required: false, enum: JurisdictionLevel })
  @ApiQuery({ name: 'parentId', required: false })
  @ApiQuery({ name: 'stateCode', required: false })
  list(@Query('level') level?: JurisdictionLevel, @Query('parentId') parentId?: string, @Query('stateCode') stateCode?: string) {
    return this.prisma.jurisdiction.findMany({ where: { level, parentId, stateCode }, orderBy: { name: 'asc' } });
  }
}

@Module({ controllers: [UsersController, JurisdictionsController] })
export class UsersModule {}

