'use client';

import React, { useState } from 'react';
import { Smartphone, Lock, ShieldCheck, ArrowRight } from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { useRouter } from 'next/navigation';

export default function CitizenLoginPage() {
  const { switchRole, showToast } = useRole();
  const router = useRouter();
  const [aadhaar, setAadhaar] = useState('');
  const [otp, setOtp] = useState('');

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    switchRole('CITIZEN');
    showToast('Aadhaar OTP Verified! Logged into Citizen Transparency Dashboard');
    router.push('/citizen/my-land');
  };

  return (
    <div className="max-w-md mx-auto my-12 bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
      <div className="text-center space-y-1">
        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
          <Smartphone className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Landowner Aadhaar Authentication</h2>
        <p className="text-xs text-slate-500">Log in with your Aadhaar number to view your land parcels & compensation</p>
      </div>

      <form onSubmit={handleAuth} className="space-y-4 text-xs">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">12-Digit Aadhaar Number</label>
          <input
            type="text"
            required
            value={aadhaar}
            onChange={(e) => setAadhaar(e.target.value)}
            placeholder="XXXX-XXXX-9812"
            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Enter 6-Digit Aadhaar OTP</label>
          <input
            type="password"
            required
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="882194"
            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono"
          />
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center space-x-2"
        >
          <span>Verify OTP & Enter</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
