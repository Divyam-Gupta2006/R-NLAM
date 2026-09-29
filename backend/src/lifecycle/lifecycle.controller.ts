import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { LifecycleService } from './lifecycle.service';

class TransitionDto {
  @ApiProperty({ example: 'COMPLETE_PAYMENT' })
  @IsString()
  event: string;

  @ApiPropertyOptional({ description: 'Required (≥ 20 chars) when overriding a blocker' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @ApiPropertyOptional({ description: 'Senior officers only: proceed despite overridable blockers' })
  @IsOptional()
  @IsBoolean()
  override?: boolean;
}

@ApiTags('lifecycle')
@ApiBearerAuth()
@Roles(...R.OFFICIALS)
@Controller('lifecycle')
export class LifecycleController {
  constructor(private readonly lifecycle: LifecycleService) {}

  @Get('definitions')
  @ApiOperation({ summary: 'Every state machine: states, transitions, roles and guards' })
  definitions() {
    return this.lifecycle.definitions();
  }

  @Get(':entityType/:id')
  @ApiOperation({ summary: 'Current state, available transitions with their blockers, and history' })
  inspect(@Param('entityType') entityType: string, @Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lifecycle.inspect(entityType, id, user);
  }

  @Post(':entityType/:id/transitions')
  @ApiOperation({
    summary: 'Fire a transition. 409 with `blockers` if a guard stops it; senior officers may override overridable blockers with a reason.',
  })
  fire(@Param('entityType') entityType: string, @Param('id') id: string, @Body() dto: TransitionDto, @CurrentUser() user: AuthUser) {
    return this.lifecycle.transition({ entityType, entityId: id, event: dto.event, actor: user, reason: dto.reason, override: dto.override });
  }
}
