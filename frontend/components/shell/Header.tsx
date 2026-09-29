'use client';

import { Bell, ChevronDown, LogOut, Menu, Repeat, UserCircle2 } from 'lucide-react';
import Link from 'next/link';
import { LogoMark } from '../Logo';
import { usePathname } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import { homeFor, useSession, useUser } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { api } from '@/lib/api/client';
import { useApi } from '@/lib/api/hooks';
import type { NotificationItem, Persona } from '@/lib/api/types';
import { dateTimeIST, humanize } from '@/lib/format';
import { portalFor, portalsForRole } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { Badge } from '../ui';

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

export function Header({ onToggleNav }: { onToggleNav: () => void }) {
  const user = useUser();
  const pathname = usePathname();
  const portal = portalFor(pathname);
  const others = portalsForRole(user.role).filter((p) => p.key !== portal?.key);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-navy text-white">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
        <button className="rounded p-1.5 hover:bg-white/10 lg:hidden" aria-label="Open navigation" onClick={onToggleNav}>
          <Menu className="h-5 w-5" />
        </button>
        <Link href={homeFor(user.role)} className="flex items-center gap-2.5">
          <LogoMark size={32} onDark />
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-wide">R-NLAM</span>
            <span className="hidden text-[10px] text-white/70 sm:block">Connecting Land, Law &amp; People</span>
          </span>
        </Link>
        {others.length > 0 && (
          <div className="ml-2 hidden gap-1 md:flex">
            {others.map((p) => (
              <Link key={p.key} href={p.sections[0].items[0].href} className="rounded-md px-2 py-1 text-xs text-white/80 hover:bg-white/10 hover:text-white">
                {p.label}
              </Link>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <RoleSwitcher />
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
      <div className="tricolour-rule" aria-hidden />
    </header>
  );
}

/** Dev-mode persona switcher: jump between portals without re-logging in. */
function RoleSwitcher() {
  const { loginAs } = useSession();
  const user = useUser();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const personas = useApi<Persona[]>(open ? '/auth/personas' : null);

  return (
    <div className="relative" ref={ref}>
      <button className="flex items-center gap-1.5 rounded-md border border-white/20 px-2 py-1 text-xs hover:bg-white/10" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-tour="role-switcher">
        <Repeat className="h-3.5 w-3.5 text-saffron" aria-hidden />
        <span className="hidden sm:inline">{humanize(user.role)}</span>
        <ChevronDown className="h-3 w-3" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="panel absolute right-0 mt-2 w-80 overflow-hidden text-ink shadow-xl">
          <p className="border-b border-line px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Dev mode · switch persona</p>
          <ul className="max-h-96 overflow-y-auto">
            {(personas.data ?? []).map((p) => (
              <li key={p.email}>
                <button
                  role="menuitem"
                  className={cn('w-full px-3 py-2 text-left hover:bg-surface', p.email === user.email && 'bg-saffron-soft/50')}
                  onClick={async () => {
                    setOpen(false);
                    try {
                      await loginAs(p.email);
                      toast('success', `Signed in as ${p.name}`, p.designation ?? undefined);
                    } catch (e) {
                      toast('error', 'Could not switch persona', (e as Error).message);
                    }
                  }}
                >
                  <span className="block text-sm font-semibold">{p.name}</span>
                  <span className="block text-xs text-ink-muted">
                    {p.designation} · {p.jurisdiction}
                  </span>
                </button>
              </li>
            ))}
            {personas.error && <li className="px-3 py-2 text-xs text-danger">{personas.error.message}</li>}
            {!personas.data && !personas.error && <li className="px-3 py-2 text-xs text-ink-muted">Loading…</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const list = useApi<NotificationItem[]>('/notifications', { refreshMs: 30_000 });
  const unread = (list.data ?? []).filter((n) => !n.isRead);

  const markRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`).catch(() => undefined);
    list.reload();
  };

  return (
    <div className="relative" ref={ref}>
      <button className="relative rounded-md p-1.5 hover:bg-white/10" aria-label={`Notifications, ${unread.length} unread`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Bell className="h-5 w-5" />
        {unread.length > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-saffron px-1 text-[10px] font-bold">{unread.length}</span>}
      </button>
      {open && (
        <div className="panel absolute right-0 mt-2 w-[min(92vw,380px)] overflow-hidden text-ink shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="text-sm font-bold">Notifications</p>
            <Link href="/notifications" className="text-xs font-semibold text-info" onClick={() => setOpen(false)}>
              See all
            </Link>
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {(list.data ?? []).slice(0, 8).map((n) => (
              <li key={n.id} className={cn('px-3 py-2', !n.isRead && 'bg-saffron-soft/30')}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <Badge tone={n.severity === 'CRITICAL' ? 'bad' : n.severity === 'WARNING' ? 'warn' : 'info'}>{humanize(n.severity)}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-ink-muted">{n.message}</p>
                <div className="mt-1 flex items-center justify-between text-[11px] text-ink-muted">
                  <span>{dateTimeIST(n.createdAt)}</span>
                  {!n.isRead && (
                    <button className="font-semibold text-info" onClick={() => markRead(n.id)}>
                      Mark read
                    </button>
                  )}
                </div>
              </li>
            ))}
            {list.data && list.data.length === 0 && <li className="px-3 py-6 text-center text-xs text-ink-muted">No notifications</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { logout } = useSession();
  const user = useUser();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button className="flex items-center gap-1.5 rounded-md p-1 hover:bg-white/10" aria-label="Account menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <UserCircle2 className="h-6 w-6" />
        <span className="hidden max-w-[140px] truncate text-xs lg:block">{user.name}</span>
      </button>
      {open && (
        <div className="panel absolute right-0 mt-2 w-64 overflow-hidden text-ink shadow-xl">
          <div className="border-b border-line px-3 py-2">
            <p className="text-sm font-semibold">{user.name}</p>
            <p className="text-xs text-ink-muted">{user.email}</p>
          </div>
          <Link href="/profile" className="block px-3 py-2 text-sm hover:bg-surface" onClick={() => setOpen(false)}>
            Profile
          </Link>
          <Link href="/settings" className="block px-3 py-2 text-sm hover:bg-surface" onClick={() => setOpen(false)}>
            Settings &amp; system status
          </Link>
          <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-surface" onClick={logout}>
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
