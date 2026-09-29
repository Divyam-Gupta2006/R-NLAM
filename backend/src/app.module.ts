import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module';
import { CourtModule } from './court/court.module';
import { FieldModule } from './field/field.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AwardsModule } from './awards/awards.module';
import { CitizenModule } from './citizen/citizen.module';
import { CommonModule } from './common/common.module';
import { CompensationModule } from './compensation/compensation.module';
import { DocumentsModule } from './documents/documents.module';
import { EventsModule } from './events/events.module';
import { GisModule } from './gis/gis.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { LifecycleModule } from './lifecycle/lifecycle.module';
import { NoticesModule } from './notices/notices.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ObjectionsModule } from './objections/objections.module';
import { ParcelsModule } from './parcels/parcels.module';
import { PossessionModule } from './possession/possession.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { ProposalsModule } from './proposals/proposals.module';
import { RRModule } from './rr/rr.module';
import { RulesModule } from './rules/rules.module';
import { SlaModule } from './sla/sla.module';
import { StorageModule } from './storage/storage.module';
import { LiabilityModule } from './liability/liability.module';
import { StuckModule } from './stuck/stuck.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { ThreadModule } from './thread/thread.module';
import { StatutoryModule } from './statutory/statutory.module';
import { SystemModule } from './system/system.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // infrastructure
    PrismaModule,
    CommonModule,
    AuthModule,
    AuditModule,
    EventsModule,
    LifecycleModule,
    StorageModule,
    RulesModule,
    NotificationsModule,
    SystemModule,
    StatutoryModule,
    LiabilityModule,
    StuckModule,
    ReconciliationModule,
    ThreadModule,
    // domain
    ProjectsModule,
    ProposalsModule,
    ParcelsModule,
    NoticesModule,
    ObjectionsModule,
    AwardsModule,
    CompensationModule,
    RRModule,
    PossessionModule,
    DocumentsModule,
    AiModule,
    CourtModule,
    FieldModule,
    GisModule,
    AnalyticsModule,
    SlaModule,
    UsersModule,
    IntegrationsModule,
    CitizenModule,
  ],
})
export class AppModule {}
