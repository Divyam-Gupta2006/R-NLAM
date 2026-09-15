'use client';

import React, { useEffect, useState } from 'react';
import { projectsApi } from '@/lib/api/client';
import { Building2, MapPin, Layers, FileText, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function CentralProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    projectsApi.getAll()
      .then((res) => {
        if (res.data) {
          setProjects(res.data);
        } else {
          setError(res.error || 'Failed to load projects');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">National Land Acquisition Projects</h1>
          <p className="text-gray-600">Real-time database record of active national infrastructure projects</p>
        </div>
        <Link
          href="/pia/new-project"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition"
        >
          + Create New Project
        </Link>
      </div>

      {loading && (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
          Loading live project records from PostgreSQL...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Failed to fetch live projects: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj) => (
            <div key={proj.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition">
              <div className="flex justify-between items-start mb-3">
                <span className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 rounded-md">
                  {proj.code}
                </span>
                <span className="px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {proj.status}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 text-lg mb-2">{proj.name}</h3>
              <p className="text-xs text-gray-500 mb-4 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-gray-400" /> {proj.stateName} • {Array.isArray(proj.districtNames) ? proj.districtNames.join(', ') : proj.districtName}
              </p>
              
              <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-lg mb-4">
                <div>
                  <span className="text-gray-500 block">Required Land</span>
                  <span className="font-bold text-gray-900">{proj.requiredLand} ha</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Acquired Land</span>
                  <span className="font-bold text-emerald-600">{proj.acquiredLand || 0} ha</span>
                </div>
              </div>

              <Link
                href={`/project/${proj.id}`}
                className="block text-center w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition"
              >
                Open Project Workspace →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
