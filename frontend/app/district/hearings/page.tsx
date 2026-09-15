'use client';

import React from 'react';
import { Calendar, MapPin, UserCheck } from 'lucide-react';

export default function DistrictHearingsPage() {
  const hearings = [
    { title: 'CALA Hearing for Khasra 88/4 (Bishnuli Village)', date: '18 Sep 2026 at 11:00 AM', venue: 'District Collectorate Court Hall 2', presidingOfficer: 'Collector Gautam Buddha Nagar' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">CALA Public Hearings Schedule</h1>
        <p className="text-xs text-slate-500">Official hearings under Section 15 of RFCTLARR Act 2013</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        {hearings.map((h, idx) => (
          <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <h3 className="font-bold text-sm text-slate-900">{h.title}</h3>
            <div className="text-xs text-slate-600 space-y-1">
              <p>📅 <strong>Date & Time:</strong> {h.date}</p>
              <p>📍 <strong>Venue:</strong> {h.venue}</p>
              <p>👤 <strong>Presiding Officer:</strong> {h.presidingOfficer}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
