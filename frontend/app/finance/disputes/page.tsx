'use client';

import { CompensationView } from '@/views/CompensationView';

export default function Page() {
  return <CompensationView eyebrow="Finance" title="On hold" status="ON_HOLD" subtitle="Held lines, e.g. beneficiary identity not yet reconciled. Release from the parcel page once resolved." />;
}
