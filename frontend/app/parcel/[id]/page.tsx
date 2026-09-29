'use client';

import { ParcelDetailView } from '@/views/ParcelDetailView';

export default function ParcelPage({ params }: { params: { id: string } }) {
  return <ParcelDetailView id={params.id} />;
}
