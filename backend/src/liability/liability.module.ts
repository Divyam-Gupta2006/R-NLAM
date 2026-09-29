import { Controller, Get, HttpCode, Module, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { LiabilityService } from './liability.service';

@ApiTags('liability')
@ApiBearerAuth()
@Roles(...R.OFFICIALS)
@Controller('liability')
class LiabilityController {
  constructor(private readonly liability: LiabilityService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Statutory cost of delay now: s.80 interest and s.30(3) additional amount, daily rate, 12-month trend' })
  summary(@CurrentUser() user: AuthUser) {
    return this.liability.summary(user);
  }

  @Get('rollup')
  @ApiOperation({ summary: 'Liability rolled up by state, district, village or parcel (drill down with parent)' })
  @ApiQuery({ name: 'level', enum: ['state', 'district', 'village', 'parcel'] })
  @ApiQuery({ name: 'parent', required: false, description: 'state code, district code or village id of the level above' })
  rollup(@CurrentUser() user: AuthUser, @Query('level') level: 'state' | 'district' | 'village' | 'parcel' = 'state', @Query('parent') parent?: string) {
    return this.liability.rollup(user, level, parent);
  }

  @Get('top')
  @ApiOperation({ summary: 'Top actions by money avoided if taken this week: pay unpaid compensation (s.80), declare pending awards (s.30(3))' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'horizonDays', required: false })
  top(@CurrentUser() user: AuthUser, @Query('limit') limit?: string, @Query('horizonDays') horizonDays?: string) {
    return this.liability.topSavings(user, limit ? Math.min(50, Number(limit)) : 10, horizonDays ? Number(horizonDays) : 365);
  }

  @Post('refresh')
  @HttpCode(200)
  @Roles(...R.SENIOR)
  @ApiOperation({ summary: 'Refresh the liability fact views now (normally automatic after each change)' })
  async refresh() {
    await this.liability.refresh();
    return { refreshed: true };
  }
}

@Module({
  controllers: [LiabilityController],
  providers: [LiabilityService],
  exports: [LiabilityService],
})
export class LiabilityModule {}
