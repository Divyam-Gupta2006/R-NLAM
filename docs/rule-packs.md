# Statutory rule packs

R-NLAM never hardcodes law. Deadlines, money rules, required documents and
alert thresholds live in **rule packs**: versioned data, each entry carrying its
legal citation and, where verified, the words of the statute.

## Model

| Table | Holds |
|---|---|
| `RulePack` | `code`, `actCode` (e.g. `RFCTLARR_2013`), `stateCode` (null = central), `version`, `effectiveFrom`, `effectiveTo`, `status` (`DRAFT` / `ACTIVE` / `RETIRED`), `source` |
| `RuleEntry` | `key`, `category`, `label`, typed `value`, `unit`, `citation`, `quote` (verbatim text), `unverified`, `note` |
| `StatutoryClock` | per-parcel deadlines computed from notices, awards and payments, with the pack and rule that produced them |

## How "which rule applies" is decided

`resolveRules(packs, act, state, date)` (`backend/src/rules/resolve.ts`):

1. Keep `ACTIVE` packs for the act whose `effectiveFrom ≤ date < effectiveTo`.
2. Pick the central pack (`stateCode = null`) and the state's pack; if several
   overlap, the highest `version` wins.
3. Start from the central entries; overlay the state entries **key by key**.
   Keys the state does not define are inherited from the centre.

Each clock is resolved on **its own start date**: a declaration deadline uses
the rules in force on the s.11 date, an award deadline uses those on the s.19
date. A 2016 Maharashtra case is therefore judged without the 2018 state
amendment. Award money is resolved on the award date.

`GET /api/rules/resolve?stateCode=MH&date=2026-09-29` shows the result, and so
does *Governance → Rule packs → What applies where and when* in the UI.

## Shipped packs (verified 29 Sep 2026)

Verified against the text of Act 30 of 2013 on
[India Code](https://www.indiacode.nic.in/bitstream/123456789/2121/1/A2013-30.pdf),
which also prints the Maharashtra amendments.

**`IN-RFCTLARR-2013-v1`** (central, from 1 Jan 2014)

| Key | Value | Citation |
|---|---|---|
| `deadline.objection.days` | 60 days from s.11 | s.15(1) |
| `deadline.declaration.months` | 12 months from s.11, else the notification is deemed rescinded (court-stay periods excluded; Government may extend in writing) | s.19(7) |
| `deadline.award.months` | 12 months from s.19, else the entire proceedings lapse (Government may extend in writing) | s.25 |
| `deadline.payment.months` | 3 months from the award | s.38(1) |
| `deadline.rr_monetary.months` | 6 months from the award | s.38(1) |
| `deadline.rr_infrastructure.months` | 18 months from the award | s.38(1), proviso |
| `money.multiplier.urban` | ×1.00 | First Schedule, item 3 |
| `money.multiplier.rural` | ×1.00 to ×2.00 by distance from urban area, as notified by the state. **Bands are a placeholder, `unverified`** | First Schedule, item 2 |
| `money.solatium.bp` | 100% of compensation | s.30(1); First Schedule, item 5 |
| `money.additional.bp_per_year` | 12% p.a. on market value | s.30(3) |
| `money.additional.start_event` | **`SEC_4_SIA`**: runs from the s.4(2) SIA notification to the award or possession, whichever is earlier | s.30(3) |
| `money.interest.first_year.bp` | 9% p.a. from possession until paid | s.80 |
| `money.interest.after_year.bp` | 15% p.a. after one year from possession | s.80, proviso |
| `money.urgency.tender.bp` / `money.urgency.additional.bp` | 80% tender; +75% additional compensation | s.40(3), s.40(5) |
| `money.sc_st.first_instalment` | at least 1/3 first | s.41(6) |
| `document.scheduled_area.consent` | prior Gram Sabha consent | s.41(3) |
| `alert.offsets.days` | 60, 30, 7 | R-NLAM policy |

**`MH-RFCTLARR-2013-v1`** (Maharashtra, from 26 Apr 2018, Maharashtra Act 37 of 2018)

| Key | Value | Citation |
|---|---|---|
| `money.rr.linear_lumpsum.bp` | Lump-sum R&R of 50% of s.27 compensation for linear projects | s.31A (MH) |
| `procedure.consent_award` | Award by written agreement of all interested persons | s.23A (MH) |
| `procedure.sia_exemption` | State may exempt listed projects from Chapters II and III | s.10A (MH) |
| `money.multiplier.rural` | **Placeholder bands, `unverified`**: replace with the state notification | First Schedule, item 2 |

### Two corrections found during verification

1. **The 12% additional amount starts at the SIA notification (s.4(2)), not the
   s.11 preliminary notification.** The award calculator takes the start date
   from the pack (`money.additional.start_event`). If a parcel has no s.4(2)
   notice (e.g. a project exempted from SIA), it falls back to the s.11 date and
   marks the award `unverified` with the reason.
2. The one-time resettlement allowance is Second Schedule **item 10**, not item 9.

## Adding a pack for a state

1. Write the pack as data, in the same shape as `MAHARASHTRA_PACK` in
   `backend/src/rules/rule-packs.data.ts`:
   ```ts
   export const KARNATAKA_PACK: PackSeed = {
     code: 'KA-RFCTLARR-2013-v1',
     actCode: 'RFCTLARR_2013',
     stateCode: 'KA',
     version: 1,
     title: 'RFCTLARR 2013 as applied in Karnataka',
     source: 'Karnataka notification No. …, verified on …',
     effectiveFrom: '2019-06-01',
     entries: [
       { key: 'money.multiplier.rural', category: 'MONEY', label: '…', value: { range: [1, 2], bands: [/* … */] },
         unit: 'factor', citation: 'First Schedule, item 2; Karnataka notification …', quote: '…' },
     ],
   };
   ```
   Only add keys the state changes; everything else is inherited.
2. Add it to `SHIPPED_PACKS`. `installPacks()` (run by `npm run seed:demo`)
   upserts by `code`, so it is idempotent.
3. **Cite every entry.** If you cannot quote the source text, set
   `unverified: true`. The UI then flags the rule and every award that used it.
4. Never edit a pack that decisions were made under. Publish a new `version`
   with a later `effectiveFrom` and set `effectiveTo` on the old one; old
   cases keep resolving to the old rules.
5. Add a table-driven test in `backend/src/rules/resolve.spec.ts` for the new
   overlay, with dates on both sides of `effectiveFrom`.

## Statutory clocks and alerts

`StatutoryService` recomputes a parcel's clocks whenever an event for it passes
through the outbox (`parcel.*`, `compensation.*`, `rr_case.*`), and all clocks
hourly. It then raises one notification per (deadline, notice, threshold): T-60
and T-30 to the district's Collectors, T-7 and missed deadlines also to the
State Admin. Notifications are deduplicated, so re-running is harmless.

Guards read the same clocks. `DECLARE` is blocked once the s.19(7) window has
passed, and `DECLARE_AWARD` once the s.25 period has passed. Both blockers are
overridable, because the Act lets the Government extend the period, but only
by a State or Central admin with a written reason (the extension order). The
override is written to the audit chain as a highlighted entry.
