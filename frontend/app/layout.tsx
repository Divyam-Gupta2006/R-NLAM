import './globals.css';
import React from 'react';
import type { Metadata } from 'next';
import { Providers } from './providers';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { AuditTimelineDrawer } from '@/components/AuditTimelineDrawer';

export const metadata: Metadata = {
  title: 'R-NLAM | Real-Time National Land Acquisition System',
  description: 'National digital orchestration, spatial intelligence, and 5D land acquisition management portal.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 min-h-screen flex flex-col antialiased">
        <Providers>
          <Header />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100">
              {children}
            </main>
          </div>
          <AuditTimelineDrawer />
        </Providers>
      </body>
    </html>
  );
}
