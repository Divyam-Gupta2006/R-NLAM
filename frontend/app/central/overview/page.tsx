'use client';

import React, { useEffect, useState } from 'react';
import { analyticsApi, projectsApi } from '@/lib/api/client';
import { MapViewer } from '@/components/MapViewer';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { ActionButtons } from '@/components/ActionButtons';
import { formatCurrency } from '@/lib/utils';
import { Layers, FolderKanban, IndianRupee, Users, Clock, AlertTriangle, TrendingUp, ShieldCheck, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function CentralOverviewPage() {
  const [kpis, setKpis] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [kpiRes, projRes] = await Promise.all([
          analyticsApi.getKpis(),
          projectsApi.getAll(),
        ]);

        if (kpiRes.error) {
          setError(`Analytics API Error: ${kpiRes.error}`);
          setLoading(false);
          return;
        }

        if (projRes.error) {
          setError(`Projects API Error: ${projRes.error}`);
          setLoading(false);
          return;
        }

        setKpis(kpiRes.data);
        setProjects(projRes.data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to connect to backend server');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const projectColumns: Column<any>[] = [
    {
      header: 'Project Name & Code',
      accessorKey: 'name',
      sortable: true,
      cell: (p) => (
        <div>
          <Link href={`/project/${p.id}`} className="font-bold text-slate-900 hover:text-sky-600 block">
            {p.name}
          </Link>
          <span className="font-mono text-[11px] text-slate-500">{p.code} • {p.piaName}</span>
        </div>
      ),
    },
    {
      header: 'State / Sector',
      accessorKey: 'stateName',
      sortable: true,
      cell: (p) => (
        <span className="font-medium text-slate-700">
          {p.stateName} ({p.sector})
        </span>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (p) => <StatusBadge status={p.status} size="sm" />,
    },
    {
      header: 'Land Acquired',
      accessorKey: 'acquiredLand',
      cell: (p) => {
        const pct = p.acquisitionProgress ? Math.round(p.acquisitionProgress) : 0;
        return (
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-semibold">
              <span>{p.acquiredLand}/{p.requiredLand} ha</span>
              <span>{pct}%</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-600 h-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      header: 'Estimated Cost',
      accessorKey: 'estimatedCost',
      cell: (p) => (
        <div>
          <span className="font-semibold text-slate-900 block">{formatCurrency(p.estimatedCost)} Cr</span>
        </div>
      ),
    },
    {
      header: 'Actions',
      cell: (p) => <ActionButtons entityId={p.id} entityType="PROJECT" allowedActions={['APPROVE', 'RAISE_QUERY']} compact />,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex items-center space-x-3 text-slate-600">
          <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
          <span className="font-medium text-sm">Connecting to R-NLAM Backend API...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 space-y-2">
        <div className="flex items-center space-x-2 font-bold text-base">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <span>API Connection Error</span>
        </div>
        <p className="text-xs">{error}</p>
        <p className="text-xs text-rose-600 font-mono">Backend server expected at http://localhost:4000/api</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-lg">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-extrabold tracking-tight">National Overview Dashboard</h1>
            <span className="bg-sky-500/20 text-sky-300 text-xs px-2.5 py-0.5 rounded-full font-bold border border-sky-400/30">
              CENTRAL COMMAND
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Real-time multi-state monitoring across the 5D Framework: Land, Case, Money, People & Time.
          </p>
        </div>
        <Link
          href="/central/projects"
          className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center space-x-2 shrink-0"
        >
          <span>All National Projects ({projects.length}) →</span>
        </Link>
      </div>

      {/* 5D Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">1D LAND</span>
            <Layers className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {kpis?.land?.acquiredHa?.toLocaleString() || 0} <span className="text-xs text-slate-500 font-normal">ha</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold flex items-center space-x-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{kpis?.land?.acquiredPercentage || 0}% of {kpis?.land?.requiredHa?.toLocaleString() || 0} ha Required</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">2D CASE</span>
            <FolderKanban className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {kpis?.projects?.total || 0} <span className="text-xs text-slate-500 font-normal">Active Projects</span>
          </div>
          <div className="text-[11px] text-slate-500">
            PostgreSQL Database Synced
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">3D MONEY</span>
            <IndianRupee className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {formatCurrency(kpis?.financials?.paidCr || 0)} <span className="text-xs text-slate-500 font-normal">Cr</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Disbursed out of {formatCurrency(kpis?.financials?.budgetCr || 0)} Cr Total
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">4D PEOPLE</span>
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {kpis?.rr?.rehabilitatedFamilies || 0} <span className="text-xs text-slate-500 font-normal">Families</span>
          </div>
          <div className="text-[11px] text-slate-500">
            R&R Benefits Delivered ({kpis?.rr?.totalFamilies || 0} Total Affected)
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">5D TIME</span>
            <Clock className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {kpis?.projects?.highRisk || 0} <span className="text-xs text-slate-500 font-normal">High Risk</span>
          </div>
          <div className="text-[11px] text-slate-500">
            AI Delay Risk Machine Learning Engine
          </div>
        </div>
      </div>

      {/* GIS Spatial Map Section */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-sky-600" />
            <h2 className="font-bold text-sm text-slate-900">National PostGIS Spatial Map Viewer</h2>
          </div>
          <span className="text-xs font-mono text-slate-500 bg-white px-2 py-0.5 rounded border">
            Live PostGIS GeoJSON API
          </span>
        </div>
        <div className="h-[400px]">
          <MapViewer />
        </div>
      </div>

      {/* Projects Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">National Land Acquisition Projects Directory</h2>
          <span className="text-xs font-semibold text-slate-500">{projects.length} Real Projects Registered</span>
        </div>
        <DataTable data={projects} columns={projectColumns} searchPlaceholder="Search project by name or code..." />
      </div>
    </div>
  );
}
