'use client';

import { ArrowRight, FlaskConical, Landmark, ShieldCheck, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { ErrorState, LoadingBlock, Spinner } from '@/components/ui';
import { homeFor, useSession } from '@/context/SessionContext';
import { ApiError } from '@/lib/api/client';
import { useApi } from '@/lib/api/hooks';
import type { Persona } from '@/lib/api/types';
import { humanize } from '@/lib/format';

const GROUPS: Array<{ title: string; roles: string[] }> = [
  { title: 'National', roles: ['CENTRAL_ADMIN', 'CENTRAL_OFFICER'] },
  { title: 'State', roles: ['STATE_ADMIN', 'STATE_OFFICER', 'FINANCE_OFFICER', 'GIS_OFFICER'] },
  { title: 'District & field', roles: ['DISTRICT_OFFICER', 'FIELD_OFFICER', 'RR_OFFICER'] },
  { title: 'Requiring body', roles: ['PIA_OFFICER'] },
];

export default function LoginPage() {
  const { user, loginAs } = useSession();
  const router = useRouter();
  const mode = useApi<{ mode: 'dev' | 'keycloak' }>('/auth/mode');
  const personas = useApi<Persona[]>(mode.data?.mode === 'dev' ? '/auth/personas' : null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (user) router.replace(homeFor(user.role));
  }, [user, router]);

  const signIn = async (email: string) => {
    setBusy(email);
    setError(null);
    try {
      await loginAs(email);
    } catch (e) {
      setError(e as ApiError);
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <div className="tricolour-rule" aria-hidden />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_1.3fr]">
        <section className="flex flex-col justify-center">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-navy text-xl font-black text-white">R</span>
            <div>
              <h1 className="text-2xl font-extrabold text-ink">R-NLAM</h1>
              <p className="text-sm text-ink-muted">Real-Time National Land Acquisition &amp; Management System</p>
            </div>
          </div>
          <p className="mt-6 text-3xl font-bold leading-tight text-navy">Connecting Land, Law &amp; People.</p>
          <p className="mt-3 max-w-md text-sm text-ink-muted">
            One statutory state machine from preliminary notification to possession: every parcel, rupee, family and deadline, with a tamper-evident record of who did what and why.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-ink">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-bharat" /> Guards cite the section of RFCTLARR 2013 they enforce
            </li>
            <li className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-saffron" /> Money in paise, dates in IST, audit chained with SHA-256
            </li>
          </ul>
          <Link href="/citizen/login" className="mt-8 inline-flex w-fit items-center gap-2 rounded-lg border border-line bg-panel px-4 py-3 text-sm font-semibold text-ink hover:border-saffron">
            <Smartphone className="h-4 w-4 text-saffron" /> I am a land holder: citizen login <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-6 text-xs text-ink-muted">Smart India Hackathon 2026 · PS 26016 · Team GAP BRIDGERS</p>
        </section>

        <section className="panel p-5">
          <h2 className="text-lg font-bold text-ink">Officer sign-in</h2>
          {mode.loading && !mode.data && <LoadingBlock rows={3} />}
          {mode.error && <ErrorState error={mode.error} onRetry={mode.reload} />}
          {mode.data?.mode === 'keycloak' && <p className="mt-2 text-sm text-ink-muted">This server uses single sign-on (Keycloak). Sign in through your department identity provider.</p>}
          {mode.data?.mode === 'dev' && (
            <>
              <p className="mt-1 flex items-start gap-1.5 text-xs text-warning">
                <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Dev mode: pick a demo persona. The server issues a signed token with that officer’s role and jurisdiction. There are no passwords because every account is fictional.
              </p>
              {error && <p className="mt-3 text-sm font-semibold text-danger">{error.message}</p>}
              {personas.error && <ErrorState error={personas.error} onRetry={personas.reload} />}
              {!personas.data && !personas.error && <LoadingBlock rows={6} />}
              <div className="mt-4 space-y-5">
                {GROUPS.map((g) => {
                  const people = (personas.data ?? []).filter((p) => g.roles.includes(p.role));
                  if (!people.length) return null;
                  return (
                    <div key={g.title}>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted">{g.title}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {people.map((p) => (
                          <button key={p.email} onClick={() => signIn(p.email)} disabled={!!busy} className="group rounded-lg border border-line bg-panel p-3 text-left hover:border-saffron hover:bg-saffron-soft/30">
                            <span className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-ink">{p.name}</span>
                              {busy === p.email ? <Spinner /> : <ArrowRight className="h-4 w-4 text-ink-muted group-hover:text-saffron" />}
                            </span>
                            <span className="mt-0.5 block text-xs text-ink-muted">{p.designation}</span>
                            <span className="mt-1 block text-[11px] font-semibold text-info">
                              {humanize(p.role)} · {p.jurisdiction}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
