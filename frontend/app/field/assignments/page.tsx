'use client';

import { ParcelsView } from '@/views/ParcelsView';

export default function Page() {
  return <ParcelsView eyebrow="Field app" title="Paid parcels awaiting possession" initialStage="COMPENSATION_PAID" />;
}
