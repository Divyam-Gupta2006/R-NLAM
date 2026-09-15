'use client';

import React from 'react';
import { CheckCircle2, Clock, HelpCircle, Award, KeyRound, ShieldAlert } from 'lucide-react';
import { ActionButtons } from '@/components/ActionButtons';
import { StatusBadge } from '@/components/StatusBadge';
import { DataTable, Column } from '@/components/DataTable';

interface WorkItem {
  id: string;
  khasraNo: string;
  project: string;
  village: string;
  actionRequired: string;
  deadline: string;
  daysRemaining: number;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

export default function DistrictWorkQueuePage() {
  const items: WorkItem[] = [
    { id: 'WQ-101', khasraNo: '88/4', project: 'Delhi-Varanasi HSR', village: 'Bishnuli', actionRequired: 'Hear Section 15 Objection #3', deadline: '2026-09-10', daysRemaining: -5, priority: 'CRITICAL' },
    { id: 'WQ-102', khasraNo: '142/A', project: 'Mumbai-Pune Expressway', village: 'Lonikand', actionRequired: 'Sign Section 23 Award Declaration', deadline: '2026-09-18', daysRemaining: 3, priority: 'HIGH' },
    { id: 'WQ-103', khasraNo: '92/1', project: 'Dedicated Freight Corridor', village: 'Dabhasa', actionRequired: 'Verify Field Survey Geotags', deadline: '2026-09-25', daysRemaining: 10, priority: 'MEDIUM' },
  ];

  const columns: Column<WorkItem>[] = [
    { header: 'Khasra #', accessorKey: 'khasraNo', cell: (w) => <span className="font-bold text-slate-900">{w.khasraNo}</span> },
    { header: 'Project', accessorKey: 'project' },
    { header: 'Village', accessorKey: 'village' },
    { header: 'Action Required', accessorKey: 'actionRequired', cell: (w) => <span className="font-semibold text-slate-900">{w.actionRequired}</span> },
    { header: 'Statutory Deadline', accessorKey: 'deadline' },
    { header: 'SLA Status', cell: (w) => (
      <span className={`font-bold px-2 py-0.5 rounded text-xs ${w.daysRemaining < 0 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
        {w.daysRemaining < 0 ? `${Math.abs(w.daysRemaining)} days overdue` : `${w.daysRemaining} days left`}
      </span>
    ) },
    { header: 'Actions', cell: (w) => <ActionButtons entityId={w.id} entityType="DISTRICT_ACTION" allowedActions={['APPROVE', 'RETURN', 'REJECT', 'RAISE_QUERY']} compact /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-amber-900 text-white p-6 rounded-2xl shadow-lg">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-extrabold">CALA Collector Work Queue</h1>
            <span className="bg-amber-500/20 text-amber-200 text-xs px-2 py-0.5 rounded font-bold border border-amber-400/30">
              DISTRICT CALA DESK
            </span>
          </div>
          <p className="text-xs text-amber-200 mt-1">
            Competent Authority Land Acquisition statutory decision desk for objections, awards & payments.
          </p>
        </div>
      </div>

      <DataTable title="Pending CALA Statutory Actions" data={items} columns={columns} searchPlaceholder="Search action items..." />
    </div>
  );
}
