'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { projectsApi, workflowApi, parcelsApi, compensationApi, rrApi, possessionApi, auditApi } from '@/lib/api/client';
import { StatusBadge } from '@/components/StatusBadge';
import { MapViewer } from '@/components/MapViewer';
import { DataTable, Column } from '@/components/DataTable';
import { ActionButtons } from '@/components/ActionButtons';
import { formatCurrency } from '@/lib/utils';
import {
  LayoutDashboard,
  Calendar,
  Map,
  Layers,
  GitBranch,
  FileCheck,
  HelpCircle,
  Award,
  IndianRupee,
  Users,
  KeyRound,
  Smartphone,
  AlertTriangle,
  ShieldCheck,
  Loader2
} from 'lucide-react';

export default function ProjectWorkspacePage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<any>(null);
  const [workflowInstance, setWorkflowInstance] = useState<any>(null);
  const [parcels, setParcels] = useState<any[]>([]);
  const [compensationCases, setCompensationCases] = useState<any[]>([]);
  const [rrCases, setRrCases] = useState<any[]>([]);
  const [possessionCases, setPossessionCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    | 'Overview'
    | 'Timeline'
    | 'GIS'
    | 'Parcels'
    | 'Workflow'
    | 'Documents'
    | 'Objections'
    | 'Awards'
    | 'Compensation'
    | 'R&R'
    | 'Possession'
    | 'Field'
    | 'Risk'
    | 'Audit'
  >('Overview');

  useEffect(() => {
    async function loadProjectData() {
      setLoading(true);
      setError(null);
      try {
        const projRes = await projectsApi.getById(projectId);
        if (projRes.error) {
          setError(`Project API Error: ${projRes.error}`);
          setLoading(false);
          return;
        }
        setProject(projRes.data);

        // Fetch sub-resources
        const [wfRes, parcelsRes, compRes, rrRes, possRes] = await Promise.all([
          workflowApi.getInstanceByProjectId(projectId),
          parcelsApi.getAll({ projectId }),
          compensationApi.getCases(projectId),
          rrApi.getCases(projectId),
          possessionApi.getCases(projectId),
        ]);

        if (wfRes.data) setWorkflowInstance(wfRes.data);
        if (parcelsRes.data) setParcels(parcelsRes.data);
        if (compRes.data) setCompensationCases(compRes.data);
        if (rrRes.data) setRrCases(rrRes.data);
        if (possRes.data) setPossessionCases(possRes.data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch project workspace data');
      } finally {
        setLoading(false);
      }
    }

    if (projectId) {
      loadProjectData();
    }
  }, [projectId]);

  const tabs = [
    { id: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'Timeline', icon: <Calendar className="w-4 h-4" /> },
    { id: 'GIS', icon: <Map className="w-4 h-4" /> },
    { id: 'Parcels', icon: <Layers className="w-4 h-4" /> },
    { id: 'Workflow', icon: <GitBranch className="w-4 h-4" /> },
    { id: 'Documents', icon: <FileCheck className="w-4 h-4" /> },
    { id: 'Objections', icon: <HelpCircle className="w-4 h-4" /> },
    { id: 'Awards', icon: <Award className="w-4 h-4" /> },
    { id: 'Compensation', icon: <IndianRupee className="w-4 h-4" /> },
    { id: 'R&R', icon: <Users className="w-4 h-4" /> },
    { id: 'Possession', icon: <KeyRound className="w-4 h-4" /> },
    { id: 'Field', icon: <Smartphone className="w-4 h-4" /> },
    { id: 'Risk', icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'Audit', icon: <ShieldCheck className="w-4 h-4" /> },
  ] as const;

  const parcelColumns: Column<any>[] = [
    {
      header: 'Parcel # / Khasra',
      accessorKey: 'parcelNumber',
      cell: (p) => (
        <div>
          <span className="font-bold text-slate-900 block">{p.parcelNumber}</span>
          <span className="text-[11px] text-slate-500 font-mono">Khasra {p.khasraNumber} • {p.villageName}</span>
        </div>
      ),
    },
    { header: 'Landowner', accessorKey: 'landOwnerName' },
    { header: 'Area (ha)', accessorKey: 'totalArea' },
    { header: 'Class', accessorKey: 'landClass' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (p) => <StatusBadge status={p.status} size="sm" />,
    },
    {
      header: 'Verification',
      accessorKey: 'verificationState',
      cell: (p) => <StatusBadge status={p.verificationState} size="sm" />,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex items-center space-x-3 text-slate-600">
          <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
          <span className="font-medium text-sm">Loading Project Workspace from NestJS Backend...</span>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 space-y-2">
        <div className="flex items-center space-x-2 font-bold text-base">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <span>Project Workspace Load Failure</span>
        </div>
        <p className="text-xs">{error || `Project with ID ${projectId} not found in database.`}</p>
      </div>
    );
  }

  const acqPct = project.acquisitionProgress ? Math.round(project.acquisitionProgress) : 0;
  const possPct = project.possessionProgress ? Math.round(project.possessionProgress) : 0;

  return (
    <div className="space-y-6">
      {/* Project Workspace Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl space-y-4 border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="font-mono font-bold text-xs bg-sky-500/20 text-sky-300 px-2.5 py-0.5 rounded border border-sky-500/30">
                {project.code}
              </span>
              <h1 className="text-xl font-extrabold">{project.name}</h1>
            </div>
            <p className="text-xs text-slate-400">
              {project.piaName} • {project.stateName} ({project.sector})
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <StatusBadge status={project.status} size="lg" />
            {workflowInstance && <StatusBadge status={workflowInstance.currentStage} size="lg" />}
          </div>
        </div>

        {/* Quick Stats Pill Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs border-t border-slate-800">
          <div>
            <span className="text-slate-400 block">Acquired Land:</span>
            <span className="font-bold text-white">{project.acquiredLand} / {project.requiredLand} ha ({acqPct}%)</span>
          </div>
          <div>
            <span className="text-slate-400 block">Possessed Land:</span>
            <span className="font-bold text-white">{project.possessedLand} ha ({possPct}%)</span>
          </div>
          <div>
            <span className="text-slate-400 block">Estimated Cost:</span>
            <span className="font-bold text-emerald-400">{formatCurrency(project.estimatedCost)} Cr</span>
          </div>
          <div>
            <span className="text-slate-400 block">Current Workflow Stage:</span>
            <span className="font-bold text-sky-300">{workflowInstance?.currentStage || 'DRAFT'}</span>
          </div>
        </div>
      </div>

      {/* Workspace Navigation Tabs */}
      <div className="flex items-center space-x-1 border-b border-slate-200 overflow-x-auto pb-1 bg-white p-2 rounded-xl shadow-xs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab.icon}
            <span>{tab.id}</span>
          </button>
        ))}
      </div>

      {/* Tab Content Display */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs min-h-[400px]">
        {activeTab === 'Overview' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-slate-900">Project Executive Overview</h3>
                <p className="text-xs text-slate-600">
                  Multi-dimensional project summary spanning statutory notifications, PostGIS geometry, and possession handovers.
                </p>
              </div>
            </div>

            <MapViewer projectId={projectId} height="360px" />
          </div>
        )}

        {activeTab === 'GIS' && (
          <div className="space-y-4">
            <h3 className="font-bold text-base text-slate-900">Project Spatial GIS Boundary & Cadastral Parcels</h3>
            <MapViewer projectId={projectId} height="500px" />
          </div>
        )}

        {activeTab === 'Parcels' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-base text-slate-900">Registered Land Parcels ({parcels.length})</h3>
            </div>
            <DataTable data={parcels} columns={parcelColumns} searchPlaceholder="Filter parcels by number..." />
          </div>
        )}

        {activeTab === 'Workflow' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-slate-900">RFCTLARR Act 2013 Workflow Engine</h3>
                <p className="text-xs text-slate-500">Current Stage: {workflowInstance?.currentStage || 'N/A'}</p>
              </div>
            </div>

            {workflowInstance && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Template: {workflowInstance.template?.name}</span>
                  <StatusBadge status={workflowInstance.status} size="sm" />
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-900">Recent Workflow Action Trail:</h4>
                  <div className="space-y-1.5">
                    {workflowInstance.actions?.map((act: any) => (
                      <div key={act.id} className="p-2.5 bg-white rounded-lg border text-xs flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-800">{act.actionName}</span>: {act.fromStage} &rarr; <span className="text-sky-700 font-semibold">{act.toStage}</span>
                          <span className="text-[11px] text-slate-500 block">By: {act.user?.name || act.performedBy}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">{new Date(act.createdAt).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Compensation' && (
          <div className="space-y-4">
            <h3 className="font-bold text-base text-slate-900">Compensation Cases ({compensationCases.length})</h3>
            <div className="space-y-2">
              {compensationCases.map((c: any) => (
                <div key={c.id} className="p-3 bg-slate-50 border rounded-xl text-xs flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-900">{c.beneficiaryName}</span> (Bank Account: {c.bankAccount})
                    <span className="text-slate-500 block">Amount: {formatCurrency(c.amount)} Cr</span>
                  </div>
                  <StatusBadge status={c.status} size="sm" />
                </div>
              ))}
              {compensationCases.length === 0 && <p className="text-xs text-slate-500">No compensation cases recorded for this project.</p>}
            </div>
          </div>
        )}

        {activeTab === 'R&R' && (
          <div className="space-y-4">
            <h3 className="font-bold text-base text-slate-900">Resettlement & Rehabilitation Cases ({rrCases.length})</h3>
            <div className="space-y-2">
              {rrCases.map((r: any) => (
                <div key={r.id} className="p-3 bg-slate-50 border rounded-xl text-xs flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-900">R&R Case ID: {r.id}</span>
                    <span className="text-slate-500 block">Family ID: {r.familyId}</span>
                  </div>
                  <StatusBadge status={r.status} size="sm" />
                </div>
              ))}
              {rrCases.length === 0 && <p className="text-xs text-slate-500">No R&R cases recorded for this project.</p>}
            </div>
          </div>
        )}

        {activeTab === 'Possession' && (
          <div className="space-y-4">
            <h3 className="font-bold text-base text-slate-900">Land Possession Handover Certificates ({possessionCases.length})</h3>
            <div className="space-y-2">
              {possessionCases.map((p: any) => (
                <div key={p.id} className="p-3 bg-slate-50 border rounded-xl text-xs flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-900">Authority: {p.authority}</span>
                    <span className="text-slate-500 block">Remarks: {p.remarks}</span>
                  </div>
                  <StatusBadge status={p.status} size="sm" />
                </div>
              ))}
              {possessionCases.length === 0 && <p className="text-xs text-slate-500">No possession records filed for this project.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
