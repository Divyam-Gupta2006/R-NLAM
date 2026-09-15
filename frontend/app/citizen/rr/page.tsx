'use client';

import React, { useEffect, useState } from 'react';
import { citizenApi } from '@/lib/api/client';
import { Home, Gift, CheckCircle2 } from 'lucide-react';

export default function CitizenRRPage() {
  const [families, setFamilies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    citizenApi.getMyRR()
      .then((res) => {
        if (res.data) {
          setFamilies(res.data);
        } else {
          setError(res.error || 'Failed to load R&R records');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Rehabilitation & Resettlement Benefits</h1>
        <p className="text-gray-600">Track housing entitlements, one-time grants, and benefit delivery under RFCTLARR 2013</p>
      </div>

      {loading && (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
          Loading R&R family records...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Failed to fetch R&R benefit status: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {families.map((fam) => (
            <div key={fam.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <span className="px-2.5 py-1 text-xs font-bold bg-indigo-100 text-indigo-800 rounded">
                  Village: {fam.villageName}
                </span>
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                  fam.isVulnerable ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {fam.isVulnerable ? 'Vulnerable Category' : 'General Category'}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Family Head: {fam.headName}</h3>
              <p className="text-xs text-gray-500">Family Size: {fam.familySize} members</p>

              <div className="space-y-2 pt-2">
                <span className="text-xs font-semibold text-gray-700 block">Assigned Benefits & Deliveries</span>
                {fam.rrCases?.map((c: any) => (
                  <div key={c.id} className="bg-gray-50 p-3 rounded-lg text-xs space-y-1 border border-gray-100">
                    <div className="font-bold text-indigo-600">Case Status: {c.status}</div>
                    {c.deliveries?.map((d: any) => (
                      <div key={d.id} className="text-gray-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> {d.benefitName} (Delivered)
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
