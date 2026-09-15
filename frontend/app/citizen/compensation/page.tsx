'use client';

import React, { useEffect, useState } from 'react';
import { citizenApi } from '@/lib/api/client';
import { IndianRupee, CheckCircle2, Clock } from 'lucide-react';

export default function CitizenCompensationPage() {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    citizenApi.getMyCompensation()
      .then((res) => {
        if (res.data) {
          setCases(res.data);
        } else {
          setError(res.error || 'Failed to load compensation records');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Compensation & Award Status</h1>
        <p className="text-gray-600">Track land acquisition valuation awards and treasury direct payout status</p>
      </div>

      {loading && (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
          Loading compensation database records...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Failed to fetch compensation status: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cases.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <span className="px-2.5 py-1 text-xs font-mono font-bold bg-emerald-100 text-emerald-800 rounded">
                  Status: {c.status}
                </span>
                <span className="text-lg font-extrabold text-emerald-600 flex items-center">
                  ₹{c.amount?.toLocaleString('en-IN')}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Beneficiary: {c.beneficiaryName}</h3>
              <p className="text-xs text-gray-500">
                Khasra No: {c.parcel?.khasraNumber} • Award No: {c.award?.awardNumber || 'N/A'}
              </p>
              <div className="text-xs bg-gray-50 p-3 rounded-lg text-gray-600">
                Bank Account: {c.bankAccount ? `•••• ${c.bankAccount.slice(-4)}` : 'Verified Bank Account'} ({c.ifscCode || 'SBIN0001234'})
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
