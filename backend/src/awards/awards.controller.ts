import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { AwardsService } from './awards.service';

class AwardDto {
  @ApiProperty() @IsUUID() parcelId: string;
  @ApiProperty({ example: '2026-09-30' }) @IsDateString() awardDate: string;
  @ApiPropertyOptional({ example: 250000, description: 'Value of trees, wells, structures (rupees), s.29' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  assetsValueRupees?: number;
}

@ApiTags('awards')
@ApiBearerAuth()
@Roles(...R.OFFICIALS)
@Controller('awards')
export class AwardsController {
  constructor(private readonly awards: AwardsService) {}

  @Get()
  @ApiQuery({ name: 'projectId', required: false })
  list(@CurrentUser() user: AuthUser, @Query('projectId') projectId?: string) {
    return this.awards.list(user, projectId);
  }

  @Post('preview')
  @HttpCode(200)
  @ApiOperation({ summary: 'Compute an award line by line (market value, multiplier, solatium, additional amount) without saving' })
  preview(@CurrentUser() user: AuthUser, @Body() dto: AwardDto) {
    return this.awards.preview(user, { parcelId: dto.parcelId, awardDate: new Date(dto.awardDate), assetsValueRupees: dto.assetsValueRupees });
  }

  @Post()
  @Roles(...R.ACQUISITION)
  @ApiOperation({ summary: 'Declare the award (s.23): creates the award and per-holder compensation, moves the parcel to AWARDED' })
  declare(@CurrentUser() user: AuthUser, @Body() dto: AwardDto) {
    return this.awards.declare(user, { parcelId: dto.parcelId, awardDate: new Date(dto.awardDate), assetsValueRupees: dto.assetsValueRupees });
  }
}
