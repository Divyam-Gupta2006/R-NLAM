import type { Role } from './api/types';

export interface NavItem {
  label: string;
  href: string;
  icon: string; // lucide icon name, resolved in Sidebar
}
export interface NavSection {
  title: string;
  items: NavItem[];
}
export interface Portal {
  key: string;
  label: string;
  prefix: string;
  roles: Role[];
  sections: NavSection[];
}

/** Portals by URL prefix. Every route listed here is backed by live API data. */
export const PORTALS: Portal[] = [
  {
    key: 'central',
    label: 'National Command',
    prefix: '/central',
    roles: ['CENTRAL_ADMIN', 'CENTRAL_OFFICER'],
    sections: [
      {
        title: 'Command',
        items: [
          { label: 'Command dashboard', href: '/central/overview', icon: 'LayoutDashboard' },
          { label: 'Projects', href: '/central/projects', icon: 'FolderKanban' },
          { label: 'States', href: '/central/states', icon: 'Building' },
          { label: 'Districts', href: '/central/districts', icon: 'MapPin' },
          { label: 'Why is it stuck?', href: '/central/stuck', icon: 'AlertTriangle' },
          { label: 'Statutory calendar', href: '/central/statutory', icon: 'Calendar' },
          { label: 'Interest liability', href: '/central/liability', icon: 'IndianRupee' },
          { label: 'GIS consent gate', href: '/central/consent', icon: 'ShieldAlert' },
          { label: 'Owner reconciliation', href: '/central/reconciliation', icon: 'Fingerprint' },
          { label: 'Court case links', href: '/central/court-links', icon: 'Gavel' },
          { label: 'Ask the Act', href: '/central/ask-the-act', icon: 'BookOpenCheck' },
        ],
      },
      {
        title: 'Lifecycle',
        items: [
          { label: 'Land & parcels', href: '/central/land', icon: 'Layers' },
          { label: 'Compensation', href: '/central/compensation', icon: 'IndianRupee' },
          { label: 'R&R', href: '/central/rr', icon: 'HeartHandshake' },
          { label: 'Possession', href: '/central/possession', icon: 'KeyRound' },
          { label: 'State machines', href: '/central/workflows', icon: 'GitBranch' },
          { label: 'Rule packs', href: '/central/rules', icon: 'BookOpenCheck' },
        ],
      },
      {
        title: 'Governance',
        items: [
          { label: 'Audit trail', href: '/central/audit', icon: 'ShieldCheck' },
          { label: 'Analytics', href: '/central/analytics', icon: 'BarChart3' },
          { label: 'Integrations', href: '/central/integrations', icon: 'Globe' },
          { label: 'Users', href: '/central/users', icon: 'UserCheck' },
          { label: 'Reports', href: '/central/reports', icon: 'FileSpreadsheet' },
        ],
      },
    ],
  },
  {
    key: 'state',
    label: 'State Portal',
    prefix: '/state',
    roles: ['STATE_ADMIN', 'STATE_OFFICER', 'CENTRAL_ADMIN'],
    sections: [
      {
        title: 'Overview',
        items: [
          { label: 'State dashboard', href: '/state/overview', icon: 'LayoutDashboard' },
          { label: 'Projects', href: '/state/projects', icon: 'FolderKanban' },
          { label: 'Districts', href: '/state/districts', icon: 'MapPin' },
          { label: 'Approvals', href: '/state/approvals', icon: 'CheckCircle2' },
          { label: 'Why is it stuck?', href: '/state/stuck', icon: 'AlertTriangle' },
        ],
      },
      {
        title: 'Lifecycle',
        items: [
          { label: 'Statutory calendar', href: '/state/statutory', icon: 'Calendar' },
          { label: 'Interest liability', href: '/state/liability', icon: 'IndianRupee' },
          { label: 'GIS consent gate', href: '/state/consent', icon: 'ShieldAlert' },
          { label: 'Owner reconciliation', href: '/state/reconciliation', icon: 'Fingerprint' },
          { label: 'Court case links', href: '/state/court-links', icon: 'Gavel' },
          { label: 'Ask the Act', href: '/state/ask-the-act', icon: 'BookOpenCheck' },
          { label: 'SLA tracker', href: '/state/sla', icon: 'Clock' },
          { label: 'Land & parcels', href: '/state/land', icon: 'Layers' },
          { label: 'GIS map', href: '/state/gis', icon: 'Map' },
          { label: 'Compensation', href: '/state/compensation', icon: 'IndianRupee' },
          { label: 'R&R', href: '/state/rr', icon: 'HeartHandshake' },
          { label: 'Possession', href: '/state/possession', icon: 'KeyRound' },
          { label: 'Reports', href: '/state/reports', icon: 'FileSpreadsheet' },
        ],
      },
    ],
  },
  {
    key: 'district',
    label: 'District Collectorate',
    prefix: '/district',
    roles: ['DISTRICT_OFFICER', 'CENTRAL_ADMIN'],
    sections: [
      {
        title: 'Today',
        items: [
          { label: 'Work queue', href: '/district/work-queue', icon: 'Inbox' },
          { label: 'Why is it stuck?', href: '/district/stuck', icon: 'AlertTriangle' },
          { label: 'Statutory calendar', href: '/district/statutory', icon: 'Calendar' },
          { label: 'Interest liability', href: '/district/liability', icon: 'IndianRupee' },
          { label: 'GIS consent gate', href: '/district/consent', icon: 'ShieldAlert' },
          { label: 'Owner reconciliation', href: '/district/reconciliation', icon: 'Fingerprint' },
          { label: 'Court case links', href: '/district/court-links', icon: 'Gavel' },
          { label: 'SLA tracker', href: '/district/sla', icon: 'Clock' },
        ],
      },
      {
        title: 'Acquisition',
        items: [
          { label: 'Projects', href: '/district/projects', icon: 'FolderKanban' },
          { label: 'Proposals', href: '/district/proposals', icon: 'FileText' },
          { label: 'Parcels', href: '/district/parcels', icon: 'Layers' },
          { label: 'GIS map', href: '/district/gis', icon: 'Map' },
          { label: 'Objections', href: '/district/objections', icon: 'MessageSquareWarning' },
          { label: 'Hearings', href: '/district/hearings', icon: 'Gavel' },
          { label: 'Awards', href: '/district/awards', icon: 'Award' },
          { label: 'Compensation', href: '/district/compensation', icon: 'IndianRupee' },
          { label: 'R&R', href: '/district/rr', icon: 'HeartHandshake' },
          { label: 'Possession', href: '/district/possession', icon: 'KeyRound' },
          { label: 'Documents', href: '/district/documents', icon: 'FileCheck' },
          { label: 'Ask the Act', href: '/district/ask-the-act', icon: 'BookOpenCheck' },
          { label: 'Field verification', href: '/district/field', icon: 'Smartphone' },
        ],
      },
    ],
  },
  {
    key: 'pia',
    label: 'Requiring Body (PIA)',
    prefix: '/pia',
    roles: ['PIA_OFFICER', 'CENTRAL_ADMIN'],
    sections: [
      {
        title: 'Projects',
        items: [
          { label: 'My projects', href: '/pia/projects', icon: 'FolderKanban' },
          { label: 'New project', href: '/pia/new-project', icon: 'PlusCircle' },
          { label: 'Proposals', href: '/pia/proposals', icon: 'FileText' },
          { label: 'Approval workflow', href: '/pia/workflow', icon: 'GitBranch' },
        ],
      },
      {
        title: 'Progress',
        items: [
          { label: 'Land status', href: '/pia/land', icon: 'Layers' },
          { label: 'GIS map', href: '/pia/gis', icon: 'Map' },
          { label: 'Compensation', href: '/pia/compensation', icon: 'IndianRupee' },
          { label: 'R&R', href: '/pia/rr', icon: 'HeartHandshake' },
          { label: 'Possession & handover', href: '/pia/possession', icon: 'KeyRound' },
          { label: 'Documents', href: '/pia/documents', icon: 'FileCheck' },
          { label: 'Reports', href: '/pia/reports', icon: 'FileSpreadsheet' },
        ],
      },
    ],
  },
  {
    key: 'field',
    label: 'Field App',
    prefix: '/field',
    roles: ['FIELD_OFFICER', 'CENTRAL_ADMIN'],
    sections: [
      {
        title: 'Field',
        items: [
          { label: 'Assignments', href: '/field/assignments', icon: 'Compass' },
          { label: 'Map', href: '/field/map', icon: 'Map' },
          { label: 'Sync', href: '/field/sync', icon: 'WifiOff' },
          { label: 'Completed', href: '/field/completed', icon: 'CheckCircle2' },
        ],
      },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    prefix: '/finance',
    roles: ['FINANCE_OFFICER', 'CENTRAL_ADMIN'],
    sections: [
      {
        title: 'Disbursement',
        items: [
          { label: 'Approvals', href: '/finance/approvals', icon: 'CheckCircle2' },
          { label: 'Ready to pay', href: '/finance/payments', icon: 'CreditCard' },
          { label: 'All compensation', href: '/finance/compensation', icon: 'IndianRupee' },
          { label: 'Failed payments', href: '/finance/failed', icon: 'XCircle' },
          { label: 'Disputes & holds', href: '/finance/disputes', icon: 'AlertTriangle' },
          { label: 'Identity verification', href: '/finance/reconciliation', icon: 'Fingerprint' },
          { label: 'Reports', href: '/finance/reports', icon: 'FileSpreadsheet' },
        ],
      },
    ],
  },
  {
    key: 'gis',
    label: 'GIS Cell',
    prefix: '/gis',
    roles: ['GIS_OFFICER', 'CENTRAL_ADMIN'],
    sections: [
      {
        title: 'Spatial',
        items: [
          { label: 'Parcel map', href: '/gis/parcels', icon: 'Map' },
          { label: 'Consent gate', href: '/gis/consent', icon: 'ShieldAlert' },
          { label: 'Projects', href: '/gis/projects', icon: 'FolderKanban' },
          { label: 'Data quality', href: '/gis/quality', icon: 'ShieldCheck' },
          { label: 'Import', href: '/gis/import', icon: 'Upload' },
          { label: 'Export', href: '/gis/export', icon: 'Download' },
          { label: 'Spatial analytics', href: '/gis/analytics', icon: 'BarChart3' },
        ],
      },
    ],
  },
  {
    key: 'rr',
    label: 'R&R',
    prefix: '/rr',
    roles: ['RR_OFFICER', 'CENTRAL_ADMIN'],
    sections: [
      {
        title: 'Rehabilitation & resettlement',
        items: [
          { label: 'Families', href: '/rr/families', icon: 'Users' },
          { label: 'Eligibility', href: '/rr/eligibility', icon: 'UserCheck' },
          { label: 'Entitlements', href: '/rr/entitlements', icon: 'FileCheck' },
          { label: 'Plans', href: '/rr/plans', icon: 'FileText' },
          { label: 'Delivery', href: '/rr/delivery', icon: 'HeartHandshake' },
          { label: 'Progress', href: '/rr/progress', icon: 'BarChart3' },
          { label: 'Reports', href: '/rr/reports', icon: 'FileSpreadsheet' },
        ],
      },
    ],
  },
];

export function portalFor(pathname: string): Portal | undefined {
  return PORTALS.find((p) => pathname === p.prefix || pathname.startsWith(p.prefix + '/'));
}

export function portalsForRole(role: Role): Portal[] {
  return PORTALS.filter((p) => p.roles.includes(role));
}
