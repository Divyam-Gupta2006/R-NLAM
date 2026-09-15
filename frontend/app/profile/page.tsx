'use client';

import React from 'react';
import { useRole } from '@/context/RoleContext';
import { User, ShieldCheck, Mail, MapPin, KeyRound, Building } from 'lucide-react';

export default function ProfilePage() {
  const { currentRoleOption, activeRole } = useRole();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 flex items-center space-x-5">
        <div className="w-16 h-16 rounded-full bg-slate-900 text-sky-400 font-extrabold text-2xl flex items-center justify-center border-2 border-slate-700 shadow-md">
          {currentRoleOption.label.charAt(0)}
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{currentRoleOption.label}</h1>
          <p className="text-xs text-slate-500">{currentRoleOption.description}</p>
          <div className="mt-2 inline-flex items-center space-x-2 text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Keycloak Authenticated (RBAC Verified)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
          <h3 className="font-semibold text-sm text-slate-900 border-b pb-2">Officer Credentials</h3>
          <div className="space-y-3 text-xs text-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Government Email:</span>
              <span className="font-mono font-medium">officer.nlam@gov.in</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Active Role ID:</span>
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-900 font-semibold">{activeRole}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Assigned Department:</span>
              <span className="font-medium">Ministry of Road Transport & Highways</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Jurisdiction Scope:</span>
              <span className="font-medium">National / All States</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
          <h3 className="font-semibold text-sm text-slate-900 border-b pb-2">Security & Audit Info</h3>
          <div className="space-y-3 text-xs text-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Session Security Token:</span>
              <span className="font-mono text-emerald-600 font-semibold">VALID_0x8F9A...</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Digital Signature Certificate:</span>
              <span className="font-semibold text-slate-900">Class-3 eMudhra Active</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Last Signed Audit Event:</span>
              <span className="font-mono text-slate-600">AUD-503 (0x11223344...)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
