'use client';

import React, { useEffect, useState } from 'react';
import { citizenApi } from '@/lib/api/client';
import { MapPin, Search, CheckCircle2 } from 'lucide-react';

export default function CitizenMyLandPage() {
  const [parcels, setParcels] = useState<any[]>([]);
  const [searchKhasra, setSearchKhasra] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchParcels = (khasra?: string) => {
    setLoading(true);
    setError(null);
    citizenApi.getMyLand(khasra)
      .then((res) => {
        if (res.data) {
          setParcels(res.data);
        } else {
          setError(res.error || 'Failed to load land records');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchParcels();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Land Parcel Lookup</h1>
        <p className="text-gray-600">Search your Khasra number to check acquisition and verification status</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex gap-3">
        <input
          type="text"
          value={searchKhasra}
          onChange={(e) => setSearchKhasra(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Enter Khasra / Survey Number (e.g. 78/2A)"
        />
        <button
          onClick={() => fetchParcels(searchKhasra)}
          className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
        >
          Search Parcel
        </button>
      </div>

      {loading && (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
          Searching land parcel database...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Failed to fetch parcel records: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {parcels.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <span className="px-2.5 py-1 text-xs font-mono font-bold bg-indigo-100 text-indigo-800 rounded">
                  Khasra {p.khasraNumber}
                </span>
                <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
                  {p.verificationState || p.status}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Landowner: {p.landOwnerName}</h3>
              <p className="text-xs text-gray-500">
                Project: {p.project?.name || 'National Infrastructure'} ({p.villageName}, {p.districtName})
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-lg">
                <div>
                  <span className="text-gray-500 block">Total Land Area</span>
                  <span className="font-bold text-gray-900">{p.totalArea} ha</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Acquired Area</span>
                  <span className="font-bold text-emerald-600">{p.acquiredArea || 0} ha</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
