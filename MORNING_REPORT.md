# Morning report

_Updated as work lands. The detailed log and every decision are in [PROGRESS.md](PROGRESS.md)._

**Where things stand:** Phase 0, Phase 1 and sections **6.1–6.4** are done, tested and merged
to `main` (nothing is pushed). **6.5 is partial** on branch `feature/6.5-owner-reconciliation`
(backend logic and unit tests done; e2e and UI not). The session ended on a usage limit.

## 1. Done and verified

| What | How to check it |
|---|---|
| **Private Postgres 17.11 + PostGIS 3.6.2** on port 5433, outside OneDrive; start/stop/status scripts | `scripts\db-status.ps1` |
| **Phase 0 gap report**: what really worked in the original code (much of it didn't) | [docs/GAP_REPORT.md](docs/GAP_REPORT.md) |
| **Backend rebuilt on a real foundation**: JWT auth closed by default (the old `X-User-Role` header let anyone act as admin); one lifecycle state machine whose guards cite the Act; an audit hash chain that is recomputed on verify and pinpoints any edited row; transactional outbox; money in paise | `cd backend; npm test` → **109 passed**; `npm run test:e2e` → **40 passed** |
| **Frontend on the live API**: `mockData.ts` and every mock page gone; role portals, dev persona switcher, citizen OTP login, loading/empty/error states, synthetic data labelled | `cd frontend; npx tsc --noEmit`; `npx next build` (all pages prerender) |
| **6.1 Statutory rule engine**: rule packs as cited, versioned data (central + Maharashtra), verified against the India Code text; per-parcel statutory clocks; T-60/30/7 alerts; lapse guards; statutory calendar | [docs/rule-packs.md](docs/rule-packs.md); e2e `statutory.e2e-spec.ts` |
| **6.2 Live interest liability**: s.80 interest and s.30(3) additional amount, live ₹ counter, 12-month trend, nation → parcel drill-down, "act this week" savings | e2e `liability.e2e-spec.ts` |
| **6.3 GIS consent gate**: PostGIS `ST_Intersects` + overlap area against forest / Scheduled Area / FRA / CRZ / protected layers; award and possession hard-blocked in the backend until the right documents exist; overrides rules-bound and audited | e2e `gis-gate.e2e-spec.ts` |
| **6.4 "Why is this project stuck?"**: 9 bottleneck types, priority = statutory risk × ₹ exposure × families with every component explained, action briefs with evidence and owners, audited Accept/Dispute, LLM rephrase-only with a fact check | e2e `why-stuck.e2e-spec.ts` |

### Things I found in the Act that you should know before the finale
1. **The 12% additional amount runs from the s.4(2) SIA notification, not s.11** (s.30(3)).
   The brief had it from s.11; R-NLAM follows the Act.
2. **s.80 interest only arises on compensation unpaid *at possession*.** A payment that is
   late after the award but before possession carries no statutory interest; it shows as a
   missed s.38 deadline instead. The demo has an s.40 urgency case so interest is real.
3. **Scheduled Area consent (s.41(3)) cannot be overridden**: the Act says "in all cases".
4. The multiplier distance bands (First Schedule) are **notified by each state**. I couldn't
   find Maharashtra's, so the bands are marked **unverified** everywhere they are used.

## 2. Partial / not started

- 6.5–6.13 (reconciliation, digital thread and graph, Merkle, document AI and RAG, eCourts
  links, field GNSS/PWA, citizen i18n, change detection, national command wall): see
  PROGRESS.md for the latest.
- Citizen portal works (OTP, my land, money explained, hearings, objections), English only.
- Keycloak mode is kept but untested (dev JWT mode is the default).

## 3. Decisions made overnight

All in PROGRESS.md → "Decisions made overnight". The ones most likely to matter to you:
- The **Why-Stuck #1 is the Wadgaon/Dhanora s.19 lapse** (14 parcels, 37 days, hearings
  pending), not the forest parcel. I didn't rig the scoring; the forest block is still the
  top legal-bar item and makes a great second beat in the demo.
- The backend was **rewritten**, not patched; routes changed; `docs/openapi.json` is the
  contract.
- The seed is **wipe and rebuild** (deterministic), which doubles as reset-demo.

## 4. Needs Parvati

1. **Finish the database from your own PowerShell** (the Claude app is sandboxed and redirects
   `%LOCALAPPDATA%`, so your real cluster has PostGIS but no `rnlam` database yet). From the
   repo root:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\db-setup.ps1
   cd backend; npx prisma migrate deploy; npm run seed:demo
   ```
2. **OneDrive**: pause sync for this folder or move the repo to e.g. `C:\dev\R-NLAM`;
   `node_modules` syncing makes builds take over 10 minutes.
3. Optional: to try AI rephrasing/translation, run Ollama elsewhere and set
   `LLM_PROVIDER=openai-compatible`, `LLM_BASE_URL`, `LLM_MODEL` in `backend/.env`.

## 5. How to see it

```powershell
# each time (after step 4.1 once)
cd backend;  npm run start:dev     # starts the DB too; API on :4000, Swagger at /api/docs
cd frontend; npm run dev           # UI on :3000   (or: npx next build; npx next start)
```

Open http://localhost:3000/login and pick a persona. A 5-minute path:

1. **Anita Deshpande (national)** → Command dashboard: live "cost of delay" counter, stage funnel.
2. **Why is it stuck?** → #1 Wadgaon/Dhanora s.19 lapse in 37 days; open it for the
   score breakdown, evidence and owner; press **Dispute** to see the audited feedback.
3. **GIS consent gate** → the red forest overlap on YTL-KRS-004; open the parcel and try
   *Declare award*: the backend refuses with the Act-cited blockers. Upload forest clearance
   and the FRA certificate (any PDF) and it goes through.
4. **Interest liability** → Borgaon urgency parcels at 15% under s.80; "pay this week" saves ₹…
5. **Statutory calendar** → T-60 alert for the Dhanora declaration; the rule pack shows the Act's text.
6. **Audit trail** → *Verify now* → "Integrity: Verified ✓".
7. Citizen: `/citizen/login`, mobile **9800000001**; the OTP is shown on screen in dev mode.
