import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { NoticeKind } from '@prisma/client';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { projectScope } from '../common/scope';
import { LifecycleService } from '../lifecycle/lifecycle.service';
import { Blocker } from '../lifecycle/lifecycle.types';
import { PrismaService } from '../prisma/prisma.service';

class PublishNoticeDto {
  @ApiProperty() @IsUUID() projectId: string;
  @ApiProperty({ enum: [NoticeKind.SEC_11_PRELIMINARY, NoticeKind.SEC_19_DECLARATION, NoticeKind.SEC_21_NOTICE] })
  @IsEnum(NoticeKind)
  kind: NoticeKind;
  @ApiProperty({ example: 'LAQ/WRD/11/2026/07' }) @IsString() @Length(3, 80) referenceNo: string;
  @ApiPropertyOptional({ example: 'Maharashtra Govt Gazette Part IV-B, 14 Jan 2026' }) @IsOptional() @IsString() gazetteRef?: string;
  @ApiProperty({ example: '2026-01-14' }) @IsDateString() publishedOn: string;
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @IsUUID('4', { each: true }) parcelIds: string[];
  @ApiPropertyOptional({ description: 'Senior officers: proceed past overridable blockers (e.g. declaration window extended by Government order)' })
  @IsOptional()
  @IsBoolean()
  override?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}

/** Which parcel transition each notice kind drives. */
const EVENT_FOR: Partial<Record<NoticeKind, string>> = {
  SEC_11_PRELIMINARY: 'PUBLISH_PRELIMINARY',
  SEC_19_DECLARATION: 'DECLARE',
};

@ApiTags('notices')
@ApiBearerAuth()
@Controller('notices')
export class NoticesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: LifecycleService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Roles(...R.OFFICIALS)
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOperation({ summary: 'Statutory notices (gazette notifications)' })
  list(@CurrentUser() user: AuthUser, @Query('projectId') projectId?: string) {
    return this.prisma.statutoryNotice.findMany({
      where: { projectId, project: projectScope(user) },
      include: { _count: { select: { parcels: true } }, project: { select: { code: true, name: true } } },
      orderBy: { publishedOn: 'desc' },
    });
  }

  @Post()
  @Roles(...R.ACQUISITION)
  @ApiOperation({
    summary: 'Publish a notice for a set of parcels. s.11 moves them to PRELIM_NOTIFIED, s.19 to DECLARED. Blocked parcels are left out and reported.',
  })
  async publish(@CurrentUser() user: AuthUser, @Body() dto: PublishNoticeDto) {
    if (dto.override && (dto.reason?.trim().length ?? 0) < 20) throw new BadRequestException('An override needs a reason of at least 20 characters (e.g. the extension order reference)');
    const event = EVENT_FOR[dto.kind];
    const parcels = await this.prisma.parcel.findMany({ where: { id: { in: dto.parcelIds }, projectId: dto.projectId } });
    if (parcels.length !== dto.parcelIds.length) throw new BadRequestException('Some parcels do not belong to this project');

    // Pre-check every parcel; the notice itself does not exist yet, so ignore that one guard.
    const excluded: Array<{ parcelId: string; parcelNumber: string; blockers: Blocker[] | string }> = [];
    const included: string[] = [];
    for (const p of parcels) {
      if (!event) {
        included.push(p.id);
        continue;
      }
      const view = await this.lifecycle.inspect('Parcel', p.id, user);
      const option = view.options.find((o) => o.event === event);
      if (!option) {
        excluded.push({ parcelId: p.id, parcelNumber: p.parcelNumber, blockers: `Parcel is ${view.state}` });
        continue;
      }
      const real = option.blockers.filter((b) => !b.code.startsWith('MISSING_SEC_'));
      const overridable = dto.override && option.canOverride && real.every((b) => b.overridable);
      if (real.length && !overridable) excluded.push({ parcelId: p.id, parcelNumber: p.parcelNumber, blockers: real });
      else included.push(p.id);
    }
    if (included.length === 0) throw new BadRequestException({ message: 'No parcel can take this notice', excluded });

    return this.prisma.$transaction(
      async (tx) => {
        const notice = await tx.statutoryNotice.create({
          data: {
            projectId: dto.projectId,
            kind: dto.kind,
            referenceNo: dto.referenceNo,
            gazetteRef: dto.gazetteRef,
            publishedOn: new Date(dto.publishedOn),
            parcels: { connect: included.map((id) => ({ id })) },
          },
        });
        await this.audit.append(tx, {
          actor: user,
          action: `NOTICE_PUBLISHED_${dto.kind}`,
          entityType: 'StatutoryNotice',
          entityId: notice.id,
          newState: { ...notice, parcelIds: included },
        });
        if (event) {
          for (const id of included) {
            await this.lifecycle.transitionInTx(tx, {
              entityType: 'Parcel',
              entityId: id,
              event,
              actor: user,
              fromDomainService: true,
              override: dto.override,
              reason: dto.reason ?? `${dto.kind} ${dto.referenceNo}`,
              context: { noticeId: notice.id },
            });
          }
        }
        return { notice, included: included.length, excluded };
      },
      { timeout: 60_000 },
    );
  }
}
