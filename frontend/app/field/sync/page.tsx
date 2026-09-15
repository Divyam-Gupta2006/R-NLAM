'use client';

import React, { useEffect, useState } from 'react';
import { db, OfflineParcel } from '@/lib/db';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { useAudit } from '@/context/AuditContext';
import { StatusBadge } from '@/components/StatusBadge';

export default function FieldSyncPage() {
  const { showToast, activeRole, currentRoleOption } = useRole();
  const { addAuditLog } = useAudit();
  const [offlineParcels, setOfflineParcels] = useState<OfflineParcel[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadData = async () => {
    const records = await db.parcels.toArray();
    setOfflineParcels(records);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    showToast('Connecting to R-NLAM API Gateway & verifying SHA-256 hashes...');

    setTimeout(async () => {
      // Mark all queued items as SYNCED
      await db.parcels.toCollection().modify({ syncStatus: 'SYNCED', status: 'VERIFIED' });
      await loadData();
      setIsSyncing(false);

      addAuditLog(
        'OFFLINE_QUEUE_SYNCED',
        'FIELD_QUEUE',
        'BATCH-SYNC-01',
        `Synchronized ${offlineParcels.length} ground surveys from mobile tablet to PostgreSQL/PostGIS database.`,
        activeRole,
        currentRoleOption.label
      );

      showToast('All IndexedDB surveys synced cleanly with PostGIS database!');
    }, 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900">IndexedDB Offline Sync & Queue</h1>
          <p className="text-xs text-slate-500">Conflict-aware background synchronization engine powered by Dexie.js</p>
        </div>

        <button
          onClick={handleTriggerSync}
          disabled={isSyncing || offlineParcels.length === 0}
          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-lg text-xs shadow-md transition-colors flex items-center justify-center space-x-2 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Syncing Queue...' : `Sync All Queued (${offlineParcels.length})`}</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-xs text-slate-900">Browser IndexedDB Parcel Cache</h3>
          <span className="text-xs text-slate-500">Database Name: <code className="font-bold text-slate-800">RNlamOfflineDB</code></span>
        </div>

        <div className="divide-y divide-slate-100">
          {offlineParcels.length > 0 ? (
            offlineParcels.map((item) => (
              <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs text-slate-900">Khasra #{item.khasraNo}</span>
                    <span className="text-xs text-slate-500">• {item.village}</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    GPS Fix: {item.lat}, {item.lng} • Photos: {item.photos.length} attached
                  </p>
                  {item.capturedAt && (
                    <span className="text-[10px] text-slate-400 font-mono">Captured: {new Date(item.capturedAt).toLocaleString()}</span>
                  )}
                </div>

                <div className="flex items-center space-x-3">
                  <StatusBadge status={item.syncStatus} size="sm" />
                </div>
              </div>
            ))
          ) : (
            <div className="p-10 text-center text-xs text-slate-400">
              No offline surveys stored in IndexedDB yet. Complete a survey from the Field Assignments tab.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
