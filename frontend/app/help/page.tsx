'use client';

import React from 'react';
import { HelpCircle, BookOpen, ShieldCheck, PhoneCall, FileText } from 'lucide-react';

export default function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">R-NLAM Knowledge Base & Guidelines</h1>
        <p className="text-xs text-slate-500">RFCTLARR Act 2013 Statutory Compliance & System Architecture Documentation</p>
      </div>

      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
          <BookOpen className="w-4 h-4 text-sky-600" />
          <span>The 5D Operational Architecture</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <strong className="text-slate-900 block mb-1">1. LAND</strong>
            <p className="text-slate-600 text-[11px]">Parcel ID, Khasra, area, PostGIS polygons, ownership & boundary verification.</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <strong className="text-slate-900 block mb-1">2. CASE</strong>
            <p className="text-slate-600 text-[11px]">Section 4, 11, 19 gazettes, objections, CALA hearings & awards.</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <strong className="text-slate-900 block mb-1">3. MONEY</strong>
            <p className="text-slate-600 text-[11px]">Land valuation, solatium, PFMS bank transfer, escrow & disputes.</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <strong className="text-slate-900 block mb-1">4. PEOPLE</strong>
            <p className="text-slate-600 text-[11px]">Affected families, SC/ST categories, R&R housing & annuity stipends.</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <strong className="text-slate-900 block mb-1">5. TIME</strong>
            <p className="text-slate-600 text-[11px]">Statutory deadlines, SLA breaches, delay risk scores & escalations.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
