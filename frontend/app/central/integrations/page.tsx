'use client';

import React, { useEffect, useState } from 'react';
import { integrationsApi } from '@/lib/api/client';
import { Server, Activity, CheckCircle2, AlertCircle } from 'lucide-react';

export default function CentralIntegrationsPage() {
  const [adapters, setAdapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    integrationsApi.getStatus()
      .then((res) => {
        if (res.data) {
          setAdapters(res.data);
        } else {
          setError(res.error || 'Failed to load integration status');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Government Integration Gateway</h1>
        <p className="text-gray-600">Real-time connectivity status across external adapters and internal microservices</p>
      </div>

      {loading && (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
          Checking integration adapter health...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Failed to fetch integration gateway status: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {adapters.map((ad, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                  ad.status === 'LIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {ad.status === 'LIVE' ? '🟢 LIVE' : '🟠 SIMULATED'}
                </span>
                <span className="text-xs text-gray-400 font-mono">Latency: {ad.latencyMs}ms</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900">{ad.name}</h3>
              <p className="text-xs text-gray-600">{ad.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
