'use client';

import { WifiOff } from 'lucide-react';
import React from 'react';
import { Card, DataState, EmptyState, PageHeader } from '@/components/ui';
import { useApi } from '@/lib/api/hooks';
import type { Breakdown, Kpis } from '@/lib/api/types';
import { BreakdownTable, KpiRow, StageFunnel } from './DashboardView';

export function StatesPage() {
  const rows = useApi<Breakdown[]>('/analytics/states');
  return (
    <div>
      <PageHeader eyebrow="National Command" title="States" subtitle="Acquisition progress rolled up by state." />
      <Card>
        <DataState state={rows}>{(r) => <BreakdownTable rows={r} level="State" />}</DataState>
      </Card>
    </div>
  );
}

export function DistrictsPage() {
  const rows = useApi<Breakdown[]>('/analytics/districts');
  return (
    <div>
      <PageHeader title="Districts" subtitle="Acquisition progress rolled up by district." />
      <Card>
        <DataState state={rows}>{(r) => <BreakdownTable rows={r} level="District" />}</DataState>
      </Card>
    </div>
  );
}

export function AnalyticsPage() {
  const kpis = useApi<Kpis>('/analytics/kpis');
  const districts = useApi<Breakdown[]>('/analytics/districts');
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Governance" title="Analytics" subtitle="Computed live in Postgres. ClickHouse/Superset is the documented scale-out path, not needed at this size." />
      <DataState state={kpis}>
        {(k) => (
          <>
            <KpiRow k={k} />
            <Card title="Stage funnel">
              <StageFunnel k={k} />
            </Card>
          </>
        )}
      </DataState>
      <Card title="Districts">
        <DataState state={districts}>{(r) => <BreakdownTable rows={r} level="District" />}</DataState>
      </Card>
    </div>
  );
}

export function FieldSyncPage() {
  return (
    <div>
      <PageHeader eyebrow="Field app" title="Offline sync" subtitle="Evidence captured offline is hashed on the device and synced when back online." />
      <EmptyState icon={<WifiOff className="h-7 w-7" />} title="No offline evidence queued on this device" detail="Offline GNSS capture with on-device hashing is enabled in the field evidence module." />
    </div>
  );
}
