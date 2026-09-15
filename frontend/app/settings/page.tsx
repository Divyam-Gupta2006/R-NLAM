'use client';

import React from 'react';
import { Settings, Shield, Database, Sliders, Server, Cpu } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">System Configuration & Integrations</h1>
        <p className="text-xs text-slate-500">Configure spatial PostGIS thresholds, PFMS gateways, and AI risk models</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
          <div className="flex items-center space-x-2 text-slate-900 font-semibold text-sm">
            <Server className="w-4 h-4 text-sky-600" />
            <span>PostGIS & Spatial Engines</span>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">PostGIS Geometry Tolerance:</span>
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">0.0001 deg (~1m)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Auto-Detect Boundary Overlaps:</span>
              <span className="text-emerald-600 font-semibold">ENABLED</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
          <div className="flex items-center space-x-2 text-slate-900 font-semibold text-sm">
            <Cpu className="w-4 h-4 text-purple-600" />
            <span>AI Microservices & OCR Risk</span>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Tesseract Document OCR:</span>
              <span className="text-emerald-600 font-semibold">ONLINE (FastAPI 3.13)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">XGBoost Delay Risk Threshold:</span>
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">&gt; 65 Risk Score</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
