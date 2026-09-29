'use client';

import { usePathname, useRouter } from 'next/navigation';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from '@/lib/api/client';
import { clearApiCache } from '@/lib/api/hooks';
import type { Role, SessionUser } from '@/lib/api/types';

interface LoginResult {
  token: string;
  expiresAt: string;
  user: SessionUser;
}

interface SessionValue {
  user: SessionUser | null;
  restoring: boolean;
  loginAs: (email: string, opts?: { stay?: boolean }) => Promise<void>;
  requestOtp: (phone: string) => Promise<{ requestId: string; devOtp?: string | null; note?: string }>;
  verifyOtp: (requestId: string, code: string) => Promise<void>;
  logout: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

/** Landing page for each role's portal. */
export function homeFor(role: Role): string {
  switch (role) {
    case 'CENTRAL_ADMIN':
    case 'CENTRAL_OFFICER':
      return '/central/overview';
    case 'STATE_ADMIN':
    case 'STATE_OFFICER':
      return '/state/overview';
    case 'DISTRICT_OFFICER':
      return '/district';
    case 'PIA_OFFICER':
      return '/pia';
    case 'FIELD_OFFICER':
      return '/field';
    case 'RR_OFFICER':
      return '/rr';
    case 'FINANCE_OFFICER':
      return '/finance';
    case 'GIS_OFFICER':
      return '/gis';
    case 'CITIZEN':
      return '/citizen/home';
  }
}

const PUBLIC_PATHS = ['/login', '/citizen/login', '/help'];

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [restoring, setRestoring] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Restore a session from this tab's storage.
  useEffect(() => {
    if (!tokenStore.get()) {
      setRestoring(false);
      return;
    }
    api
      .get<SessionUser>('/auth/me')
      .then(setUser)
      .catch(() => tokenStore.set(null))
      .finally(() => setRestoring(false));
  }, []);

  const logout = useCallback(() => {
    const wasCitizen = user?.role === 'CITIZEN';
    tokenStore.set(null);
    clearApiCache();
    setUser(null);
    router.push(wasCitizen ? '/citizen/login' : '/login');
  }, [router, user]);

  useEffect(() => {
    const onUnauthorized = () => {
      if (tokenStore.get()) logout();
    };
    window.addEventListener('rnlam:unauthorized', onUnauthorized);
    return () => window.removeEventListener('rnlam:unauthorized', onUnauthorized);
  }, [logout]);

  // Send signed-out visitors to the right login page.
  useEffect(() => {
    if (restoring || user) return;
    if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return;
    router.replace(pathname.startsWith('/citizen') ? '/citizen/login' : '/login');
  }, [restoring, user, pathname, router]);

  const accept = useCallback(
    (res: LoginResult, stay?: boolean) => {
      tokenStore.set(res.token);
      clearApiCache();
      setUser(res.user);
      if (!stay) router.push(homeFor(res.user.role));
    },
    [router],
  );

  const loginAs = useCallback(
    async (email: string, opts?: { stay?: boolean }) => {
      accept(await api.post<LoginResult>('/auth/dev-login', { email }), opts?.stay);
    },
    [accept],
  );

  const requestOtp = useCallback((phone: string) => api.post<{ requestId: string; devOtp?: string | null; note?: string }>('/auth/citizen/otp', { phone }), []);

  const verifyOtp = useCallback(
    async (requestId: string, code: string) => {
      accept(await api.post<LoginResult>('/auth/citizen/verify', { requestId, code }));
    },
    [accept],
  );

  const value = useMemo(() => ({ user, restoring, loginAs, requestOtp, verifyOtp, logout }), [user, restoring, loginAs, requestOtp, verifyOtp, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

/** The signed-in user; pages under the app shell only render once this exists. */
export function useUser(): SessionUser {
  const { user } = useSession();
  if (!user) throw new Error('useUser called without a session');
  return user;
}
