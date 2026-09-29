'use client';

import { CompensationView } from '@/views/CompensationView';

export default function Page() {
  return <CompensationView eyebrow="Finance" title="Failed payments" status="FAILED" subtitle="Bounced credits. Correct the account and retry." />;
}
