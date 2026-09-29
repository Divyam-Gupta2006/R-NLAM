import { BadRequestException, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { R } from '../auth/auth.types';
import { Roles } from '../auth/decorators';
import { AuditService } from './audit.service';
import { MerkleService } from './merkle.service';

@ApiTags('audit')
@ApiBearerAuth()
@Roles(...R.OFFICIALS)
@Controller('audit')
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly merkle: MerkleService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Audit entries, newest first' })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'highlighted', required: false, description: 'true = overrides and other highlighted entries only' })
  @ApiQuery({ name: 'limit', required: false })
  list(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('highlighted') highlighted?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.list({ entityType, entityId, highlightedOnly: highlighted === 'true', limit: limit ? Number(limit) : undefined });
  }

  @Get('verify')
  @ApiOperation({ summary: 'Recompute every hash in the chain and every sealed Merkle root; report the first break, if any' })
  async verify() {
    const [chain, merkle] = await Promise.all([this.audit.verify(), this.merkle.verifyRoots()]);
    return { ...chain, valid: chain.valid && merkle.valid, chainValid: chain.valid, merkle };
  }

  @Get('merkle/roots')
  @ApiOperation({ summary: 'Sealed Merkle roots (one per IST day), newest first, with the chain of roots' })
  roots() {
    return this.merkle.roots();
  }

  @Post('merkle/seal')
  @HttpCode(200)
  @Roles(...R.SENIOR)
  @ApiOperation({ summary: 'Seal unsealed entries now, including the day in progress (normally hourly, completed days only)' })
  seal() {
    return this.merkle.seal(true);
  }

  @Get('entries/:seq/proof')
  @ApiOperation({ summary: 'RFC 6962 inclusion proof for one audit entry against the Merkle root that sealed it' })
  proof(@Param('seq') seq: string) {
    if (!/^\d+$/.test(seq)) throw new BadRequestException('seq must be a number');
    return this.merkle.proof(BigInt(seq));
  }
}
