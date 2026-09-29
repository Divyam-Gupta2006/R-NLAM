import './globals.css';
import type { Metadata, Viewport } from 'next';
import React from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'R-NLAM · National Land Acquisition & Management',
  description: 'Real-Time National Land Acquisition & Management System: track the land, the case, the money, the people and the time.',
};

export const viewport: Viewport = {
  themeColor: '#0b1f3a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[2000] focus:rounded focus:bg-panel focus:px-3 focus:py-2">
          Skip to content
        </a>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
