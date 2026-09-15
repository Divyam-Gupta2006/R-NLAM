'use client';

import React from 'react';
import { MOCK_PROJECTS, Project } from '@/lib/mockData';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { ActionButtons } from '@/components/ActionButtons';
import { useRole } from '@/context/RoleContext';
import { MapViewer } from '@/components/MapViewer';
import { MOCK_PARCELS } from '@/lib/mockData';
import { formatCurrency } from '@/lib/utils';
import { Building, MapPin, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import Link from 'next/link';

export default function StateOverviewPage() {
  const { selectedState } = useRole();

  const filteredProjects = MOCK_PROJECTS.filter(
    (p) => selectedState === 'All States' || p.state === selectedState
  );

  const columns: Column<Project>[] = [
    {
      header: 'Project Name',
      accessorKey: 'name',
      cell: (p) => (
        <div>
          <Link href={`/project/${p.id}`} className="font-bold text-slate-900 hover:text-sky-600 block">
            {p.name}
          </Link>
          <span className="font-mono text-[11px] text-slate-500">{p.code} • {p.district}</span>
        </div>
      ),
    },
    { header: 'District', accessorKey: 'district', sortable: true },
    { header: 'Stage', accessorKey: 'stage', cell: (p) => <StatusBadge status={p.stage} size="sm" /> },
    { header: 'Possession %', cell: (p) => <span className="font-semibold">{p.possessionPercentage}%</span> },
    { header: 'Budget Disbursed', cell: (p) => <span>{formatCurrency(p.disbursed)}</span> },
    { header: 'SLA Status', accessorKey: 'slaStatus', cell: (p) => <StatusBadge status={p.slaStatus} size="sm" /> },
    { header: 'Actions', cell: (p) => <ActionButtons entityId={p.id} entityType="PROJECT" allowedActions={['APPROVE', 'RETURN', 'REJECT']} compact /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-blue-900 text-white p-6 rounded-2xl shadow-lg">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-extrabold">{selectedState} Nodal Overview</h1>
            <span className="bg-blue-500/20 text-blue-200 text-xs px-2 py-0.5 rounded font-bold border border-blue-400/30">
              STATE NODAL AUTHORITY
            </span>
          </div>
          <p className="text-xs text-blue-200 mt-1">
            State-level approval routing, inter-district coordination, and gazette declarations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-bold uppercase">State Projects</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{filteredProjects.length} Active</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-bold uppercase">Pending Approvals</span>
          <div className="text-2xl font-extrabold text-amber-600 mt-1">3 Required</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-bold uppercase">State Land Area</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">522.5 Ha</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-bold uppercase">Compliance Score</span>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">94%</div>
        </div>
      </div>

      <MapViewer center={[18.5204, 73.8567]} zoom={8} parcels={MOCK_PARCELS} height="360px" />

      <DataTable
        title={`${selectedState} Projects Directory`}
        data={filteredProjects}
        columns={columns}
        searchPlaceholder="Search state projects..."
      />
    </div>
  );
}
