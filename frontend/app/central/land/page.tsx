'use client';

import React, { useEffect, useState } from 'react';
import { parcelsApi } from '@/lib/api/client';
import { Map, Layers, CheckCircle2, AlertTriangle, Search } from 'lucide-react';

export default function CentralLandPage() {
  const [parcels, setParcels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    parcelsApi.getAll()
      .then((res) => {
        if (res.data) {
          setParcels(res.data);
        } else {
          setError(res.error || 'Failed to load parcels');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">National Land Parcel Registry</h1>
        <p className="text-gray-600">PostgreSQL spatial parcel database records across all projects</p>
      </div>

      {loading && (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
          Loading land parcel database records...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Failed to fetch parcel records: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200 text-xs uppercase">
                <tr>
                  <th className="p-4">Parcel / Khasra No</th>
                  <th className="p-4">Village & District</th>
                  <th className="p-4">Landowner</th>
                  <th className="p-4">Total Area</th>
                  <th className="p-4">Verification State</th>
                  <th className="p-4">Acquisition Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {parcels.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 font-mono font-bold text-indigo-600">
                      Khasra {p.khasraNumber} ({p.parcelNumber})
                    </td>
                    <td className="p-4 text-gray-800">
                      {p.villageName}, {p.districtName}, {p.stateName}
                    </td>
                    <td className="p-4 text-gray-900 font-medium">{p.landOwnerName}</td>
                    <td className="p-4 text-gray-900 font-bold">{p.totalArea} ha</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                        p.verificationState === 'OFFICER_VERIFIED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {p.verificationState}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 text-blue-700">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
