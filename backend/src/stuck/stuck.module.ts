import { Body, Controller, Get, HttpCode, Module, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { BriefDecision } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { LLM_PROVIDER, OpenAICompatibleProvider, TemplateProvider } from '../llm/llm.provider';
import { WhyStuckService } from './why-stuck.service';

class DecisionDto {
  @ApiProperty({ enum: BriefDecision }) @IsEnum(BriefDecision) decision: BriefDecision;
  @ApiProperty({ example: 'Forest clearance application filed with the Regional Office on 20 Sep' }) @IsString() @Length(5, 2000) comment: string;
}

class RephraseDto {
  @ApiPropertyOptional({ enum: ['en', 'hi', 'mr'] }) @IsOptional() @IsIn(['en', 'hi', 'mr']) language?: 'en' | 'hi' | 'mr';
}

@ApiTags('why-stuck')
@ApiBearerAuth()
@Roles(...R.OFFICIALS)
@Controller('stuck')
class WhyStuckController {
  constructor(private readonly stuck: WhyStuckService) {}

  @Get('projects')
  @ApiOperation({ summary: 'Every project in scope with its bottleneck count, top priority and ₹ exposure' })
  projects(@CurrentUser() user: AuthUser) {
    return this.stuck.projects(user);
  }

  @Get('bottlenecks')
  @ApiOperation({ summary: 'Ranked bottlenecks with explainable scores and action briefs' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async bottlenecks(@CurrentUser() user: AuthUser, @Query('projectId') projectId?: string, @Query('limit') limit?: string) {
    const all = await this.stuck.bottlenecks(user, projectId);
    return limit ? all.slice(0, Number(limit)) : all;
  }

  @Post('bottlenecks/:key/decision')
  @ApiOperation({ summary: 'Accept or dispute a brief, with a comment. Audited; a dispute halves the priority until re-examined.' })
  decide(@CurrentUser() user: AuthUser, @Param('key') key: string, @Body() dto: DecisionDto) {
    return this.stuck.decide(user, decodeURIComponent(key), dto.decision, dto.comment);
  }

  @Post('bottlenecks/:key/rephrase')
  @HttpCode(200)
  @ApiOperation({ summary: 'Plain-language or translated brief. The LLM may only rephrase; output is labelled and checked against the facts.' })
  rephrase(@CurrentUser() user: AuthUser, @Param('key') key: string, @Body() dto: RephraseDto) {
    return this.stuck.rephrase(user, decodeURIComponent(key), dto.language ?? 'en');
  }
}

@Module({
  controllers: [WhyStuckController],
  providers: [
    WhyStuckService,
    TemplateProvider,
    OpenAICompatibleProvider,
    {
      provide: LLM_PROVIDER,
      useFactory: (template: TemplateProvider, openai: OpenAICompatibleProvider) => (process.env.LLM_PROVIDER === 'openai-compatible' ? openai : template),
      inject: [TemplateProvider, OpenAICompatibleProvider],
    },
  ],
  exports: [WhyStuckService],
})
export class StuckModule {}
