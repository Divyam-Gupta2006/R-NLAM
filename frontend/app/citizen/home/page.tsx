'use client';

import React, { useEffect, useState } from 'react';
import { citizenApi } from '@/lib/api/client';
import { Building2, MapPin, Search, FileText, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function CitizenHomePage() {
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    citizenApi.getSummary()
      .then((res) => {
        if (res.data) {
          setSummary(res.data);
        } else {
          setError(res.error || 'Failed to load citizen portal summary');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-indigo-700 to-blue-600 text-white rounded-2xl p-8 shadow-lg space-y-4">
        <h1 className="text-3xl font-extrabold">R-NLAM Citizen Transparency Portal</h1>
        <p className="text-indigo-100 max-w-2xl text-sm leading-relaxed">
          Public portal providing transparent tracking for land acquisition, compensation awards, and R&R entitlement benefits under RFCTLARR 2013.
        </p>
        <div className="flex gap-4 pt-2">
          <Link href="/citizen/projects" className="px-5 py-2.5 bg-white text-indigo-700 rounded-lg font-bold text-sm hover:bg-indigo-50 transition">
            Browse Public Projects
          </Link>
          <Link href="/citizen/my-land" className="px-5 py-2.5 bg-indigo-800 text-white border border-indigo-500 rounded-lg font-bold text-sm hover:bg-indigo-900 transition">
            Check My Land Parcel
          </Link>
        </div>
      </div>

      {loading && (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
          Loading portal summary...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Failed to fetch public summary: {error}
        </div>
      )}

      {!loading && !error && summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-2">
            <span className="text-xs font-semibold text-gray-500 uppercase">Public Infrastructure Projects</span>
            <div className="text-3xl font-bold text-gray-900">{summary.publicProjectsCount}</div>
            <p className="text-xs text-gray-500">Active national highway and railway projects</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-2">
            <span className="text-xs font-semibold text-gray-500 uppercase">Acquired Land Hectares</span>
            <div className="text-3xl font-bold text-emerald-600">{summary.totalAcquiredAreaHectares} ha</div>
            <p className="text-xs text-gray-500">Verified and acquired land parcels</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-2">
            <span className="text-xs font-semibold text-gray-500 uppercase">Affected Beneficiary Families</span>
            <div className="text-3xl font-bold text-indigo-600">{summary.totalBeneficiariesCount}</div>
            <p className="text-xs text-gray-500">Families covered under R&R entitlement schemes</p>
          </div>
        </div>
      )}
    </div>
  );
}
