'use client';

import { ArrowRight, Fingerprint, Languages, Scale, ShieldCheck, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { Wordmark } from '@/components/Logo';
import { ErrorState, LoadingBlock, Spinner } from '@/components/ui';
import { homeFor, useSession } from '@/context/SessionContext';
import { ApiError } from '@/lib/api/client';
import { useApi } from '@/lib/api/hooks';
import type { Persona } from '@/lib/api/types';

const GROUPS: Array<{ title: string; roles: string[] }> = [
  { title: 'National', roles: ['CENTRAL_ADMIN', 'CENTRAL_OFFICER'] },
  { title: 'State', roles: ['STATE_ADMIN', 'STATE_OFFICER', 'FINANCE_OFFICER', 'GIS_OFFICER'] },
  { title: 'District & field', roles: ['DISTRICT_OFFICER', 'FIELD_OFFICER', 'RR_OFFICER'] },
  { title: 'Requiring body', roles: ['PIA_OFFICER'] },
];
const ROLE_LABEL: Record<string, string> = {
  CENTRAL_ADMIN: 'National administrator',
  CENTRAL_OFFICER: 'National monitoring',
  STATE_ADMIN: 'State administrator',
  STATE_OFFICER: 'State officer',
  FINANCE_OFFICER: 'Finance',
  GIS_OFFICER: 'GIS',
  DISTRICT_OFFICER: 'Collector',
  FIELD_OFFICER: 'Field survey',
  RR_OFFICER: 'Resettlement',
  PIA_OFFICER: 'Project authority',
};
const PROOF = [
  { icon: Scale, title: 'Law as code', text: 'Every step checks RFCTLARR 2013 and cites the section it enforces.' },
  { icon: Fingerprint, title: 'Tamper-evident', text: 'Each action is hash-chained and sealed daily into a Merkle root.' },
  { icon: Languages, title: 'For every citizen', text: 'English, हिन्दी and मराठी, on any phone, with the law’s dates spelled out.' },
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

  // Placeholder collectors of the other demo states are real accounts but add nothing on screen.
  const shown = (personas.data ?? []).filter((p) => !/^collector\.(?!wardha|yavatmal)/.test(p.email));

  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-[1.05fr_1fr]">
      <section className="relative flex flex-col justify-between overflow-hidden bg-navy px-8 py-10 text-white sm:px-12">
        <div className="tricolour-rule absolute inset-x-0 top-0" aria-hidden />
        <svg className="pointer-events-none absolute -right-24 -top-10 h-[130%] opacity-[0.07]" viewBox="0 0 400 400" aria-hidden>
          {Array.from({ length: 14 }).map((_, i) => (
            <path key={i} d={`M${-40 + i * 10} ${400 - i * 6} C ${80 + i * 12} ${260 - i * 14}, ${200 - i * 4} ${320 - i * 18}, ${440} ${120 + i * 16}`} fill="none" stroke="#fff" strokeWidth="1.2" />
          ))}
          <path d="M120 120 L210 90 L280 150 L240 240 L140 220 Z" fill="none" stroke="#e87722" strokeWidth="3" />
          <path d="M210 90 L240 240" stroke="#e87722" strokeWidth="1.5" strokeDasharray="6 5" />
        </svg>

        <div className="relative">
          <Wordmark light />
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-saffron">Department of Land Resources · Problem Statement 26016</p>
        </div>

        <div className="relative my-10 max-w-xl">
          <h1 className="text-4xl font-extrabold leading-[1.1] sm:text-5xl">
            Connecting
            <br />
            Land, Law <span className="text-saffron">&amp;</span> People
          </h1>
          <p className="mt-4 max-w-lg text-base text-white/80">
            One live record of every acquisition in India: each parcel, rupee, family and statutory deadline, from the first notification to possession.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-3">
            {PROOF.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-xl border border-white/15 bg-white/[0.06] p-3">
                <Icon className="h-5 w-5 text-saffron" aria-hidden />
                <p className="mt-2 text-sm font-bold">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-white/70">{text}</p>
              </li>
            ))}
          </ul>
          <Link href="/citizen/login" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-navy shadow-lg hover:bg-saffron-soft">
            <Smartphone className="h-4 w-4 text-saffron" /> Land holder? See your land, money and dates <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <footer className="relative flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/15 pt-4 text-xs text-white/60">
          <span className="font-semibold text-white/80">Smart India Hackathon 2026</span>
          <span>Team GAP BRIDGERS</span>
          <span>Demonstration build · all records synthetic</span>
        </footer>
      </section>

      <section className="flex flex-col justify-center px-6 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-saffron">Officer sign-in</p>
          <h2 className="mt-1 text-2xl font-extrabold text-ink">Choose your desk</h2>
          {mode.loading && !mode.data && <LoadingBlock rows={3} />}
          {mode.error && <ErrorState error={mode.error} onRetry={mode.reload} />}
          {mode.data?.mode === 'keycloak' && <p className="mt-2 text-sm text-ink-muted">Sign in through your department’s single sign-on.</p>}
          {mode.data?.mode === 'dev' && (
            <>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                <ShieldCheck className="h-4 w-4 text-bharat" /> Each desk sees only its own jurisdiction.
              </p>
              {error && <p className="mt-3 text-sm font-semibold text-danger">{error.message}</p>}
              {personas.error && <ErrorState error={personas.error} onRetry={personas.reload} />}
              {!personas.data && !personas.error && <LoadingBlock rows={6} />}
              <div className="mt-6 space-y-5">
                {GROUPS.map((g) => {
                  const people = shown.filter((p) => g.roles.includes(p.role));
                  if (!people.length) return null;
                  return (
                    <div key={g.title}>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted">{g.title}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {people.map((p) => (
                          <button
                            key={p.email}
                            onClick={() => signIn(p.email)}
                            disabled={!!busy}
                            className="group flex items-center gap-3 rounded-xl border border-line bg-panel p-3 text-left shadow-sm transition hover:border-saffron hover:shadow-md"
                          >
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy/5 text-sm font-bold text-navy">
                              {p.name
                                .replace(/^(Col\.|Dr\.)\s*/, '')
                                .split(/\s+/)
                                .slice(0, 2)
                                .map((w) => w[0])
                                .join('')}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-bold text-ink">{p.name}</span>
                                {busy === p.email ? <Spinner /> : <ArrowRight className="h-4 w-4 shrink-0 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-saffron" />}
                              </span>
                              <span className="block truncate text-xs text-ink-muted">{p.designation}</span>
                              <span className="mt-0.5 block text-[11px] font-semibold text-info">
                                {ROLE_LABEL[p.role] ?? p.role} · {p.jurisdiction.replace(/ \((state|district|national)\)$/i, '')}
                              </span>
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
        </div>
      </section>
    </div>
  );
}
