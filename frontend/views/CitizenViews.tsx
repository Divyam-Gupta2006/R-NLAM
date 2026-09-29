'use client';

import { CalendarDays, CheckCircle2, Download, FileText, FolderLock, Home, IndianRupee, LogOut, MapPin, MessageSquare, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { LogoMark } from '@/components/Logo';
import { ParcelMapCanvas } from '@/components/map/ParcelMap';
import { DataState, EmptyState, Spinner } from '@/components/ui';
import { homeFor, useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { api, API_BASE_URL, ApiError, tokenStore } from '@/lib/api/client';
import { useApi } from '@/lib/api/hooks';
import type { CitizenDocument, CitizenMe, Grievance, ParcelStage } from '@/lib/api/types';
import { LanguageSwitcher, useI18n } from '@/lib/i18n/I18nProvider';
import { cn } from '@/lib/utils';
import type { ClockRow } from '@/views/StatutoryViews';

/*
 * The citizen portal: large type, mobile first, in English, Hindi or Marathi.
 * Every visible word comes from lib/i18n/citizen.ts. Free text written by
 * people (an officer's reply, a hearing outcome) is shown as written.
 */

const JOURNEY: ParcelStage[] = ['PRELIM_NOTIFIED', 'DECLARED', 'AWARDED', 'COMPENSATION_PAID', 'POSSESSION_TAKEN', 'HANDED_OVER'];

const NAV = [
  { href: '/citizen/home', key: 'navHome', icon: Home },
  { href: '/citizen/my-land', key: 'navLand', icon: MapPin },
  { href: '/citizen/compensation', key: 'navMoney', icon: IndianRupee },
  { href: '/citizen/hearings', key: 'navHearings', icon: CalendarDays },
  { href: '/citizen/documents', key: 'navPapers', icon: FileText },
  { href: '/citizen/grievance', key: 'navComplain', icon: MessageSquare },
] as const;

const TONE: Record<string, string> = {
  good: 'bg-bharat-soft text-bharat',
  warn: 'bg-warning-soft text-warning',
  bad: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  muted: 'bg-surface text-ink-muted',
};
function Pill({ tone = 'muted', children }: { tone?: keyof typeof TONE; children: React.ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold', TONE[tone])}>{children}</span>;
}
function DemoTag() {
  const { t } = useI18n();
  return <Pill tone="warn">{t('synthetic')}</Pill>;
}

export function CitizenShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useSession();
  const { restoring } = useSession();
  const { t } = useI18n();
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
    <div className="min-h-screen bg-surface pb-24 text-[17px] leading-relaxed">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <p className="text-lg font-bold">{t('appTitle')}</p>
            <p className="text-sm text-white/80">{user.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher tone="dark" />
            <button onClick={logout} className="flex min-h-[40px] items-center gap-1 rounded-lg px-3 text-sm hover:bg-white/10">
              <LogOut className="h-5 w-5" aria-hidden /> {t('signOut')}
            </button>
          </div>
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
                <Link href={n.href} aria-current={active ? 'page' : undefined} className={cn('flex min-w-[56px] flex-col items-center gap-0.5 px-1 py-2 text-[12px] font-semibold', active ? 'text-saffron' : 'text-ink-muted')}>
                  <Icon className="h-6 w-6" aria-hidden />
                  {t(n.key)}
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

/** The village as the citizen knows it: the local-script name when reading in Hindi or Marathi. */
const villageOf = (v: { name: string; nameLocal: string | null }, lang: string) => (lang !== 'en' && v.nameLocal ? v.nameLocal : v.name);

function hectares(ha: number, lang: string) {
  return `${new Intl.NumberFormat(`${lang}-IN-u-nu-latn`, { maximumFractionDigits: 3 }).format(ha)} ${lang === 'en' ? 'ha' : lang === 'hi' ? 'हेक्टेयर' : 'हेक्टर'}`;
}

/** Interest owed under s.80, when the land was taken before the money was paid. */
function InterestOwed({ c }: { c: CitizenMe['holdings'][number]['parcel']['compensations'][number] }) {
  const { t, money } = useI18n();
  const i = c.interest;
  if (!i || Number(i.accruedPaise) <= 0) return null;
  return (
    <div className="mt-3 rounded-xl border border-warning/40 bg-warning-soft/60 p-3">
      <p className="font-bold">{t('interestTitle')}</p>
      <p className="text-2xl font-extrabold">{i.paidOn ? t('interestPaidLate', { amount: money(i.accruedPaise) }) : t('interestSoFar', { amount: money(i.accruedPaise) })}</p>
      {!i.paidOn && Number(i.dailyPaise) > 0 && <p className="text-sm">{t('interestDaily', { amount: money(i.dailyPaise) })}</p>}
      <p className="mt-1 text-sm text-ink-muted">{t('interestExplain')}</p>
    </div>
  );
}

export function CitizenHome() {
  const me = useMe();
  const { t, money, lang } = useI18n();
  return (
    <CitizenShell>
      <DataState state={me} rows={5}>
        {(d) => (
          <>
            <h1 className="text-2xl font-bold">{t('greeting', { name: d.person.name.split(' ')[0] })}</h1>
            <p className="flex flex-wrap items-center gap-2 text-ink-muted">
              {t('homeIntro')} <DemoTag />
            </p>
            {d.holdings.length === 0 && <EmptyState title={t('noLand')} />}
            {d.holdings.map((h) => {
              const p = h.parcel;
              const reached = JOURNEY.indexOf(p.stage);
              const myComp = p.compensations.reduce((s, c) => s + Number(c.amountPaise), 0);
              const paid = p.compensations.filter((c) => c.status === 'PAID').reduce((s, c) => s + Number(c.amountPaise), 0);
              return (
                <Box key={p.id}>
                  <p className="text-sm text-ink-muted">
                    {p.project.name} · {p.village.name}
                    {p.village.nameLocal ? ` (${p.village.nameLocal})` : ''}
                  </p>
                  <p className="text-xl font-bold">{t('surveyArea', { survey: p.surveyNumber, area: hectares(p.totalAreaHa, lang) })}</p>
                  <p className="mt-2 text-lg font-semibold text-navy">{t(`stage_${p.stage}_title`)}</p>
                  <p className="text-ink-muted">{t(`stage_${p.stage}_next`)}</p>
                  <ol className="mt-3 flex gap-1" aria-label={t('progress')}>
                    {JOURNEY.map((s, i) => (
                      <li key={s} title={t(`stage_${s}_title`)} className={cn('h-2.5 flex-1 rounded-full', i <= reached ? 'bg-bharat' : 'bg-line')} />
                    ))}
                  </ol>
                  {myComp > 0 && (
                    <div className="mt-4 rounded-xl bg-saffron-soft/60 p-3">
                      <p className="text-sm text-ink-muted">{t('yourCompensation', { pct: h.sharePct })}</p>
                      <p className="text-2xl font-extrabold text-ink">{money(myComp)}</p>
                      <p className="text-sm">{paid === myComp ? t('paidInFull') : paid > 0 ? t('paidSoFar', { amount: money(paid) }) : t('notPaidYet')}</p>
                    </div>
                  )}
                  {p.compensations.map((c) => (
                    <InterestOwed key={c.id} c={c} />
                  ))}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href="/citizen/my-land" className="btn-primary min-h-[44px] text-base">
                      {t('seeMyLand')}
                    </Link>
                    <Link href="/citizen/compensation" className="btn-ghost min-h-[44px] text-base">
                      {t('howMoneyWorked')}
                    </Link>
                  </div>
                </Box>
              );
            })}
            {d.rrCases.length > 0 && (
              <Box title={t('rrHomeTitle')}>
                {d.rrCases.map((rc) => (
                  <ul key={rc.id} className="space-y-1">
                    {rc.grants.map((g) => (
                      <li key={g.id} className="flex items-center justify-between gap-2">
                        <span>{t(`ent_${g.entitlement.code}`)}</span>
                        <Pill tone={g.status === 'DELIVERED' ? 'good' : g.status === 'ASSIGNED' ? 'warn' : 'muted'}>{t(`ent_${g.status}`)}</Pill>
                      </li>
                    ))}
                  </ul>
                ))}
                <Link href="/citizen/rr" className="mt-2 inline-block text-info underline">
                  {t('rrTitle')}
                </Link>
              </Box>
            )}
          </>
        )}
      </DataState>
    </CitizenShell>
  );
}

/** Statutory dates on one parcel, in plain words. */
function CitizenClocks({ parcelId }: { parcelId: string }) {
  const { t, date } = useI18n();
  const state = useApi<ClockRow[]>(`/statutory/parcels/${parcelId}`);
  return (
    <DataState state={state} empty={<p className="text-ink-muted">{t('noClocks')}</p>} rows={3}>
      {(rows) => (
        <ul className="space-y-2">
          {rows.map((c) => {
            const days = Math.round((new Date(c.dueOn).getTime() - Date.now()) / 86_400_000);
            const badge =
              c.status === 'MET' ? <Pill tone="good">{t('clockMet')}</Pill> : c.status === 'MISSED' ? <Pill tone="bad">{t('clockMissed')}</Pill> : <Pill tone={days <= 7 ? 'bad' : days <= 30 ? 'warn' : 'info'}>{days === 0 ? t('dueToday') : t('daysLeft', { n: days })}</Pill>;
            return (
              <li key={c.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{t(`clock_${c.kind}`)}</p>
                  {badge}
                </div>
                <p className="text-lg font-bold">{date(c.dueOn)}</p>
                {c.metOn && <p className="text-sm text-ink-muted">{t('doneOn', { date: date(c.metOn) })}</p>}
                <p className="text-xs font-semibold text-info">{c.citation}</p>
              </li>
            );
          })}
        </ul>
      )}
    </DataState>
  );
}

export function CitizenMyLand() {
  const me = useMe();
  const { t, date, lang } = useI18n();
  return (
    <CitizenShell>
      <h1 className="text-2xl font-bold">{t('landTitle')}</h1>
      <DataState state={me} rows={5}>
        {(d) => (
          <>
            {d.holdings.map((h) => {
              const p = h.parcel;
              return (
                <Box key={p.id} title={t('landHeading', { survey: p.surveyNumber, village: villageOf(p.village, lang) })}>
                  {p.geometry && (
                    <ParcelMapCanvas
                      height={260}
                      features={[{ type: 'Feature', id: p.id, geometry: p.geometry, properties: { id: p.id, parcelNumber: p.parcelNumber, surveyNumber: p.surveyNumber, villageName: p.villageName, districtName: p.districtName, totalAreaHa: p.totalAreaHa, stage: p.stage, displayOwnerName: p.displayOwnerName } }]}
                    />
                  )}
                  <dl className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-sm text-ink-muted">{t('area')}</dt>
                      <dd className="font-semibold">{hectares(p.totalAreaHa, lang)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-ink-muted">{t('yourShare')}</dt>
                      <dd className="font-semibold">{h.sharePct}%</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-ink-muted">{t('recordedAs')}</dt>
                      <dd className="font-semibold">{h.nameAsRecorded}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-ink-muted">{t('stage')}</dt>
                      <dd className="font-semibold">{t(`stage_${p.stage}_title`)}</dd>
                    </div>
                  </dl>
                  <h3 className="mt-4 font-bold">{t('datesTitle')}</h3>
                  <div className="mt-1">
                    <CitizenClocks parcelId={p.id} />
                  </div>
                  <h3 className="mt-4 font-bold">{t('noticesTitle')}</h3>
                  <ul className="mt-1 space-y-1">
                    {p.notices.map((n) => (
                      <li key={n.id} className="flex justify-between gap-2">
                        <span>{t(`notice_${n.kind}`)}</span>
                        <span className="shrink-0 text-ink-muted">{date(n.publishedOn)}</span>
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
  const { t, date, money, lang } = useI18n();
  return (
    <CitizenShell>
      <h1 className="text-2xl font-bold">{t('moneyTitle')}</h1>
      <DataState state={me} rows={5}>
        {(d) => (
          <>
            {d.holdings.map((h) => {
              const award = h.parcel.awards[0];
              return (
                <Box key={h.parcel.id} title={t('landHeading', { survey: h.parcel.surveyNumber, village: villageOf(h.parcel.village, lang) })}>
                  {!award ? (
                    <p className="text-ink-muted">{t('awardNotYet')}</p>
                  ) : (
                    <>
                      <p className="text-sm text-ink-muted">{t('awardDeclared', { no: award.awardNumber, date: date(award.awardDate) })}</p>
                      <ul className="mt-2 divide-y divide-line">
                        {award.calculation.lines.map((l) => (
                          <li key={l.key} className={cn('flex items-baseline justify-between gap-3 py-2', l.key === 'total' && 'text-lg font-extrabold')}>
                            <span>{t(`line_${l.key}`)}</span>
                            <span className="shrink-0 tabular-nums">{money(l.amountPaise)}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {h.parcel.compensations.map((c) => (
                    <div key={c.id} className="mt-3 rounded-xl border border-line p-3">
                      <p className="font-semibold">{t('yourShareAmount', { pct: c.sharePct, amount: money(c.amountPaise) })}</p>
                      <p className="flex items-center gap-2">
                        {t('status')}: <Pill tone={c.status === 'PAID' ? 'good' : c.status === 'ON_HOLD' || c.status === 'FAILED' ? 'bad' : 'info'}>{t(`comp_${c.status}`)}</Pill>
                      </p>
                      {c.paymentReferences.map((r) => (
                        <p key={r.id} className="text-sm text-ink-muted">
                          {r.status === 'SUCCESS' ? t('credited', { date: date(r.transactedAt), utr: r.utrNumber }) : t('failedPayment', { date: date(r.transactedAt) })}
                        </p>
                      ))}
                      {c.status === 'ON_HOLD' && <p className="mt-1 text-sm text-warning">{t('onHoldHelp')}</p>}
                      <InterestOwed c={c} />
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
  const { t, date, dateTime } = useI18n();
  return (
    <CitizenShell>
      <h1 className="text-2xl font-bold">{t('hearingsTitle')}</h1>
      <DataState state={me} rows={4}>
        {(d) => {
          const objections = d.holdings.flatMap((h) => h.parcel.objections.map((o) => ({ o, h })));
          if (!objections.length) return <EmptyState title={t('noObjections')} detail={t('noObjectionsDetail')} />;
          return (
            <>
              {objections.map(({ o, h }) => (
                <Box key={o.id} title={t(`obj_${o.category}`)}>
                  <p className="text-sm text-ink-muted">{t('filedOn', { survey: h.parcel.surveyNumber, date: date(o.filedOn) })}</p>
                  <p className="mt-1">{o.description}</p>
                  <p className="mt-2 flex items-center gap-2">
                    {t('status')}: <Pill tone={o.status === 'RESOLVED' ? 'good' : o.status === 'REJECTED' ? 'bad' : 'info'}>{t(`objst_${o.status}`)}</Pill>
                  </p>
                  {o.hearings.map((hr) => {
                    const days = Math.round((new Date(hr.scheduledAt).getTime() - Date.now()) / 86_400_000);
                    return (
                      <div key={hr.id} className="mt-3 rounded-xl bg-info-soft/60 p-3">
                        <p className="text-lg font-bold">{dateTime(hr.scheduledAt)}</p>
                        <p>{hr.venue}</p>
                        <p className="text-sm text-ink-muted">{hr.presidingOfficer}</p>
                        <p className="mt-1 flex flex-wrap gap-2">
                          <Pill tone="muted">{t(`hear_${hr.status}`)}</Pill>
                          {hr.status === 'SCHEDULED' && days >= 0 && <Pill tone="warn">{days === 0 ? t('today') : t('inDays', { n: days })}</Pill>}
                        </p>
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

const OBJECTION_CATEGORIES = ['COMPENSATION_AMOUNT', 'MEASUREMENT', 'TITLE', 'PUBLIC_PURPOSE', 'OTHER'];
const GRIEVANCE_CATEGORIES = ['PAYMENT_DELAY', 'AMOUNT', 'RR', 'HEARING', 'MEASUREMENT', 'OTHER'];

export function CitizenGrievance() {
  const me = useMe();
  const mine = useApi<Grievance[]>('/citizen/grievances');
  const toast = useToast();
  const { t, lang, date } = useI18n();
  // objection (s.15)
  const [objParcel, setObjParcel] = useState('');
  const [objCategory, setObjCategory] = useState('COMPENSATION_AMOUNT');
  const [objText, setObjText] = useState('');
  // grievance (CPGRAMS)
  const [gParcel, setGParcel] = useState('');
  const [gCategory, setGCategory] = useState('PAYMENT_DELAY');
  const [gText, setGText] = useState('');
  const [busy, setBusy] = useState<'obj' | 'g' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <CitizenShell>
      <h1 className="text-2xl font-bold">{t('complainTitle')}</h1>
      <DataState state={me} rows={3}>
        {(d) => {
          const eligible = d.holdings.filter((h) => h.parcel.stage === 'PRELIM_NOTIFIED');
          const lands = d.holdings.map((h) => h.parcel);
          return (
            <>
              <Box title={t('objectionHeading')}>
                <p className="text-ink-muted">{t('objectionIntro')}</p>
                {!eligible.length ? (
                  <p className="mt-2">{t('objectionNone')}</p>
                ) : (
                  <form
                    className="mt-3 space-y-3"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy('obj');
                      setErr(null);
                      try {
                        await api.post('/objections', { parcelId: objParcel || eligible[0].parcel.id, applicant: d.person.name, category: objCategory, description: objText });
                        toast('success', t('objectionFiled'));
                        setObjText('');
                        me.reload();
                      } catch (e2) {
                        setErr((e2 as ApiError).message);
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    <label className="block">
                      <span className="label text-sm">{t('whichLand')}</span>
                      <select className="input min-h-[44px] text-base" value={objParcel} onChange={(e) => setObjParcel(e.target.value)}>
                        {eligible.map((h) => (
                          <option key={h.parcel.id} value={h.parcel.id}>
                            {t('landHeading', { survey: h.parcel.surveyNumber, village: villageOf(h.parcel.village, lang) })}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="label text-sm">{t('whatWrong')}</span>
                      <select className="input min-h-[44px] text-base" value={objCategory} onChange={(e) => setObjCategory(e.target.value)}>
                        {OBJECTION_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {t(`obj_${c}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="label text-sm">{t('tellMore')}</span>
                      <textarea className="input min-h-[120px] text-base" value={objText} onChange={(e) => setObjText(e.target.value)} />
                    </label>
                    <button className="btn-accent w-full py-3 text-base" disabled={busy !== null || objText.trim().length < 10}>
                      {busy === 'obj' && <Spinner />} {t('submitObjection')}
                    </button>
                  </form>
                )}
              </Box>

              <Box title={t('grievanceHeading')}>
                <p className="text-ink-muted">{t('grievanceIntro')}</p>
                <form
                  className="mt-3 space-y-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy('g');
                    setErr(null);
                    try {
                      const g = await api.post<Grievance>('/citizen/grievances', { parcelId: gParcel || lands[0]?.id, category: gCategory, description: gText, language: lang });
                      toast('success', t('grievanceFiled', { no: g.registrationNo }));
                      setGText('');
                      mine.reload();
                    } catch (e2) {
                      setErr((e2 as ApiError).message);
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  <label className="block">
                    <span className="label text-sm">{t('whichLand')}</span>
                    <select className="input min-h-[44px] text-base" value={gParcel} onChange={(e) => setGParcel(e.target.value)}>
                      {lands.map((p) => (
                        <option key={p.id} value={p.id}>
                          {t('landHeading', { survey: p.surveyNumber, village: villageOf(p.village, lang) })}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label text-sm">{t('grievanceCategory')}</span>
                    <select className="input min-h-[44px] text-base" value={gCategory} onChange={(e) => setGCategory(e.target.value)}>
                      {GRIEVANCE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {t(`gcat_${c}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label text-sm">{t('tellMore')}</span>
                    <textarea className="input min-h-[120px] text-base" lang={lang} value={gText} onChange={(e) => setGText(e.target.value)} />
                  </label>
                  <button className="btn-accent w-full py-3 text-base" disabled={busy !== null || gText.trim().length < 10 || !lands.length}>
                    {busy === 'g' && <Spinner />} {t('submitGrievance')}
                  </button>
                  <p className="text-xs text-ink-muted">{t('syntheticCpgrams')}</p>
                </form>
              </Box>
              {err && (
                <p role="alert" className="text-danger">
                  {err}
                </p>
              )}
            </>
          );
        }}
      </DataState>

      <Box title={t('myComplaints')}>
        <DataState state={mine} empty={<p className="text-ink-muted">{t('noComplaints')}</p>} rows={2}>
          {(gs) => (
            <ul className="space-y-3">
              {gs.map((g) => (
                <li key={g.id} className="rounded-xl border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold tracking-wide">{g.registrationNo}</p>
                    <Pill tone={g.status === 'RESOLVED' ? 'good' : g.status === 'UNDER_REVIEW' ? 'info' : 'warn'}>{t(`gst_${g.status}`)}</Pill>
                  </div>
                  <p className="text-sm text-ink-muted">
                    {t(`gcat_${g.category}`)} · {t('lodgedOn', { date: date(g.createdAt) })}
                  </p>
                  <p className="mt-1" lang={g.language}>
                    {g.description}
                  </p>
                  {g.reply && (
                    <div className="mt-2 rounded-lg bg-bharat-soft/60 p-2">
                      <p className="text-sm font-semibold">
                        {t('replyFromOffice')} · {date(g.repliedAt)}
                      </p>
                      <p lang="en">{g.reply}</p>
                      {lang !== 'en' && <p className="text-xs text-ink-muted">{t('replyOriginalLanguage')}</p>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DataState>
      </Box>
    </CitizenShell>
  );
}

export function CitizenRR() {
  const me = useMe();
  const { t, date } = useI18n();
  return (
    <CitizenShell>
      <h1 className="text-2xl font-bold">{t('rrTitle')}</h1>
      <DataState state={me} rows={3}>
        {(d) =>
          d.rrCases.length === 0 ? (
            <EmptyState title={t('rrNone')} icon={<Users className="h-7 w-7" />} detail={t('rrNoneDetail')} />
          ) : (
            <>
              {d.rrCases.map((rc) => (
                <Box key={rc.id} title={t('familyOf', { n: rc.family.familySize })}>
                  <ul className="space-y-2">
                    {rc.grants.map((g) => (
                      <li key={g.id} className="rounded-xl border border-line p-3">
                        <p className="font-semibold">{t(`ent_${g.entitlement.code}`)}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-2">
                          <Pill tone={g.status === 'DELIVERED' ? 'good' : g.status === 'ASSIGNED' ? 'warn' : 'muted'}>{t(`ent_${g.status}`)}</Pill>
                          {g.deliveredOn && <span className="text-sm">{t('deliveredOn', { date: date(g.deliveredOn) })}</span>}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm text-ink-muted">{t('rrLaw')}</p>
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
  const state = useApi<CitizenDocument[]>('/citizen/documents');
  const toast = useToast();
  const { t, date } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const download = async (d: CitizenDocument) => {
    setBusy(d.id);
    try {
      const res = await fetch(`${API_BASE_URL}/citizen/documents/${d.id}/download`, { headers: { Authorization: `Bearer ${tokenStore.get() ?? ''}` } });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { message?: string }).message ?? res.statusText);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `${d.kind.toLowerCase()}-${d.parcel.surveyNumber.replace(/\W/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <CitizenShell>
      <h1 className="text-2xl font-bold">{t('papersTitle')}</h1>
      <p className="text-ink-muted">{t('papersIntro')}</p>
      <DataState state={state} empty={<EmptyState icon={<FileText className="h-7 w-7" />} title={t('noPapers')} />}>
        {(docs) => (
          <>
            {docs.map((d) => (
              <Box key={d.id}>
                <p className="text-lg font-bold">{t(`doc_${d.kind}`)}</p>
                <p className="text-sm text-ink-muted">
                  {t('landHeading', { survey: d.parcel.surveyNumber, village: d.parcel.villageName })}
                  {d.referenceNo ? ` · ${d.referenceNo}` : ''}
                  {d.issuedOn ? ` · ${t('issuedOn', { date: date(d.issuedOn) })}` : ''}
                </p>
                {d.isSynthetic && (
                  <p className="mt-1">
                    <DemoTag />
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-primary min-h-[44px] text-base" onClick={() => void download(d)} disabled={busy === d.id}>
                    {busy === d.id ? <Spinner /> : <Download className="h-5 w-5" />} {t('download')}
                  </button>
                  {d.digilocker ? (
                    <Pill tone="good">
                      <CheckCircle2 className="mr-1 h-4 w-4" /> {t('inDigiLocker')}
                    </Pill>
                  ) : (
                    <button
                      className="btn-ghost min-h-[44px] text-base"
                      disabled={busy === d.id}
                      onClick={async () => {
                        setBusy(d.id);
                        try {
                          await api.post(`/citizen/documents/${d.id}/digilocker`);
                          state.reload();
                        } catch (e) {
                          toast('error', (e as ApiError).message);
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      <FolderLock className="h-5 w-5" /> {t('toDigiLocker')}
                    </button>
                  )}
                </div>
              </Box>
            ))}
            <p className="text-xs text-ink-muted">{t('syntheticDigiLocker')}</p>
          </>
        )}
      </DataState>
    </CitizenShell>
  );
}

export function CitizenProjects() {
  const state = useApi<Array<{ id: string; code: string; name: string; sector: string; stateName: string; districtNames: string[]; status: string; piaName: string; isSynthetic: boolean }>>('/citizen/projects');
  const { t } = useI18n();
  return (
    <CitizenShell>
      <h1 className="text-2xl font-bold">{t('projectsTitle')}</h1>
      <DataState state={state}>
        {(rows) => (
          <>
            {rows.map((p) => (
              <Box key={p.id}>
                <p className="text-lg font-bold">{p.name}</p>
                <p className="text-ink-muted">
                  {p.sector} · {p.districtNames.join(', ')}, {p.stateName}
                </p>
                <p className="text-sm text-ink-muted">{p.piaName}</p>
                {p.isSynthetic && (
                  <p className="mt-1">
                    <DemoTag />
                  </p>
                )}
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
  const { t } = useI18n();
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
      <main id="main" className="mx-auto max-w-md space-y-5 px-4 py-8">
        <div className="flex justify-center">
          <LanguageSwitcher />
        </div>
        <div className="text-center">
          <LogoMark size={56} className="mx-auto" />
          <h1 className="mt-3 text-2xl font-bold">{t('loginHeadline')}</h1>
          <p className="text-ink-muted">{t('loginSub')}</p>
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
                <span className="label text-sm">{t('mobile')}</span>
                <input className="input py-3 text-lg tracking-wider" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="98XXXXXXXX" />
              </label>
              {err && <p className="text-danger">{err}</p>}
              <button className="btn-accent w-full py-3 text-base" disabled={busy || phone.length !== 10}>
                {busy && <Spinner />} {t('sendOtp')}
              </button>
              <p className="text-xs text-ink-muted">{t('demoHolders')}</p>
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
                <span className="label text-sm">{t('enterOtp', { phone })}</span>
                <input className="input py-3 text-center text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              </label>
              {req.devOtp !== undefined && (
                <p className="rounded-lg bg-warning-soft p-2 text-sm text-warning">
                  {req.note}{' '}
                  {req.devOtp ? (
                    <>
                      {t('yourCode')} <strong className="tracking-widest">{req.devOtp}</strong>
                    </>
                  ) : (
                    t('notRegistered')
                  )}
                </p>
              )}
              {err && <p className="text-danger">{err}</p>}
              <button className="btn-accent w-full py-3 text-base" disabled={busy || code.length !== 6}>
                {busy && <Spinner />} {t('signIn')}
              </button>
              <button
                type="button"
                className="w-full text-sm text-info"
                onClick={() => {
                  setReq(null);
                  setCode('');
                }}
              >
                {t('otherNumber')}
              </button>
            </form>
          )}
        </Box>
        <p className="text-center text-sm">
          <Link href="/login" className="text-info">
            {t('officerSignIn')}
          </Link>
        </p>
      </main>
    </div>
  );
}
