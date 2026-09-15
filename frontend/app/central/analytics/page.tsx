'use client';

import React, { useState } from 'react';
import { aiApi } from '@/lib/api/client';
import { Search, Sparkles, Database, BarChart3, ArrowRight } from 'lucide-react';

export default function CentralAnalyticsPage() {
  const [query, setQuery] = useState('Which districts have the highest compensation backlog?');
  const [nlpResult, setNlpResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuery = () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    aiApi.nlpQuery(query)
      .then((res) => {
        if (res.data) {
          setNlpResult(res.data);
        } else {
          setError(res.error || 'NLP Query failed');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Natural Language Policy Analytics</h1>
        <p className="text-gray-600">Translate plain language questions into safe SQL representations and visualization maps</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <label className="block text-sm font-semibold text-gray-700">Enter Policy Query</label>
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            placeholder="e.g. Show projects where possession is below 70%"
          />
          <button
            onClick={handleQuery}
            disabled={loading}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> {loading ? 'Executing NLP...' : 'Run Analytics'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Failed to process NLP analytics query: {error}
        </div>
      )}

      {nlpResult && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2 text-indigo-700 font-semibold text-sm">
            <Database className="w-4 h-4" /> Generated Safe SQL Representation:
          </div>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
            {nlpResult.generated_sql}
          </pre>

          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
            <span className="text-xs font-bold text-gray-500 uppercase">Visual Summary</span>
            <p className="text-sm font-semibold text-gray-900">{nlpResult.summary_text}</p>
          </div>
        </div>
      )}
    </div>
  );
}
