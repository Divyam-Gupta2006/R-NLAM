'use client';

import { ParcelDetailView } from '@/views/ParcelDetailView';

export default function Page({ params }: { params: { id: string } }) {
  return <ParcelDetailView id={params.id} />;
}
