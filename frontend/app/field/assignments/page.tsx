'use client';

import React, { useEffect, useState } from 'react';
import { Smartphone, MapPin, CheckCircle2, Wifi, WifiOff, ArrowRight } from 'lucide-react';
import { MOCK_PARCELS, Parcel } from '@/lib/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import Link from 'next/link';
import { db } from '@/lib/db';

export default function FieldAssignmentsPage() {
  const [offlineCount, setOfflineCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Check IndexedDB stored count
    db.parcels.count().then((cnt: number) => setOfflineCount(cnt));

    const updateStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Offline PWA Banner */}
      <div className={`p-5 rounded-2xl shadow-lg border text-white flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        isOnline ? 'bg-teal-900 border-teal-800' : 'bg-amber-900 border-amber-800'
      }`}>
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            {isOnline ? <Wifi className="w-5 h-5 text-emerald-400" /> : <WifiOff className="w-5 h-5 text-amber-400 animate-pulse" />}
            <h1 className="text-lg font-bold">
              {isOnline ? 'Field PWA Engine (Online Mode)' : 'Field PWA Engine (Offline Mode - IndexedDB Active)'}
            </h1>
          </div>
          <p className="text-xs opacity-90">
            {isOnline
              ? 'Connected to R-NLAM Cloud. Local IndexedDB cache ready for zero-connectivity field surveys.'
              : 'Working completely offline. All GPS boundaries, photo geotags & survey data are stored in browser IndexedDB.'}
          </p>
        </div>

        <Link
          href="/field/sync"
          className="px-4 py-2 bg-white text-slate-900 font-bold text-xs rounded-lg shadow-sm hover:bg-slate-100 flex items-center justify-center space-x-2 shrink-0"
        >
          <span>Sync Queue ({offlineCount})</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Assigned Field Parcels List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Assigned Cadastral Survey Parcels</h2>
          <span className="text-xs font-semibold text-slate-500">{MOCK_PARCELS.length} Parcels Assigned</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MOCK_PARCELS.map((p) => (
            <div key={p.id} className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border">
                  Khasra #{p.khasraNo}
                </span>
                <StatusBadge status={p.fieldSurveyStatus} size="sm" />
              </div>

              <div>
                <h3 className="font-bold text-sm text-slate-900">{p.projectName}</h3>
                <p className="text-xs text-slate-500">{p.village}, {p.taluka} ({p.district})</p>
              </div>

              <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Landowner:</span>
                  <span className="font-semibold">{p.ownerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Claimed Area:</span>
                  <span>{p.areaHectares} Hectares</span>
                </div>
              </div>

              <div className="pt-1">
                <Link
                  href={`/field/parcel/${p.id}`}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-colors"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Open Ground Capture Form</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
