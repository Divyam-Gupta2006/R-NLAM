'use client';

import React, { useEffect, useState } from 'react';
import { analyticsApi } from '@/lib/api/client';
import { Building2, MapPin, CheckCircle2, TrendingUp } from 'lucide-react';

export default function CentralStatesPage() {
  const [states, setStates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analyticsApi.getStates()
      .then((res) => {
        if (res.data) {
          setStates(res.data);
        } else {
          setError(res.error || 'Failed to load state metrics');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">State Performance Matrix</h1>
        <p className="text-gray-600">State-wise land acquisition progress aggregated from PostgreSQL database</p>
      </div>

      {loading && (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
          Loading state metrics...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Failed to fetch state analytics: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {states.map((st) => (
            <div key={st.stateCode} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <span className="px-2.5 py-1 text-xs font-bold bg-indigo-100 text-indigo-800 rounded">
                  {st.stateCode}
                </span>
                <span className="text-sm font-semibold text-emerald-600 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" /> {st.acquisitionPercentage}% Acquired
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900">{st.stateName}</h3>

              <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-lg">
                <div>
                  <span className="text-gray-500 block">Total Projects</span>
                  <span className="font-bold text-gray-900">{st.totalProjects}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Acquired / Required</span>
                  <span className="font-bold text-indigo-600">{st.acquiredLand} / {st.requiredLand} ha</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
