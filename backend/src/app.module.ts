import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { ProposalsModule } from './proposals/proposals.module';
import { WorkflowModule } from './workflow/workflow.module';
import { ParcelsModule } from './parcels/parcels.module';
import { GisModule } from './gis/gis.module';
import { ObjectionsModule } from './objections/objections.module';
import { HearingsModule } from './hearings/hearings.module';
import { AwardsModule } from './awards/awards.module';
import { CompensationModule } from './compensation/compensation.module';
import { RRModule } from './rr/rr.module';
import { PossessionModule } from './possession/possession.module';
import { DocumentsModule } from './documents/documents.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { UsersModule } from './users/users.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { CitizenModule } from './citizen/citizen.module';
import { SlaModule } from './sla/sla.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ProjectsModule,
    ProposalsModule,
    WorkflowModule,
    ParcelsModule,
    GisModule,
    ObjectionsModule,
    HearingsModule,
    AwardsModule,
    CompensationModule,
    RRModule,
    PossessionModule,
    DocumentsModule,
    AuditModule,
    NotificationsModule,
    AnalyticsModule,
    UsersModule,
    IntegrationsModule,
    CitizenModule,
    SlaModule,
  ],
})
export class AppModule {}
