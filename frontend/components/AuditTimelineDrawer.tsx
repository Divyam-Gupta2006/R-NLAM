'use client';

import React, { useState } from 'react';
import { X, ShieldCheck, Hash, User, Clock, FileText, ArrowRight } from 'lucide-react';
import { useAudit } from '@/context/AuditContext';
import { formatDate } from '@/lib/utils';

export function AuditTimelineDrawer() {
  const { logs, isDrawerOpen, closeDrawer } = useAudit();
  const [filterQuery, setFilterQuery] = useState('');

  if (!isDrawerOpen) return null;

  const filteredLogs = logs.filter(
    (log) =>
      log.action.toLowerCase().includes(filterQuery.toLowerCase()) ||
      log.entityId.toLowerCase().includes(filterQuery.toLowerCase()) ||
      log.user.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base">Tamper-Evident Audit Ledger</h2>
              <p className="text-xs text-slate-400 font-mono">
                Cryptographic SHA-256 Hash Chaining
              </p>
            </div>
          </div>
          <button
            onClick={closeDrawer}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Input */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search audit trail by entity ID, action, or officer..."
            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        {/* Audit Log Timeline list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((entry, idx) => (
              <div key={entry.id} className="relative pl-6 border-l-2 border-slate-300 space-y-2">
                {/* Node indicator */}
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-emerald-600 border-2 border-white shadow-xs" />

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {entry.action.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center space-x-1 text-[11px] text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                  <p className="font-medium text-slate-900">{entry.details}</p>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-200">
                    <div className="flex items-center space-x-1">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>{entry.user} ({entry.role})</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <FileText className="w-3 h-3 text-slate-400" />
                      <span>{entry.entityType}: #{entry.entityId}</span>
                    </div>
                  </div>

                  {/* Hash Chain verification info */}
                  <div className="bg-slate-900 text-slate-300 p-2 rounded text-[10px] font-mono space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>PREV HASH:</span>
                      <span className="truncate max-w-[240px] text-slate-500">{entry.previousHash}</span>
                    </div>
                    <div className="flex items-center justify-between text-emerald-400 font-bold">
                      <span className="flex items-center space-x-1">
                        <Hash className="w-3 h-3" />
                        <span>BLOCK HASH:</span>
                      </span>
                      <span className="truncate max-w-[240px]">{entry.hash}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-slate-400">
              <ShieldCheck className="w-10 h-10 mx-auto stroke-1 text-slate-300 mb-2" />
              <p className="text-sm font-semibold">No audit entries found</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between">
          <span>Ledger Integrity: <strong className="text-emerald-700">VERIFIED HASH CHAIN</strong></span>
          <button
            onClick={closeDrawer}
            className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-xs font-semibold hover:bg-slate-800"
          >
            Close Ledger
          </button>
        </div>
      </div>
    </div>
  );
}
