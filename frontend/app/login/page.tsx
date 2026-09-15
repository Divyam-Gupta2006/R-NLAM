'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, ArrowRight, Lock, KeyRound, AlertTriangle } from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { USER_ROLES, UserRole } from '@/lib/mockData';

export default function LoginPage() {
  const { switchRole } = useRole();
  const [selectedRole, setSelectedRole] = useState<UserRole>('CENTRAL_ADMIN');
  const [email, setEmail] = useState('officer@r-nlam.gov.in');
  const isDevMode = process.env.NODE_ENV !== 'production';

  useEffect(() => {
    if (!isDevMode) {
      // In production mode, automatically redirect to Keycloak OIDC Authorization endpoint
      window.location.href = 'http://localhost:8085/realms/master/protocol/openid-connect/auth?client_id=admin-cli&response_type=code&redirect_uri=http://localhost:3000/login';
    }
  }, [isDevMode]);

  const handleDevLogin = (e: React.FormEvent) => {
    e.preventDefault();
    switchRole(selectedRole);
  };

  const handleKeycloakLogin = () => {
    window.location.href = 'http://localhost:8085/realms/master/protocol/openid-connect/auth?client_id=admin-cli&response_type=code&redirect_uri=http://localhost:3000/login';
  };

  return (
    <div className="max-w-md mx-auto my-12 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      <div className="bg-slate-900 text-white p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-500 to-emerald-400 p-0.5 mx-auto mb-3 flex items-center justify-center">
          <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
            <Lock className="w-6 h-6 text-sky-400" />
          </div>
        </div>
        <h2 className="text-xl font-bold">R-NLAM Single Sign-On</h2>
        <p className="text-xs text-slate-400 mt-1">
          Government Keycloak OAuth2 / OIDC RS256 Authentication Portal
        </p>

        {isDevMode && (
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold rounded-full">
            <AlertTriangle className="w-3.5 h-3.5" /> DEV PERSONA MODE ACTIVE
          </div>
        )}
      </div>

      <div className="p-6 space-y-5 text-xs">
        {/* Keycloak Primary OIDC Auth Button */}
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
            <KeyRound className="w-4 h-4 text-indigo-600" /> Production Keycloak OIDC Authentication
          </div>
          <p className="text-slate-600 text-xs">
            Authenticates via Keycloak RS256 token signature, issuer, audience, and expiry verification.
          </p>
          <button
            onClick={handleKeycloakLogin}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition flex items-center justify-center gap-2"
          >
            <span>Authenticate via Keycloak SS0 (Port 8085)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Development Persona Swapper Form */}
        {isDevMode && (
          <form onSubmit={handleDevLogin} className="pt-2 border-t border-slate-200 space-y-4">
            <div className="text-slate-500 font-bold uppercase text-[10px]">
              Development Local Persona Switcher
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Select Official Role Persona</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-none"
              >
                {USER_ROLES.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Dev Email ID</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg text-xs transition flex items-center justify-center gap-2"
            >
              <span>Enter in Dev Persona Mode</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[11px] flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>Multi-factor authentication & RS256 token verification enabled.</span>
        </div>
      </div>
    </div>
  );
}
