'use client';

import React from 'react';
import type { AwardLine } from '@/lib/api/types';
import { inr } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge } from './ui';

/** The award, line by line, each with its formula and legal basis. */
export function AwardBreakdown({ lines, unverified }: { lines: AwardLine[]; unverified?: string[] }) {
  return (
    <div className="space-y-2">
      <table className="w-full text-sm">
        <caption className="sr-only">Award calculation</caption>
        <tbody className="divide-y divide-line">
          {lines.map((l) => (
            <tr key={l.key} className={cn(l.key === 'total' && 'font-bold', (l.key === 'compensation' || l.key === 'total') && 'bg-surface')}>
              <th scope="row" className="py-2 pr-3 text-left font-medium">
                <span className={cn(l.key === 'total' && 'font-bold')}>{l.label}</span>
                <span className="block text-xs font-normal text-ink-muted">{l.formula}</span>
                {l.citation && <span className="block text-[11px] font-semibold text-info">{l.citation}</span>}
              </th>
              <td className="tabular py-2 text-right align-top">{inr(l.amountPaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {unverified && unverified.length > 0 && (
        <p className="flex flex-wrap items-center gap-1 text-xs text-warning">
          <Badge tone="warn">Unverified</Badge> Pending verification against the notified rule pack: {unverified.join(', ')}.
        </p>
      )}
    </div>
  );
}
