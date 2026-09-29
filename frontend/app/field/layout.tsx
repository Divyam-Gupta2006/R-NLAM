import type { Metadata } from 'next';
import React from 'react';
import { FieldRuntime } from '@/components/field/FieldRuntime';

// The field portal is an installable PWA with its own manifest and scope.
export const metadata: Metadata = {
  title: 'R-NLAM Field',
  manifest: '/field.webmanifest',
  appleWebApp: { capable: true, title: 'R-NLAM Field', statusBarStyle: 'black-translucent' },
  icons: { apple: '/icons/field-192.png' },
};

export default function FieldLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FieldRuntime />
      {children}
    </>
  );
}
