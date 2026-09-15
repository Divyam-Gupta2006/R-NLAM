'use client';

import React, { createContext, useContext, useState } from 'react';
import { AuditEntry, MOCK_AUDIT_LOGS } from '@/lib/mockData';
import { generateHash } from '@/lib/utils';

interface AuditContextType {
  logs: AuditEntry[];
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  addAuditLog: (action: string, entityType: string, entityId: string, details: string, role: string, user: string) => void;
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

export function AuditProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = useState<AuditEntry[]>(MOCK_AUDIT_LOGS);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);

  const addAuditLog = (
    action: string,
    entityType: string,
    entityId: string,
    details: string,
    role: string,
    user: string
  ) => {
    const lastHash = logs.length > 0 ? logs[0].hash : '0x0000000000000000000000000000000000000000000000000000000000000000';
    const timestamp = new Date().toISOString();
    const newHash = generateHash(`${lastHash}-${action}-${entityId}-${timestamp}`);

    const newEntry: AuditEntry = {
      id: `AUD-${Date.now().toString().slice(-4)}`,
      timestamp,
      user,
      role,
      action,
      entityType,
      entityId,
      previousHash: lastHash,
      hash: newHash,
      details
    };

    setLogs(prev => [newEntry, ...prev]);
  };

  return (
    <AuditContext.Provider
      value={{
        logs,
        isDrawerOpen,
        openDrawer,
        closeDrawer,
        addAuditLog
      }}
    >
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit() {
  const context = useContext(AuditContext);
  if (!context) {
    throw new Error('useAudit must be used within AuditProvider');
  }
  return context;
}
