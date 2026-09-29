'use client';

import React, { Suspense } from 'react';
import { Spinner } from '@/components/ui';
import { FieldCaptureView } from '@/views/FieldViews';

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <FieldCaptureView />
    </Suspense>
  );
}
