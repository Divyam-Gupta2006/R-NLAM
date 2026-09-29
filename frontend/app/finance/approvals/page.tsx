'use client';

import { CompensationView } from '@/views/CompensationView';

export default function Page() {
  return <CompensationView eyebrow="Finance" title="Awaiting approval" status="ASSESSED" subtitle="Compensation assessed under an award, waiting for the Collector’s approval before payment." />;
}
