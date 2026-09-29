import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { projectScope } from '../common/scope';
import { PrismaService } from '../prisma/prisma.service';

class CreateProposalDto {
  @ApiProperty() @IsUUID() projectId: string;
  @ApiProperty() @IsString() @Length(3, 200) title: string;
  @ApiProperty({ example: 42.5 }) @IsNumber() @IsPositive() landRequiredHa: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) remarks?: string;
}

/** Proposal status changes go through /lifecycle/Proposal/:id/transitions. */
@ApiTags('proposals')
@ApiBearerAuth()
@Roles(...R.OFFICIALS)
@Controller('proposals')
export class ProposalsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOperation({ summary: 'Acquisition proposals in the caller’s jurisdiction' })
  list(@CurrentUser() user: AuthUser, @Query('projectId') projectId?: string) {
    return this.prisma.proposal.findMany({
      where: { projectId, project: projectScope(user) },
      include: { project: { select: { code: true, name: true, stateName: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const p = await this.prisma.proposal.findFirst({ where: { id, project: projectScope(user) }, include: { project: true } });
    if (!p) throw new NotFoundException('Proposal not found');
    return p;
  }

  @Post()
  @Roles(...R.PIA)
  @ApiOperation({ summary: 'Create a draft proposal' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProposalDto) {
    return this.prisma.$transaction(async (tx) => {
      const proposal = await tx.proposal.create({ data: dto });
      await this.audit.append(tx, { actor: user, action: 'PROPOSAL_CREATED', entityType: 'Proposal', entityId: proposal.id, newState: proposal });
      return proposal;
    });
  }
}
