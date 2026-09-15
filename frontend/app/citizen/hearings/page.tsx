'use client';

import React from 'react';
import { Calendar, MapPin } from 'lucide-react';

export default function CitizenHearingsPage() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Public Hearing Schedule</h1>
        <p className="text-xs text-slate-500">Upcoming CALA Collector court hearing dates for land acquisition</p>
      </div>

      <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3 text-xs">
        <div className="flex items-start space-x-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <Calendar className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <h3 className="font-bold text-slate-900">Section 15 Public Hearing - Haveli Taluka</h3>
            <p className="text-slate-600 mt-1">Date: 25 Sep 2026 at 11:30 AM</p>
            <p className="text-slate-600">Venue: Collectorate Court Room #3, Pune</p>
          </div>
        </div>
      </div>
    </div>
  );
}
