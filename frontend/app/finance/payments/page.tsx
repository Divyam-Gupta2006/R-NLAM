'use client';

import { CompensationView } from '@/views/CompensationView';

export default function Page() {
  return <CompensationView eyebrow="Finance" title="Ready to pay" status="APPROVED" subtitle="Approved lines. Paying sends an instruction to the treasury gateway and records the UTR." />;
}
