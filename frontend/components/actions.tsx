'use client';

import { Gavel, IndianRupee, KeyRound, Send } from 'lucide-react';
import React, { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { api, ApiError } from '@/lib/api/client';
import type { Award, AwardLine } from '@/lib/api/types';
import { inr } from '@/lib/format';
import { AwardBreakdown } from './AwardBreakdown';
import { BlockerList, Dialog, Spinner } from './ui';

function ErrorBox({ error }: { error: ApiError | null }) {
  if (!error) return null;
  return (
    <div className="mt-3 space-y-2">
      <p role="alert" className="text-sm font-semibold text-danger">
        {error.message}
      </p>
      <BlockerList blockers={error.blockers} compact />
    </div>
  );
}

const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/** s.23 award: preview the calculation line by line, then declare it. */
export function DeclareAwardButton({ parcelId, onDone }: { parcelId: string; onDone: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [awardDate, setAwardDate] = useState(todayIST());
  const [assets, setAssets] = useState('0');
  const [preview, setPreview] = useState<{ breakdown: { lines: AwardLine[]; totalPaise: number }; unverified: string[]; packCode: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const body = () => ({ parcelId, awardDate, assetsValueRupees: Number(assets) || 0 });
  const doPreview = async () => {
    setBusy(true);
    setError(null);
    try {
      setPreview(await api.post('/awards/preview', body()));
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  };
  const declare = async () => {
    setBusy(true);
    setError(null);
    try {
      const a = await api.post<Award>('/awards', body());
      toast('success', `Award ${a.awardNumber} declared`, `Total ${inr(a.totalPaise)}; compensation lines created for each holder.`);
      setOpen(false);
      onDone();
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="btn-accent" onClick={() => setOpen(true)} data-tour="declare-award">
        <Gavel className="h-4 w-4" /> Declare award
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Declare award (s.23)"
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={doPreview} disabled={busy}>
              {busy && !preview ? <Spinner /> : null} Preview calculation
            </button>
            <button className="btn-accent" onClick={declare} disabled={busy || !preview}>
              {busy && preview ? <Spinner /> : null} Declare award
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="label">Award date</span>
            <input type="date" className="input" value={awardDate} onChange={(e) => { setAwardDate(e.target.value); setPreview(null); }} />
          </label>
          <label>
            <span className="label">Value of assets attached to land, ₹ (s.29)</span>
            <input inputMode="numeric" className="input" value={assets} onChange={(e) => { setAssets(e.target.value.replace(/[^0-9.]/g, '')); setPreview(null); }} />
          </label>
        </div>
        {preview && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-ink-muted">Rule pack: {preview.packCode}</p>
            <AwardBreakdown lines={preview.breakdown.lines} unverified={preview.unverified} />
          </div>
        )}
        <ErrorBox error={error} />
      </Dialog>
    </>
  );
}

/** s.38 possession, blocked by the backend until payment and R&R are complete. */
export function TakePossessionButton({ parcelId, onDone }: { parcelId: string; onDone: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const take = async () => {
    setBusy(true);
    setError(null);
    const pos = await new Promise<GeolocationPosition | null>((resolve) => {
      if (!('geolocation' in navigator)) return resolve(null);
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 4000 });
    });
    try {
      await api.post(`/possession/${parcelId}/take`, {
        remarks: remarks || undefined,
        latitude: pos?.coords.latitude,
        longitude: pos?.coords.longitude,
      });
      toast('success', 'Possession recorded', 'Parcel moved to Possession taken; audit entry written.');
      setOpen(false);
      onDone();
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <KeyRound className="h-4 w-4" /> Take possession
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Take possession (s.38)"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={take} disabled={busy}>
              {busy && <Spinner />} Record possession
            </button>
          </>
        }
      >
        <p className="text-sm text-ink">The system checks that every beneficiary is paid and every R&amp;R entitlement is delivered before accepting this. Your location is attached if the browser allows it.</p>
        <label className="mt-3 block">
          <span className="label">Remarks (panchnama reference, witnesses)</span>
          <textarea className="input min-h-[80px]" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </label>
        <ErrorBox error={error} />
      </Dialog>
    </>
  );
}

export function HandOverButton({ parcelId, onDone }: { parcelId: string; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-ghost"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api.post(`/possession/${parcelId}/handover`);
          toast('success', 'Handed over to the requiring body');
          onDone();
        } catch (e) {
          toast('error', 'Handover refused', (e as ApiError).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Spinner /> : <Send className="h-4 w-4" />} Hand over
    </button>
  );
}

/** Disburse one approved compensation through the (synthetic) PFMS gateway. */
export function PayButton({ compensationId, onDone, label = 'Pay' }: { compensationId: string; onDone: () => void; label?: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-accent px-2.5 py-1 text-xs"
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        try {
          const r = await api.post<{ status: string; utrNumber: string; message?: string; parcelAdvanced?: boolean }>(`/compensation/${compensationId}/pay`);
          if (r.status === 'PAID') toast('success', `Paid · UTR ${r.utrNumber}`, r.parcelAdvanced ? 'Last beneficiary paid; the parcel moved to Compensation paid.' : 'Synthetic PFMS confirmation recorded.');
          else toast('error', `Payment failed · ${r.utrNumber}`, r.message);
          onDone();
        } catch (err) {
          toast('error', 'Payment not initiated', (err as ApiError).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Spinner /> : <IndianRupee className="h-3.5 w-3.5" />} {label}
    </button>
  );
}

/** Fire a simple (non-domain) lifecycle event, e.g. APPROVE a compensation line. */
export function TransitionButton({ entityType, entityId, event, label, onDone, tone = 'ghost' }: { entityType: string; entityId: string; event: string; label: string; onDone: () => void; tone?: 'ghost' | 'primary' }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={`${tone === 'primary' ? 'btn-primary' : 'btn-ghost'} px-2.5 py-1 text-xs`}
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        try {
          await api.post(`/lifecycle/${entityType}/${entityId}/transitions`, { event });
          toast('success', `${label}: done`);
          onDone();
        } catch (err) {
          const ae = err as ApiError;
          toast('error', `${label} refused`, ae.blockers.length ? ae.blockers.map((b) => b.message).join(' ') : ae.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy && <Spinner />} {label}
    </button>
  );
}
