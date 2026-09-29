'use client';

import { ParcelsView } from '@/views/ParcelsView';

export default function Page() {
  return <ParcelsView eyebrow="District Collectorate" title="Parcels due for field verification" initialStage="PRELIM_NOTIFIED" />;
}
