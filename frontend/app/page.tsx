'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Spinner } from '@/components/ui';
import { homeFor, useSession } from '@/context/SessionContext';

export default function RootPage() {
  const { user, restoring } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (restoring) return;
    router.replace(user ? homeFor(user.role) : '/login');
  }, [user, restoring, router]);
  return (
    <div className="grid min-h-[50vh] place-items-center text-ink-muted">
      <Spinner />
    </div>
  );
}
