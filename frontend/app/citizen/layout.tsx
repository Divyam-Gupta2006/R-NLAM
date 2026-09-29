'use client';

import React from 'react';
import { I18nProvider } from '@/lib/i18n/I18nProvider';

// Every citizen page (including sign-in) speaks English, Hindi or Marathi.
export default function CitizenLayout({ children }: { children: React.ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}
