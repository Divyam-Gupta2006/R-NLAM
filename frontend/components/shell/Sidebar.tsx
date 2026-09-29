'use client';

import {
  AlertTriangle,
  Award,
  BookOpenCheck,
  BarChart3,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  CreditCard,
  Download,
  FileCheck,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Gavel,
  GitBranch,
  Globe,
  HeartHandshake,
  Inbox,
  IndianRupee,
  KeyRound,
  Layers,
  LayoutDashboard,
  Map,
  MapPin,
  MessageSquareWarning,
  PlusCircle,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Upload,
  UserCheck,
  Users,
  WifiOff,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { portalFor } from '@/lib/nav';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  AlertTriangle, Award, BarChart3, BookOpenCheck, Building, Calendar, CheckCircle2, Clock, Compass, CreditCard, Download, FileCheck, FileSpreadsheet, FileText,
  FolderKanban, Gavel, GitBranch, Globe, HeartHandshake, Inbox, IndianRupee, KeyRound, Layers, LayoutDashboard, Map, MapPin, MessageSquareWarning,
  PlusCircle, ShieldAlert, ShieldCheck, Smartphone, Upload, UserCheck, Users, WifiOff, XCircle,
};

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const portal = portalFor(pathname);
  if (!portal) return null;

  return (
    <nav
      aria-label={`${portal.label} navigation`}
      className={cn(
        'fixed inset-y-0 left-0 z-40 w-64 shrink-0 overflow-y-auto border-r border-line bg-panel pt-16 transition-transform lg:static lg:translate-x-0 lg:pt-0',
        open ? 'translate-x-0 shadow-xl' : '-translate-x-full',
      )}
    >
      <div className="px-4 py-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-saffron">{portal.label}</p>
      </div>
      {portal.sections.map((s) => (
        <div key={s.title} className="px-2 pb-4">
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{s.title}</p>
          <ul>
            {s.items.map((item) => {
              const Icon = ICONS[item.icon] ?? LayoutDashboard;
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm',
                      active ? 'bg-navy font-semibold text-white' : 'text-ink hover:bg-surface',
                    )}
                  >
                    <Icon className={cn('h-4 w-4', active ? 'text-saffron' : 'text-ink-muted')} aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
