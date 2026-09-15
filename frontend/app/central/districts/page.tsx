'use client';

import React, { useEffect, useState } from 'react';
import { analyticsApi } from '@/lib/api/client';
import { MapPin, TrendingUp } from 'lucide-react';

export default function CentralDistrictsPage() {
  const [districts, setDistricts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analyticsApi.getDistricts()
      .then((res) => {
        if (res.data) {
          setDistricts(res.data);
        } else {
          setError(res.error || 'Failed to load district metrics');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">District Operational Monitoring</h1>
        <p className="text-gray-600">District-level land acquisition metrics calculated live from database</p>
      </div>

      {loading && (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
          Loading district metrics...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Failed to fetch district analytics: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {districts.map((dist) => (
            <div key={dist.districtCode} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <span className="px-2.5 py-1 text-xs font-bold bg-purple-100 text-purple-800 rounded">
                  {dist.districtCode}
                </span>
                <span className="text-sm font-semibold text-emerald-600 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" /> {dist.acquisitionPercentage}% Acquired
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900">{dist.districtName}</h3>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> State: {dist.stateName}
              </p>

              <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-lg">
                <div>
                  <span className="text-gray-500 block">Active Projects</span>
                  <span className="font-bold text-gray-900">{dist.totalProjects}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Acquired / Required</span>
                  <span className="font-bold text-purple-600">{dist.acquiredLand} / {dist.requiredLand} ha</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
