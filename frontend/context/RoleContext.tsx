'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, USER_ROLES, UserRoleOption } from '@/lib/mockData';
import { useRouter } from 'next/navigation';

interface RoleContextType {
  activeRole: UserRole;
  currentRoleOption: UserRoleOption;
  switchRole: (role: UserRole) => void;
  selectedState: string;
  setSelectedState: (state: string) => void;
  selectedDistrict: string;
  setSelectedDistrict: (district: string) => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [activeRole, setActiveRole] = useState<UserRole>('CENTRAL_ADMIN');
  const [selectedState, setSelectedState] = useState<string>('All States');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('All Districts');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const router = useRouter();

  const currentRoleOption = USER_ROLES.find(r => r.id === activeRole) || USER_ROLES[0];

  const switchRole = (role: UserRole) => {
    setActiveRole(role);
    const target = USER_ROLES.find(r => r.id === role);
    if (target) {
      showToast(`Switched role to ${target.label}`);
      router.push(target.portalPath);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  return (
    <RoleContext.Provider
      value={{
        activeRole,
        currentRoleOption,
        switchRole,
        selectedState,
        setSelectedState,
        selectedDistrict,
        setSelectedDistrict,
        toastMessage,
        showToast,
      }}
    >
      {children}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-2xl flex items-center space-x-3 border border-slate-700 animate-bounce">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
