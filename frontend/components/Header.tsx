'use client';

import React from 'react';
import { ShieldCheck, Search, Building2, MapPin, UserCheck } from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { useAudit } from '@/context/AuditContext';
import { USER_ROLES, UserRole } from '@/lib/mockData';
import { NotificationCenter } from './NotificationCenter';
import Link from 'next/link';

export function Header() {
  const { activeRole, currentRoleOption, switchRole, selectedState, setSelectedState } = useRole();
  const { openDrawer } = useAudit();

  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 shadow-lg">
      <div className="px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Logo & National System Identity */}
        <div className="flex items-center space-x-3 min-w-max">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-sky-600 via-indigo-600 to-emerald-500 p-0.5 flex items-center justify-center shadow-md">
            <div className="w-full h-full bg-slate-900 rounded-[7px] flex items-center justify-center font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400 text-lg">
              NLAM
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-sm tracking-wide text-white">R-NLAM</span>
              <span className="hidden sm:inline-block bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">
                LIVE 5D MONITORING
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden md:block">
              Real-Time National Land Acquisition & Management Portal
            </p>
          </div>
        </div>

        {/* Global Context & Search */}
        <div className="hidden lg:flex items-center space-x-3 flex-1 max-w-md">
          {/* State Scope Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-800/80 border border-slate-700 text-xs px-2.5 py-1.5 rounded-lg text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="bg-transparent focus:outline-none text-white text-xs font-medium cursor-pointer"
            >
              <option value="All States" className="bg-slate-900">All States (National Scope)</option>
              <option value="Maharashtra" className="bg-slate-900">Maharashtra</option>
              <option value="Uttar Pradesh" className="bg-slate-900">Uttar Pradesh</option>
              <option value="Gujarat" className="bg-slate-900">Gujarat</option>
              <option value="Odisha" className="bg-slate-900">Odisha</option>
              <option value="Tamil Nadu" className="bg-slate-900">Tamil Nadu</option>
            </select>
          </div>

          {/* Quick Search */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Project Code, Khasra #, PFMS UTR..."
              className="w-full text-xs bg-slate-800/80 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        {/* Role Swapper & User Controls */}
        <div className="flex items-center space-x-3">
          {/* Role Swapper Select (For Easy Testing of All Portals) */}
          <div className="flex items-center space-x-2 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs">
            <UserCheck className="w-4 h-4 text-emerald-400 hidden sm:block" />
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold hidden sm:block">
                Active Portal Role
              </span>
              <select
                value={activeRole}
                onChange={(e) => switchRole(e.target.value as UserRole)}
                className="bg-transparent focus:outline-none font-bold text-white text-xs cursor-pointer py-0.5"
              >
                {USER_ROLES.map((roleOpt) => (
                  <option key={roleOpt.id} value={roleOpt.id} className="bg-slate-900 text-white font-medium">
                    {roleOpt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Audit Drawer Trigger */}
          <button
            onClick={openDrawer}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 hover:bg-emerald-900 text-xs font-semibold transition-colors"
            title="Open Tamper-Evident SHA-256 Audit Ledger"
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden xl:inline">Audit Ledger</span>
          </button>

          {/* Notification Center */}
          <NotificationCenter />

          {/* User Profile Avatar */}
          <Link
            href="/profile"
            className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
          >
            <div className="w-7 h-7 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center font-bold text-xs text-sky-400">
              {currentRoleOption.label.charAt(0)}
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
