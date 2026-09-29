'use client';

import { CalendarDays, FileText, Home, IndianRupee, LogOut, MapPin, MessageSquare, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { AwardBreakdown } from '@/components/AwardBreakdown';
import { ParcelMapCanvas } from '@/components/map/ParcelMap';
import { Badge, DataState, EmptyState, Spinner, StatusBadge, SyntheticTag } from '@/components/ui';
import { homeFor, useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { api, ApiError } from '@/lib/api/client';
import { useApi } from '@/lib/api/hooks';
import type { CitizenMe, ParcelStage } from '@/lib/api/types';
import { dateIST, dateTimeIST, daysFromNow, ha, humanize, inr } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Plain-language stage names a first-time smartphone user can follow. */
const STAGE_PLAIN: Record<ParcelStage, { title: string; next: string }> = {
  IDENTIFIED: { title: 'Your land has been identified for the project', next: 'A preliminary notification will be published next.' },
  PRELIM_NOTIFIED: { title: 'Preliminary notification published', next: 'You may file an objection within 60 days of the notification.' },
  DECLARED: { title: 'Final declaration published', next: 'The Collector will now calculate and declare your award.' },
  AWARDED: { title: 'Award declared', next: 'Your compensation will be paid to your bank account.' },
  COMPENSATION_PAID: { title: 'Compensation paid', next: 'Possession is taken only after all R&R benefits are delivered.' },
  POSSESSION_TAKEN: { title: 'Possession taken', next: 'The land is handed to the project.' },
  HANDED_OVER: { title: 'Land handed over to the project', next: 'Acquisition of your parcel is complete.' },
  LAPSED: { title: 'Proceedings lapsed', next: 'The acquisition did not complete in time and has lapsed.' },
  WITHDRAWN: { title: 'Withdrawn from acquisition', next: 'Your land is no longer being acquired.' },
};
const JOURNEY: ParcelStage[] = ['PRELIM_NOTIFIED', 'DECLARED', 'AWARDED', 'COMPENSATION_PAID', 'POSSESSION_TAKEN', 'HANDED_OVER'];

const NAV = [
  { href: '/citizen/home', label: 'Home', icon: Home },
  { href: '/citizen/my-land', label: 'My land', icon: MapPin },
  { href: '/citizen/compensation', label: 'Money', icon: IndianRupee },
  { href: '/citizen/hearings', label: 'Hearings', icon: CalendarDays },
  { href: '/citizen/grievance', label: 'Complain', icon: MessageSquare },
];

export function CitizenShell({ children }: { children: React.ReactNode }) {
  const { user, restoring, logout } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!restoring && !user) router.replace('/citizen/login');
    if (user && user.role !== 'CITIZEN') router.replace(homeFor(user.role));
  }, [restoring, user, router]);
  if (!user || user.role !== 'CITIZEN') {
    return (
      <div className="grid min-h-screen place-items-center text-ink-muted">
        <Spinner />
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-surface pb-20 text-[17px] leading-relaxed">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-lg font-bold">R-NLAM · My land</p>
            <p className="text-sm text-white/80">{user.name}</p>
          </div>
          <button onClick={logout} className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm hover:bg-white/10">
            <LogOut className="h-5 w-5" /> Sign out
          </button>
        </div>
        <div className="tricolour-rule" aria-hidden />
      </header>
      <main id="main" className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        {children}
      </main>
      <nav aria-label="Citizen navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel">
        <ul className="mx-auto flex max-w-3xl justify-around">
          {NAV.map((n) => {
            const active = pathname === n.href;
            const Icon = n.icon;
            return (
              <li key={n.href}>
                <Link href={n.href} aria-current={active ? 'page' : undefined} className={cn('flex min-w-[64px] flex-col items-center gap-0.5 px-2 py-2 text-xs font-semibold', active ? 'text-saffron' : 'text-ink-muted')}>
                  <Icon className="h-6 w-6" aria-hidden />
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function useMe() {
  return useApi<CitizenMe>('/citizen/me');
}

function Box({ title, children, className }: { title?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-line bg-panel p-4 shadow-sm', className)}>
      {title && <h2 className="mb-2 text-lg font-bold text-ink">{title}</h2>}
      {children}
    </section>
  );
}

export function CitizenHome() {
  const me = useMe();
  return (
    <CitizenShell>
      <DataState state={me} rows={5}>
        {(d) => (
          <>
            <h1 className="text-2xl font-bold">Namaste, {d.person.name.split(' ')[0]}</h1>
            <p className="text-ink-muted">This is where your land stands today. <SyntheticTag /></p>
            {d.holdings.length === 0 && <EmptyState title="No land linked to your account" />}
            {d.holdings.map((h) => {
              const p = h.parcel;
              const plain = STAGE_PLAIN[p.stage];
              const reached = JOURNEY.indexOf(p.stage);
              const myComp = p.compensations.reduce((s, c) => s + Number(c.amountPaise), 0);
              const paid = p.compensations.filter((c) => c.status === 'PAID').reduce((s, c) => s + Number(c.amountPaise), 0);
              return (
                <Box key={p.id}>
                  <p className="text-sm text-ink-muted">
                    {p.project.name} · {p.village.name}
                    {p.village.nameLocal ? ` (${p.village.nameLocal})` : ''}
                  </p>
                  <p className="text-xl font-bold">Survey {p.surveyNumber} · {ha(p.totalAreaHa)}</p>
                  <p className="mt-2 text-lg font-semibold text-navy">{plain.title}</p>
                  <p className="text-ink-muted">{plain.next}</p>
                  <ol className="mt-3 flex gap-1" aria-label="Progress">
                    {JOURNEY.map((s, i) => (
                      <li key={s} title={humanize(s)} className={cn('h-2 flex-1 rounded-full', i <= reached ? 'bg-bharat' : 'bg-line')} />
                    ))}
                  </ol>
                  {myComp > 0 && (
                    <div className="mt-4 rounded-xl bg-saffron-soft/60 p-3">
                      <p className="text-sm text-ink-muted">Your compensation ({h.sharePct}% share)</p>
                      <p className="text-2xl font-extrabold text-ink">{inr(myComp, { paise: false })}</p>
                      <p className="text-sm">{paid === myComp ? '✅ Paid in full' : paid > 0 ? `${inr(paid, { paise: false })} paid so far` : 'Not paid yet'}</p>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href="/citizen/my-land" className="btn-primary text-base">See my land</Link>
                    <Link href="/citizen/compensation" className="btn-ghost text-base">How the money is worked out</Link>
                  </div>
                </Box>
              );
            })}
            {d.rrCases.length > 0 && (
              <Box title="Resettlement support for your family">
                {d.rrCases.map((rc) => (
                  <ul key={rc.id} className="space-y-1">
                    {rc.grants.map((g) => (
                      <li key={g.id} className="flex items-center justify-between gap-2">
                        <span>{g.entitlement.name}</span>
                        <StatusBadge status={g.status} />
                      </li>
                    ))}
                  </ul>
                ))}
              </Box>
            )}
          </>
        )}
      </DataState>
    </CitizenShell>
  );
}

export function CitizenMyLand() {
  const me = useMe();
  return (
    <CitizenShell>
      <h1 className="text-2xl font-bold">My land</h1>
      <DataState state={me} rows={5}>
        {(d) => (
          <>
            {d.holdings.map((h) => {
              const p = h.parcel;
              return (
                <Box key={p.id} title={`Survey ${p.surveyNumber}, ${p.village.name}`}>
                  {p.geometry && (
                    <ParcelMapCanvas
                      height={260}
                      features={[{ type: 'Feature', id: p.id, geometry: p.geometry, properties: { id: p.id, parcelNumber: p.parcelNumber, surveyNumber: p.surveyNumber, villageName: p.villageName, districtName: p.districtName, totalAreaHa: p.totalAreaHa, stage: p.stage, displayOwnerName: p.displayOwnerName } }]}
                    />
                  )}
                  <dl className="mt-3 grid grid-cols-2 gap-2">
                    <div><dt className="text-sm text-ink-muted">Area</dt><dd className="font-semibold">{ha(p.totalAreaHa, 3)}</dd></div>
                    <div><dt className="text-sm text-ink-muted">Your share</dt><dd className="font-semibold">{h.sharePct}%</dd></div>
                    <div><dt className="text-sm text-ink-muted">Recorded as</dt><dd className="font-semibold">{h.nameAsRecorded}</dd></div>
                    <div><dt className="text-sm text-ink-muted">Stage</dt><dd><StatusBadge status={p.stage} /></dd></div>
                  </dl>
                  <h3 className="mt-4 font-bold">Notices about your land</h3>
                  <ul className="mt-1 space-y-1">
                    {p.notices.map((n) => (
                      <li key={n.id} className="flex justify-between gap-2 text-base">
                        <span>{humanize(n.kind)}</span>
                        <span className="text-ink-muted">{dateIST(n.publishedOn)}</span>
                      </li>
                    ))}
                  </ul>
                </Box>
              );
            })}
          </>
        )}
      </DataState>
    </CitizenShell>
  );
}

export function CitizenMoney() {
  const me = useMe();
  return (
    <CitizenShell>
      <h1 className="text-2xl font-bold">How your money is worked out</h1>
      <DataState state={me} rows={5}>
        {(d) => (
          <>
            {d.holdings.map((h) => {
              const award = h.parcel.awards[0];
              return (
                <Box key={h.parcel.id} title={`Survey ${h.parcel.surveyNumber}, ${h.parcel.village.name}`}>
                  {!award ? (
                    <p className="text-ink-muted">The award for this land has not been declared yet. It will appear here with every line explained.</p>
                  ) : (
                    <>
                      <p className="text-sm text-ink-muted">Award {award.awardNumber}, declared {dateIST(award.awardDate)}. The law guarantees each of these amounts.</p>
                      <div className="mt-2 text-base">
                        <AwardBreakdown lines={award.calculation.lines} unverified={award.calculation.unverified} />
                      </div>
                    </>
                  )}
                  {h.parcel.compensations.map((c) => (
                    <div key={c.id} className="mt-3 rounded-xl border border-line p-3">
                      <p className="font-semibold">Your share ({c.sharePct}%): {inr(c.amountPaise)}</p>
                      <p className="flex items-center gap-2">Status: <StatusBadge status={c.status} /></p>
                      {c.paymentReferences.map((r) => (
                        <p key={r.id} className="text-sm text-ink-muted">
                          {r.status === 'SUCCESS' ? 'Credited' : 'Failed'} {dateIST(r.transactedAt)} · UTR {r.utrNumber}
                        </p>
                      ))}
                      {c.status === 'ON_HOLD' && <p className="text-sm text-warning">On hold: the name in the award register must be matched with your land record. Visit the Tehsil office with your 7/12 extract.</p>}
                    </div>
                  ))}
                </Box>
              );
            })}
          </>
        )}
      </DataState>
    </CitizenShell>
  );
}

export function CitizenHearings() {
  const me = useMe();
  return (
    <CitizenShell>
      <h1 className="text-2xl font-bold">Hearings and objections</h1>
      <DataState state={me} rows={4}>
        {(d) => {
          const objections = d.holdings.flatMap((h) => h.parcel.objections.map((o) => ({ o, h })));
          if (!objections.length) return <EmptyState title="No objections filed" detail="If your land is in the preliminary-notification stage, you can file one from the Complain tab." />;
          return (
            <>
              {objections.map(({ o, h }) => (
                <Box key={o.id} title={humanize(o.category)}>
                  <p className="text-sm text-ink-muted">Survey {h.parcel.surveyNumber} · filed {dateIST(o.filedOn)}</p>
                  <p className="mt-1">{o.description}</p>
                  <p className="mt-2 flex items-center gap-2">Status: <StatusBadge status={o.status} /></p>
                  {o.hearings.map((hr) => {
                    const days = daysFromNow(hr.scheduledAt);
                    return (
                      <div key={hr.id} className="mt-3 rounded-xl bg-info-soft/60 p-3">
                        <p className="font-bold">{dateTimeIST(hr.scheduledAt)}</p>
                        <p>{hr.venue}</p>
                        <p className="text-sm text-ink-muted">{hr.presidingOfficer}</p>
                        {hr.status === 'SCHEDULED' && days >= 0 && <Badge tone="accent">{days === 0 ? 'Today' : `In ${days} days`}</Badge>}
                        {hr.outcome && <p className="mt-1 text-sm">{hr.outcome}</p>}
                      </div>
                    );
                  })}
                </Box>
              ))}
            </>
          );
        }}
      </DataState>
    </CitizenShell>
  );
}

export function CitizenGrievance() {
  const me = useMe();
  const toast = useToast();
  const [parcelId, setParcelId] = useState('');
  const [category, setCategory] = useState('COMPENSATION_AMOUNT');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <CitizenShell>
      <h1 className="text-2xl font-bold">File an objection</h1>
      <p className="text-ink-muted">Under Section 15, you can object within 60 days of the preliminary notification. The Collector must hear you before deciding.</p>
      <DataState state={me} rows={3}>
        {(d) => {
          const eligible = d.holdings.filter((h) => h.parcel.stage === 'PRELIM_NOTIFIED');
          if (!eligible.length) return <Box><p>None of your parcels is in the objection period right now. For other complaints, call the district helpline or visit the Tehsil office.</p></Box>;
          return (
            <Box>
              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setErr(null);
                  try {
                    await api.post('/objections', { parcelId: parcelId || eligible[0].parcel.id, applicant: d.person.name, category, description });
                    toast('success', 'Objection filed', 'You will be told the hearing date.');
                    setDescription('');
                    me.reload();
                  } catch (e2) {
                    setErr((e2 as ApiError).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label className="block">
                  <span className="label text-sm">Which land</span>
                  <select className="input text-base" value={parcelId} onChange={(e) => setParcelId(e.target.value)}>
                    {eligible.map((h) => <option key={h.parcel.id} value={h.parcel.id}>Survey {h.parcel.surveyNumber}, {h.parcel.village.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="label text-sm">What is wrong</span>
                  <select className="input text-base" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="COMPENSATION_AMOUNT">The amount / land rate is too low</option>
                    <option value="MEASUREMENT">The area or boundary is wrong</option>
                    <option value="TITLE">Ownership / share is wrong</option>
                    <option value="PUBLIC_PURPOSE">The project should not take this land</option>
                    <option value="OTHER">Something else</option>
                  </select>
                </label>
                <label className="block">
                  <span className="label text-sm">Tell us more (at least 10 letters)</span>
                  <textarea className="input min-h-[120px] text-base" value={description} onChange={(e) => setDescription(e.target.value)} />
                </label>
                {err && <p className="text-danger">{err}</p>}
                <button className="btn-accent w-full py-3 text-base" disabled={busy || description.trim().length < 10}>
                  {busy && <Spinner />} Submit objection
                </button>
              </form>
            </Box>
          );
        }}
      </DataState>
    </CitizenShell>
  );
}

export function CitizenRR() {
  const me = useMe();
  return (
    <CitizenShell>
      <h1 className="text-2xl font-bold">Resettlement support</h1>
      <DataState state={me} rows={3}>
        {(d) =>
          d.rrCases.length === 0 ? (
            <EmptyState title="No R&R case for your family" icon={<Users className="h-7 w-7" />} detail="Families who lose their home or livelihood get Second Schedule benefits." />
          ) : (
            <>
              {d.rrCases.map((rc) => (
                <Box key={rc.id} title={`Family of ${rc.family.familySize}`}>
                  <ul className="space-y-2">
                    {rc.grants.map((g) => (
                      <li key={g.id} className="rounded-xl border border-line p-3">
                        <p className="font-semibold">{g.entitlement.name}</p>
                        <p className="text-sm text-ink-muted">{g.entitlement.description}</p>
                        <p className="mt-1 flex items-center gap-2">
                          <StatusBadge status={g.status} /> {g.deliveredOn && <span className="text-sm">on {dateIST(g.deliveredOn)}</span>}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm text-ink-muted">The law does not allow your land to be taken until all of these are delivered (Section 38).</p>
                </Box>
              ))}
            </>
          )
        }
      </DataState>
    </CitizenShell>
  );
}

export function CitizenDocuments() {
  return (
    <CitizenShell>
      <h1 className="text-2xl font-bold">My documents</h1>
      <Box>
        <p className="flex items-start gap-2">
          <FileText className="mt-1 h-5 w-5 text-ink-muted" /> Award copies and payment advice will be delivered to your DigiLocker. The DigiLocker link is not connected in this demonstration build.
        </p>
      </Box>
    </CitizenShell>
  );
}

export function CitizenProjects() {
  const state = useApi<Array<{ id: string; code: string; name: string; sector: string; stateName: string; districtNames: string[]; status: string; piaName: string; isSynthetic: boolean }>>('/citizen/projects');
  return (
    <CitizenShell>
      <h1 className="text-2xl font-bold">Projects near you</h1>
      <DataState state={state}>
        {(rows) => (
          <>
            {rows.map((p) => (
              <Box key={p.id}>
                <p className="text-lg font-bold">{p.name}</p>
                <p className="text-ink-muted">{p.sector} · {p.districtNames.join(', ')}, {p.stateName}</p>
                <p className="text-sm text-ink-muted">{p.piaName}</p>
                {p.isSynthetic && <SyntheticTag className="mt-1" />}
              </Box>
            ))}
          </>
        )}
      </DataState>
    </CitizenShell>
  );
}

export function CitizenLogin() {
  const { requestOtp, verifyOtp, user } = useSession();
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [req, setReq] = useState<{ requestId: string; devOtp?: string | null; note?: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (user) router.replace(homeFor(user.role));
  }, [user, router]);

  return (
    <div className="min-h-screen bg-surface text-[17px]">
      <div className="tricolour-rule" aria-hidden />
      <main id="main" className="mx-auto max-w-md space-y-5 px-4 py-10">
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-navy text-2xl font-black text-white">R</span>
          <h1 className="mt-3 text-2xl font-bold">See your land, your money, your dates</h1>
          <p className="text-ink-muted">Sign in with the mobile number in your land record.</p>
        </div>
        <Box>
          {!req ? (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setErr(null);
                try {
                  setReq(await requestOtp(phone));
                } catch (e2) {
                  setErr((e2 as ApiError).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="block">
                <span className="label text-sm">Mobile number</span>
                <input className="input py-3 text-lg tracking-wider" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="98XXXXXXXX" />
              </label>
              {err && <p className="text-danger">{err}</p>}
              <button className="btn-accent w-full py-3 text-base" disabled={busy || phone.length !== 10}>
                {busy && <Spinner />} Send OTP
              </button>
              <p className="text-xs text-ink-muted">Demo holders: 9800000001 (Sunita, Anji), 9800000002 (Namdeo, Kharshi), 9800000003 (Ramkumar, Selu Khurd).</p>
            </form>
          ) : (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setErr(null);
                try {
                  await verifyOtp(req.requestId, code);
                } catch (e2) {
                  setErr((e2 as ApiError).message);
                  setBusy(false);
                }
              }}
            >
              <label className="block">
                <span className="label text-sm">Enter the 6-digit OTP sent to {phone}</span>
                <input className="input py-3 text-center text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              </label>
              {req.devOtp !== undefined && (
                <p className="rounded-lg bg-warning-soft p-2 text-sm text-warning">
                  {req.note} {req.devOtp ? <>Your code: <strong className="tracking-widest">{req.devOtp}</strong></> : 'This number is not registered.'}
                </p>
              )}
              {err && <p className="text-danger">{err}</p>}
              <button className="btn-accent w-full py-3 text-base" disabled={busy || code.length !== 6}>
                {busy && <Spinner />} Sign in
              </button>
              <button type="button" className="w-full text-sm text-info" onClick={() => { setReq(null); setCode(''); }}>
                Use a different number
              </button>
            </form>
          )}
        </Box>
        <p className="text-center text-sm">
          <Link href="/login" className="text-info">Officer sign-in</Link>
        </p>
      </main>
    </div>
  );
}
