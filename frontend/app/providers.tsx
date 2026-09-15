'use client';

import React from 'react';
import { RoleProvider } from '@/context/RoleContext';
import { AuditProvider } from '@/context/AuditContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider>
      <AuditProvider>{children}</AuditProvider>
    </RoleProvider>
  );
}
