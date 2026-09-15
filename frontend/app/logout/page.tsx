'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, CheckCircle2 } from 'lucide-react';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/login');
    }, 2000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="max-w-md mx-auto my-20 bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-6 h-6" />
      </div>
      <h2 className="text-lg font-bold text-slate-900">Signed Out Safely</h2>
      <p className="text-xs text-slate-500">
        Your security session key has been invalidated and audit logs flushed. Redirecting to login...
      </p>
    </div>
  );
}
