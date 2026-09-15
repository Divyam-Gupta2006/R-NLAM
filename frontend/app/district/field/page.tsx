'use client';

import React from 'react';
import { Smartphone, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { ActionButtons } from '@/components/ActionButtons';

export default function DistrictFieldPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">District Surveyor Field Queue & Sync</h1>
        <p className="text-xs text-slate-500">Offline PWA ground survey submissions awaiting CALA verification</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <Smartphone className="w-5 h-5 text-teal-600" />
            <div>
              <h3 className="font-bold text-xs text-slate-900">Surveyor-04 Batch #109</h3>
              <p className="text-xs text-slate-500">3 Geotagged Photos • GPS Polygon (Haveli Taluka)</p>
            </div>
          </div>
          <ActionButtons entityId="SURV-109" entityType="FIELD_SURVEY" allowedActions={['VERIFY_PARCEL', 'APPROVE']} compact />
        </div>
      </div>
    </div>
  );
}
