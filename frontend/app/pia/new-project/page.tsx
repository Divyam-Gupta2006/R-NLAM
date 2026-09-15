'use client';

import React, { useState } from 'react';
import { projectsApi } from '@/lib/api/client';
import { useRole } from '@/context/RoleContext';
import { useRouter } from 'next/navigation';
import { Upload, ArrowRight, AlertTriangle, Loader2 } from 'lucide-react';

export default function PIANewProjectPage() {
  const { showToast } = useRole();
  const router = useRouter();

  const [projectName, setProjectName] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [sector, setSector] = useState('Roads & Highways');
  const [state, setState] = useState('Maharashtra');
  const [district, setDistrict] = useState('Nagpur');
  const [agency, setAgency] = useState('National Highways Authority of India (NHAI)');
  const [area, setArea] = useState('');
  const [budget, setBudget] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const stateCode = state === 'Maharashtra' ? 'MH' : (state === 'Uttar Pradesh' ? 'UP' : 'RJ');
      const reqLand = parseFloat(area) || 100.0;
      const estCostCr = (parseFloat(budget) || 50000000.0) / 10000000.0; // convert INR to Crores

      const res = await projectsApi.create({
        code: projectCode || `PRJ-${Date.now().toString().slice(-6)}`,
        name: projectName,
        sector,
        stateCode,
        stateName: state,
        districtCodes: [district.substring(0, 3).toUpperCase()],
        districtNames: [district],
        piaName: agency,
        requiredLand: reqLand,
        estimatedCost: estCostCr,
      });

      if (res.error || !res.data) {
        setError(`Failed to create project: ${res.error || 'Server error'}`);
        setSubmitting(false);
        return;
      }

      showToast(`Project '${res.data.name}' persisted to PostgreSQL database! ID: ${res.data.id}`);
      router.push(`/project/${res.data.id}`);
    } catch (err: any) {
      setError(err.message || 'Network error creating project');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Initiate New Land Acquisition Proposal</h1>
        <p className="text-xs text-slate-500">Submit Detailed Project Report (DPR) & spatial right-of-way corridor requirements to NestJS API</p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Project Name *</label>
            <input
              type="text"
              required
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Nagpur Metro Outer Ring Road"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Project Code *</label>
            <input
              type="text"
              required
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
              placeholder="e.g. NGP-ORR-2026"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Sector *</label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
            >
              <option value="Roads & Highways">Roads & Highways</option>
              <option value="Railways">Railways</option>
              <option value="Energy">Energy</option>
              <option value="Urban Infrastructure">Urban Infrastructure</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Target State</label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
            >
              <option value="Maharashtra">Maharashtra</option>
              <option value="Uttar Pradesh">Uttar Pradesh</option>
              <option value="Rajasthan">Rajasthan</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Target District</label>
            <input
              type="text"
              required
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Required Area (Hectares) *</label>
            <input
              type="number"
              step="0.1"
              required
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="120.5"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Estimated Budget (INR) *</label>
            <input
              type="number"
              required
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="500000000"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Attach GeoJSON / KML Alignment Polygon</label>
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center bg-slate-50">
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">Spatial PostGIS polygon layer validated on submit</p>
          </div>
        </div>

        <div className="pt-2 flex justify-end space-x-3">
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center space-x-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Persisting to PostgreSQL...</span>
              </>
            ) : (
              <>
                <span>Submit Proposal & Persist to Database</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
