'use client';

import { FlaskConical } from 'lucide-react';
import { usePathname } from 'next/navigation';
import React, { useState } from 'react';
import { useSession } from '@/context/SessionContext';
import { Spinner } from '../ui';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

const BARE = ['/login', '/citizen', '/help'];

/**
 * Chooses the frame for a route: bare pages (login, citizen portal, help) draw
 * their own; officer pages get header + sidebar, and only render once a
 * session exists (the session provider redirects to /login otherwise).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, restoring } = useSession();
  const [navOpen, setNavOpen] = useState(false);

  if (BARE.some((p) => pathname === p || pathname.startsWith(p + '/'))) return <>{children}</>;

  if (restoring || !user) {
    return (
      <div className="grid min-h-screen place-items-center text-ink-muted">
        <span className="flex items-center gap-2 text-sm">
          <Spinner /> Checking your session…
        </span>
      </div>
    );
  }
  if (user.role === 'CITIZEN') {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center text-sm text-ink-muted">
        <p>
          This area is for officers. <a className="font-semibold text-info" href="/citizen/home">Go to your citizen portal</a>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header onToggleNav={() => setNavOpen((o) => !o)} />
      <div className="flex items-center justify-center gap-1.5 bg-warning-soft px-3 py-1 text-center text-[11px] font-semibold text-warning">
        <FlaskConical className="h-3.5 w-3.5" aria-hidden />
        Demonstration build: all records are synthetic. Payments, land records and court data come from labelled synthetic adapters.
      </div>
      <div className="flex flex-1">
        <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
        {navOpen && <div className="fixed inset-0 z-30 bg-navy/30 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden />}
        <main id="main" className="min-w-0 flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
