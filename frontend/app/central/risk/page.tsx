'use client';

import React, { useEffect, useState } from 'react';
import { aiApi } from '@/lib/api/client';
import { AlertOctagon, TrendingUp, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function CentralRiskPage() {
  const [riskData, setRiskData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    aiApi.assessRisk({
      historical_duration_days: 240,
      pending_statutory_tasks: 4,
      objections_count: 7,
      compensation_backlog_cr: 12.5,
      parcel_disputes: 3,
    })
      .then((res) => {
        if (res.data) {
          setRiskData(res.data);
        } else {
          setError(res.error || 'Failed to execute AI risk model');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">National AI Delay-Risk Engine</h1>
        <p className="text-gray-600">Scikit-learn delay risk model evaluation output for active infrastructure projects</p>
      </div>

      {loading && (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
          Running FastAPI Delay-Risk Model...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Failed to fetch AI risk assessment: {error}
        </div>
      )}

      {!loading && !error && riskData && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-gray-100 pb-4">
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase">Risk Level</span>
              <h2 className="text-3xl font-extrabold text-red-600">{riskData.risk_level} ({riskData.risk_score}/100)</h2>
            </div>
            <ShieldAlert className="w-12 h-12 text-red-500" />
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900 text-sm">Contributing Risk Factors</h4>
            <ul className="space-y-2">
              {riskData.contributing_factors?.map((factor: string, idx: number) => (
                <li key={idx} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <AlertOctagon className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  {factor}
                </li>
              ))}
            </ul>
          </div>

          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-indigo-900">
            <strong>Recommended Attention:</strong> {riskData.recommended_attention}
          </div>
        </div>
      )}
    </div>
  );
}
