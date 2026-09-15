'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRole } from '@/context/RoleContext';
import {
  LayoutDashboard,
  FolderKanban,
  Building,
  MapPin,
  Layers,
  IndianRupee,
  Users,
  KeyRound,
  AlertTriangle,
  BarChart3,
  FileSpreadsheet,
  ShieldCheck,
  GitBranch,
  UserCheck,
  Globe,
  PlusCircle,
  FileText,
  Map,
  CheckCircle2,
  Calendar,
  Award,
  Smartphone,
  WifiOff,
  HeartHandshake,
  CreditCard,
  XCircle,
  HelpCircle,
  FileCheck,
  Settings,
  HelpCircle as HelpIcon,
  ChevronLeft,
  ChevronRight,
  Home,
  FilePlus,
  Compass,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export function Sidebar() {
  const pathname = usePathname();
  const { activeRole, currentRoleOption } = useRole();
  const [collapsed, setCollapsed] = useState(false);

  // Dynamic Navigation definitions based on active portal prefix
  const getNavSections = (): NavSection[] => {
    if (pathname.startsWith('/central')) {
      return [
        {
          title: 'CENTRAL OVERVIEW',
          items: [
            { label: 'Executive Dashboard', href: '/central/overview', icon: <LayoutDashboard className="w-4 h-4" /> },
            { label: 'National Projects', href: '/central/projects', icon: <FolderKanban className="w-4 h-4" />, badge: '4 Active' },
            { label: 'State Performance', href: '/central/states', icon: <Building className="w-4 h-4" /> },
            { label: 'District Monitoring', href: '/central/districts', icon: <MapPin className="w-4 h-4" /> },
          ],
        },
        {
          title: '5D FRAMEWORK & ANALYTICS',
          items: [
            { label: 'Land Acquisition', href: '/central/land', icon: <Layers className="w-4 h-4" /> },
            { label: 'Compensation Funds', href: '/central/compensation', icon: <IndianRupee className="w-4 h-4" /> },
            { label: 'R&R Progress', href: '/central/rr', icon: <Users className="w-4 h-4" /> },
            { label: 'Possession Status', href: '/central/possession', icon: <KeyRound className="w-4 h-4" /> },
            { label: 'AI Delay Risk Engine', href: '/central/risk', icon: <AlertTriangle className="w-4 h-4" />, badge: 'High Risk' },
            { label: 'Spatial Analytics', href: '/central/analytics', icon: <BarChart3 className="w-4 h-4" /> },
            { label: 'National Reports', href: '/central/reports', icon: <FileSpreadsheet className="w-4 h-4" /> },
          ],
        },
        {
          title: 'GOVERNANCE & SYSTEM',
          items: [
            { label: 'Tamper-Evident Audit', href: '/central/audit', icon: <ShieldCheck className="w-4 h-4" /> },
            { label: 'Workflows & SLAs', href: '/central/workflows', icon: <GitBranch className="w-4 h-4" /> },
            { label: 'User Directory', href: '/central/users', icon: <UserCheck className="w-4 h-4" /> },
            { label: 'External Integrations', href: '/central/integrations', icon: <Globe className="w-4 h-4" /> },
          ],
        },
      ];
    }

    if (pathname.startsWith('/state')) {
      return [
        {
          title: 'STATE NODAL PORTAL',
          items: [
            { label: 'State Overview', href: '/state/overview', icon: <LayoutDashboard className="w-4 h-4" /> },
            { label: 'State Projects', href: '/state/projects', icon: <FolderKanban className="w-4 h-4" /> },
            { label: 'District Coordination', href: '/state/districts', icon: <MapPin className="w-4 h-4" /> },
            { label: 'Approval Queue', href: '/state/approvals', icon: <CheckCircle2 className="w-4 h-4" />, badge: '3 Pending' },
          ],
        },
        {
          title: 'STATE MANAGEMENT',
          items: [
            { label: 'Land Bank', href: '/state/land', icon: <Layers className="w-4 h-4" /> },
            { label: 'Compensation Sanctions', href: '/state/compensation', icon: <IndianRupee className="w-4 h-4" /> },
            { label: 'State R&R Schemes', href: '/state/rr', icon: <Users className="w-4 h-4" /> },
            { label: 'Land Possession', href: '/state/possession', icon: <KeyRound className="w-4 h-4" /> },
            { label: 'SLA Tracking', href: '/state/sla', icon: <Calendar className="w-4 h-4" /> },
            { label: 'Statutory Gazettes', href: '/state/statutory', icon: <FileText className="w-4 h-4" /> },
            { label: 'Risk Heatmaps', href: '/state/risk', icon: <AlertTriangle className="w-4 h-4" /> },
            { label: 'State GIS Map', href: '/state/gis', icon: <Map className="w-4 h-4" /> },
            { label: 'State Reports', href: '/state/reports', icon: <FileSpreadsheet className="w-4 h-4" /> },
          ],
        },
      ];
    }

    if (pathname.startsWith('/district')) {
      return [
        {
          title: 'CALA DISTRICT WORKFLOW',
          items: [
            { label: 'Collector Work Queue', href: '/district/work-queue', icon: <CheckCircle2 className="w-4 h-4" />, badge: '5 Action' },
            { label: 'Acquisition Proposals', href: '/district/proposals', icon: <FilePlus className="w-4 h-4" /> },
            { label: 'District Projects', href: '/district/projects', icon: <FolderKanban className="w-4 h-4" /> },
            { label: 'Khasra Parcels', href: '/district/parcels', icon: <Layers className="w-4 h-4" /> },
          ],
        },
        {
          title: 'HEARINGS & DECLARATIONS',
          items: [
            { label: 'Section 15 Objections', href: '/district/objections', icon: <HelpCircle className="w-4 h-4" />, badge: '3 Urgent' },
            { label: 'Public Hearings', href: '/district/hearings', icon: <Calendar className="w-4 h-4" /> },
            { label: 'Section 23 Awards', href: '/district/awards', icon: <Award className="w-4 h-4" /> },
            { label: 'Compensation Awards', href: '/district/compensation', icon: <IndianRupee className="w-4 h-4" /> },
            { label: 'R&R Rehabilitation', href: '/district/rr', icon: <Users className="w-4 h-4" /> },
            { label: 'Possession Handover', href: '/district/possession', icon: <KeyRound className="w-4 h-4" /> },
            { label: 'SLA Statutory Timelines', href: '/district/sla', icon: <Calendar className="w-4 h-4" /> },
            { label: 'Gazette Notifications', href: '/district/statutory', icon: <FileText className="w-4 h-4" /> },
            { label: 'District GIS Viewer', href: '/district/gis', icon: <Map className="w-4 h-4" /> },
            { label: 'Verification Documents', href: '/district/documents', icon: <FileCheck className="w-4 h-4" /> },
            { label: 'Field Survey Sync', href: '/district/field', icon: <Smartphone className="w-4 h-4" /> },
          ],
        },
      ];
    }

    if (pathname.startsWith('/pia')) {
      return [
        {
          title: 'PIA PROJECT AGENCY',
          items: [
            { label: 'New Proposal Request', href: '/pia/new-project', icon: <PlusCircle className="w-4 h-4" /> },
            { label: 'My PIA Projects', href: '/pia/projects', icon: <FolderKanban className="w-4 h-4" /> },
            { label: 'DPR & Proposals', href: '/pia/proposals', icon: <FileText className="w-4 h-4" /> },
            { label: 'Spatial Right-of-Way', href: '/pia/gis', icon: <Map className="w-4 h-4" /> },
          ],
        },
        {
          title: 'ACQUISITION PROGRESS',
          items: [
            { label: 'Parcel Requirements', href: '/pia/land', icon: <Layers className="w-4 h-4" /> },
            { label: 'Statutory Documents', href: '/pia/documents', icon: <FileCheck className="w-4 h-4" /> },
            { label: 'Stage Workflows', href: '/pia/workflow', icon: <GitBranch className="w-4 h-4" /> },
            { label: 'Deposit Compensation', href: '/pia/compensation', icon: <IndianRupee className="w-4 h-4" /> },
            { label: 'R&R Budget Allocation', href: '/pia/rr', icon: <Users className="w-4 h-4" /> },
            { label: 'Possession Transfer', href: '/pia/possession', icon: <KeyRound className="w-4 h-4" /> },
            { label: 'PIA Progress Reports', href: '/pia/reports', icon: <FileSpreadsheet className="w-4 h-4" /> },
          ],
        },
      ];
    }

    if (pathname.startsWith('/field')) {
      return [
        {
          title: 'OFFLINE FIELD SURVEYOR',
          items: [
            { label: 'Assigned Parcels', href: '/field/assignments', icon: <Smartphone className="w-4 h-4" /> },
            { label: 'GPS Survey Map', href: '/field/map', icon: <Map className="w-4 h-4" /> },
            { label: 'Offline Queue & Sync', href: '/field/sync', icon: <WifiOff className="w-4 h-4" />, badge: 'IndexedDB' },
            { label: 'Completed Surveys', href: '/field/completed', icon: <CheckCircle2 className="w-4 h-4" /> },
          ],
        },
      ];
    }

    if (pathname.startsWith('/rr')) {
      return [
        {
          title: 'RESETTLEMENT & REHABILITATION',
          items: [
            { label: 'Affected Families', href: '/rr/families', icon: <Users className="w-4 h-4" /> },
            { label: 'Eligibility Matrix', href: '/rr/eligibility', icon: <FileCheck className="w-4 h-4" /> },
            { label: 'R&R Colony Plans', href: '/rr/plans', icon: <Building className="w-4 h-4" /> },
            { label: 'Entitlement Sanctions', href: '/rr/entitlements', icon: <HeartHandshake className="w-4 h-4" /> },
            { label: 'Benefit Delivery', href: '/rr/delivery', icon: <CheckCircle2 className="w-4 h-4" /> },
            { label: 'Rehabilitation Progress', href: '/rr/progress', icon: <BarChart3 className="w-4 h-4" /> },
            { label: 'R&R Compliance Audit', href: '/rr/reports', icon: <FileSpreadsheet className="w-4 h-4" /> },
          ],
        },
      ];
    }

    if (pathname.startsWith('/finance')) {
      return [
        {
          title: 'FINANCE & TREASURY',
          items: [
            { label: 'Compensation Awards', href: '/finance/compensation', icon: <IndianRupee className="w-4 h-4" /> },
            { label: 'Disbursement Approvals', href: '/finance/approvals', icon: <CheckCircle2 className="w-4 h-4" /> },
            { label: 'PFMS Direct Transfers', href: '/finance/payments', icon: <CreditCard className="w-4 h-4" /> },
            { label: 'Failed Payments Queue', href: '/finance/failed', icon: <XCircle className="w-4 h-4" />, badge: 'Attention' },
            { label: 'Disputed Claims Escrow', href: '/finance/disputes', icon: <AlertTriangle className="w-4 h-4" /> },
            { label: 'Financial Audit Reports', href: '/finance/reports', icon: <FileSpreadsheet className="w-4 h-4" /> },
          ],
        },
      ];
    }

    if (pathname.startsWith('/gis')) {
      return [
        {
          title: 'GIS & REMOTE SENSING',
          items: [
            { label: 'Spatial Projects Map', href: '/gis/projects', icon: <Map className="w-4 h-4" /> },
            { label: 'Parcel Polygons Layer', href: '/gis/parcels', icon: <Layers className="w-4 h-4" /> },
            { label: 'Shapefile / KML Import', href: '/gis/import', icon: <PlusCircle className="w-4 h-4" /> },
            { label: 'GeoJSON Export', href: '/gis/export', icon: <FileSpreadsheet className="w-4 h-4" /> },
            { label: 'Spatial Overlap Analytics', href: '/gis/analytics', icon: <BarChart3 className="w-4 h-4" /> },
            { label: 'Boundary Data Quality', href: '/gis/quality', icon: <ShieldCheck className="w-4 h-4" /> },
          ],
        },
      ];
    }

    if (pathname.startsWith('/citizen')) {
      return [
        {
          title: 'PUBLIC CITIZEN PORTAL',
          items: [
            { label: 'Citizen Home', href: '/citizen/home', icon: <Home className="w-4 h-4" /> },
            { label: 'Search Projects', href: '/citizen/projects', icon: <Search className="w-4 h-4" /> },
            { label: 'My Land Status', href: '/citizen/my-land', icon: <Layers className="w-4 h-4" /> },
            { label: 'Compensation Status', href: '/citizen/compensation', icon: <IndianRupee className="w-4 h-4" /> },
            { label: 'R&R Benefits', href: '/citizen/rr', icon: <Users className="w-4 h-4" /> },
            { label: 'Public Hearing Schedule', href: '/citizen/hearings', icon: <Calendar className="w-4 h-4" /> },
            { label: 'Statutory Notices', href: '/citizen/documents', icon: <FileText className="w-4 h-4" /> },
            { label: 'File Grievance / Objection', href: '/citizen/grievance', icon: <HelpCircle className="w-4 h-4" /> },
          ],
        },
      ];
    }

    // Default Fallback
    return [
      {
        title: 'MAIN NAVIGATION',
        items: [
          { label: 'Central Portal', href: '/central/overview', icon: <LayoutDashboard className="w-4 h-4" /> },
          { label: 'State Nodal Portal', href: '/state/overview', icon: <Building className="w-4 h-4" /> },
          { label: 'District CALA Portal', href: '/district/work-queue', icon: <MapPin className="w-4 h-4" /> },
          { label: 'PIA Portal', href: '/pia/projects', icon: <FolderKanban className="w-4 h-4" /> },
          { label: 'Offline Field Surveyor', href: '/field/assignments', icon: <Smartphone className="w-4 h-4" /> },
          { label: 'R&R Portal', href: '/rr/families', icon: <Users className="w-4 h-4" /> },
          { label: 'Finance & Treasury', href: '/finance/compensation', icon: <IndianRupee className="w-4 h-4" /> },
          { label: 'GIS Portal', href: '/gis/projects', icon: <Map className="w-4 h-4" /> },
          { label: 'Public Citizen Portal', href: '/citizen/home', icon: <Globe className="w-4 h-4" /> },
        ],
      },
    ];
  };

  const navSections = getNavSections();

  return (
    <aside
      className={cn(
        'bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col transition-all duration-200 shrink-0 z-30 select-none min-h-[calc(100vh-57px)]',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Role Banner Badge */}
      <div className="p-3 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center space-x-2 overflow-hidden">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-xs font-bold text-slate-200 truncate">
              {currentRoleOption.label}
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 mx-auto"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {navSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {!collapsed && (
              <h4 className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {section.title}
              </h4>
            )}

            {section.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors group relative',
                    isActive
                      ? 'bg-sky-600 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <span className={cn('shrink-0', isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200')}>
                    {item.icon}
                  </span>

                  {!collapsed && (
                    <span className="truncate flex-1">{item.label}</span>
                  )}

                  {!collapsed && item.badge && (
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded font-bold',
                        isActive ? 'bg-sky-800 text-sky-100' : 'bg-slate-800 text-slate-400 border border-slate-700'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* System Footer Links */}
      <div className="p-3 border-t border-slate-800 space-y-1">
        <Link
          href="/settings"
          className="flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <Settings className="w-4 h-4" />
          {!collapsed && <span>System Settings</span>}
        </Link>
        <Link
          href="/help"
          className="flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <HelpIcon className="w-4 h-4" />
          {!collapsed && <span>Help & Docs</span>}
        </Link>
      </div>
    </aside>
  );
}
