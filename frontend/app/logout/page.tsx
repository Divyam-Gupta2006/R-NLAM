'use client';

import { useEffect } from 'react';
import { useSession } from '@/context/SessionContext';

export default function LogoutPage() {
  const { logout } = useSession();
  useEffect(() => {
    logout();
  }, [logout]);
  return null;
}
