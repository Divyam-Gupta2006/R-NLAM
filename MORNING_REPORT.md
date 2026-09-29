# R-NLAM: status report

_SIH 2026 · Problem Statement 26016 (DoLR) · Team GAP BRIDGERS._
_Written 29 Sep 2026. The day-by-day log and every decision are in [PROGRESS.md](PROGRESS.md)._

## Where things stand

- **Merged to `main` (nothing pushed):**
  - Phase 0 (reality check).
  - Phase 1 (backend core and frontend on the live API).
  - Features 6.1 to 6.11, and 6.13.
- **Not started:** 6.12 change detection (stretch).
- **Also open:** demo mode, the guided tour, the README rewrite and the other docs listed in section 3.
- **Verified by tests at the last merge:**

  | Suite | Command | Result |
  |---|---|---|
  | Backend unit | `cd backend; npm test` | **208 passed** |
  | Backend end-to-end, against a real Postgres + PostGIS test database | `npm run test:e2e` | **75 passed** |
  | AI service | `cd ai-service; .venv\Scripts\python -m pytest -q` | **27 passed** |
  | Frontend | `npx tsc --noEmit` | clean |
  | Frontend | `npx next build` | **131/131 pages** |

- **Git:** 13 feature branches, each merged only after its tests passed.

## 1. What was built, and how to check each part

### Foundation (Phase 0 and Phase 1)

| What | Check |
|---|---|
| **Private Postgres 17 + PostGIS 3.6** on port 5433, outside OneDrive. Scripts to set up, start, stop and check it; the backend dev start runs `db-start` itself. | `scripts\db-status.ps1` |
| **Gap report** on the original repo. Much of it was mocked; the most serious finding was an `X-User-Role` header that let anyone act as admin. | [docs/GAP_REPORT.md](docs/GAP_REPORT.md) |
| **Backend rebuilt.** Key parts: <ul><li>JWT auth that is closed by default.</li><li>Scoping by jurisdiction on every query.</li><li>One lifecycle state machine (8 machines) whose guards cite the Act.</li><li>Senior overrides need a reason and are highlighted in the audit.</li><li>A SHA-256 audit hash chain written in the same transaction as each change.</li><li>A transactional outbox; money in paise; UTC storage with IST display.</li></ul> | `npm test`, `npm run test:e2e` |
| **Frontend on the live API.** The mock data is gone. It has portals for each role, a dev persona switcher, citizen OTP sign-in, loading/empty/error states, and "Synthetic" labels on demo data. | `next build` |
| **Deterministic demo seed**: 6 projects, about 160 parcels, 20 users, around 1,000 audit entries and 238 sealed Merkle roots, built in about 16 s. It doubles as the demo reset. | `cd backend; npm run seed:demo` |

### Features (section 6)

| # | Feature | What it does | Check |
|---|---|---|---|
| 6.1 | **Statutory rule engine** | <ul><li>Rule packs as cited, versioned data (central + Maharashtra), verified against the India Code text.</li><li>Statutory clocks per parcel, with T-60/30/7 alerts.</li><li>Lapse guards and a statutory calendar.</li></ul> | [docs/rule-packs.md](docs/rule-packs.md), `statutory.e2e-spec.ts` |
| 6.2 | **Live interest liability** | <ul><li>s.80 interest and the s.30(3) additional amount.</li><li>A counter that ticks every second, a 12-month trend, and drill-down from nation to parcel.</li><li>"Act this week" savings.</li></ul> | `liability.e2e-spec.ts` |
| 6.3 | **GIS consent gate** | <ul><li>PostGIS overlap checks against forest, Scheduled Area, forest-rights claim, CRZ and protected-area layers.</li><li>The backend hard-blocks award and possession until the right documents are on file.</li></ul> | `gis-gate.e2e-spec.ts` |
| 6.4 | **"Why is this project stuck?"** | <ul><li>10 bottleneck types.</li><li>Priority = statutory risk × ₹ at risk × families, with every component explained.</li><li>Action briefs with an owner and deadline; audited Accept/Dispute.</li><li>The LLM may only rephrase, and a fact check guards it.</li></ul> | `why-stuck.e2e-spec.ts` |
| 6.5 | **Owner reconciliation** | <ul><li>Matches Devanagari, Gujarati and Kannada names to Latin ones (Jaro-Winkler, phonetic keys, given-name and surname gates).</li><li>Gives reasons for every match.</li><li>Maker-checker whenever money is involved; records are never merged.</li></ul> | `reconciliation.e2e-spec.ts` |
| 6.6 | **Digital thread and parcel graph** | <ul><li>Every audited event on a parcel and everything linked to it, with hashes.</li><li>A project graph.</li><li>`docs/asyncapi.yaml` covering 8 event types.</li></ul> | `thread.e2e-spec.ts` |
| 6.7 | **Merkle audit** | <ul><li>RFC 6962 Merkle roots per IST day, chained together.</li><li>Inclusion proofs that the browser checks for itself.</li><li>A tamper demo that is caught and then restored.</li></ul> | `npm run demo:tamper`, `npm run demo:restore`, `merkle.e2e-spec.ts` |
| 6.8 | **Document AI and "Ask the Act"** | <ul><li>Field extraction from award PDFs, gazettes and 7/12 extracts (English/Marathi), with a confidence and a source snippet per field.</li><li>Fields under 80% confidence must be confirmed by a person; confirmations and corrections are audited.</li><li>Cited legal Q&A that quotes the Act and refuses weak matches.</li></ul> | `pytest`, `document-ai.e2e-spec.ts` |
| 6.9 | **Court-case links (eCourts)** | <ul><li>A synthetic eCourts adapter.</li><li>A matcher using survey number, village and party name.</li><li>Links are only candidates until an officer confirms them.</li><li>Confirmed title suits and stay orders feed "Why is it stuck?".</li></ul> | `court-links.e2e-spec.ts` |
| 6.10 | **Offline field app (PWA)** | <ul><li>GNSS point averaging and boundary walk, and photos.</li><li>Each bundle is sealed with SHA-256 on the device; the server recomputes the seal and refuses tampering.</li><li>IndexedDB queue that syncs when back online.</li><li>Conflicts go to the Collector instead of overwriting.</li><li>Installable manifest and service worker.</li></ul> | `field-evidence.e2e-spec.ts`; browser-checked offline |
| 6.11 | **Citizen portal in 3 languages** | <ul><li>English, Hindi and Marathi across the whole citizen portal.</li><li>Map, statutory dates, award lines and **interest owed**.</li><li>R&R, hearings and objections.</li><li>**Complaints** (synthetic CPGRAMS) with an officers' desk.</li><li>**Papers** with DigiLocker (synthetic).</li><li>A `TranslationProvider` stub for Bhashini.</li></ul> | `citizen.e2e-spec.ts`, `citizen-i18n.spec.ts`; browser-checked in Hindi and Marathi |
| 6.13 | **National command wall screen** | <ul><li>Live cost of delay; projects by stage.</li><li>Top 10 stuck projects with their briefs.</li><li>GIS-blocked parcels, SLA breaches by state, families awaiting R&R.</li><li>Full-screen mode.</li></ul> | `command.e2e-spec.ts`; browser-checked |

### Documentation produced

- **API contract:** [docs/openapi.json](docs/openapi.json), regenerated today (95 paths). Swagger runs at `/api/docs`.
- **Events:** [docs/asyncapi.yaml](docs/asyncapi.yaml).
- **Rule packs:** [docs/rule-packs.md](docs/rule-packs.md).
- **Gap report:** [docs/GAP_REPORT.md](docs/GAP_REPORT.md).
- **Old audit documents:** the original repo's unverified audit docs were moved to `docs/archive/`, with a note saying why.

## 2. Honest numbers and limits

- **Legal Q&A accuracy (6.8).**
  - On the questions I tuned with, the right section came first 10 times in 12 and was always in the top 3.
  - **On 8 new questions written afterwards, it came first only 3 times** (4 in the top 3).
  - Every off-topic question was refused.
  - The page states these numbers. Better retrieval needs sentence embeddings (see Needs Parvati #4).
- **Document extraction** reads PDFs with a text layer. Scanned images need Tesseract; without it, the API says so clearly and never makes up a result.
- **All external systems are synthetic adapters behind interfaces:** eCourts, CPGRAMS, DigiLocker, Bhashini, payments and land records. Every such record is labelled.
- **The simulated GNSS walk** (for demos on a laptop) is sealed into the bundle as `SIMULATED` and tagged Synthetic in the interface.
- **Keycloak mode** is kept but untested; the dev JWT mode is the default.

### Things in the Act you should know before the finale

1. **The 12% additional amount runs from the s.4(2) notification, not s.11** (s.30(3)).
2. **s.80 interest arises only on compensation unpaid at possession.** Late payment before possession shows as a missed s.38 deadline instead.
3. **Scheduled Area consent (s.41(3)) cannot be overridden** ("in all cases").
4. **The First Schedule distance bands are notified by each state.** I couldn't find Maharashtra's, so they are marked unverified.

## 3. Not done yet

- **6.12 change detection** (stretch): not started.
- **Demo mode:** there is no in-app toggle, reset-demo button or 5–7 step guided tour yet. `data-tour` markers are already in place, and `npm run seed:demo` is the reset.
- **Docs still to write:** the README rewrite (Mermaid diagram, Windows quick start) and the traceability matrix are not written. ARCHITECTURE, API, DATABASE, DEPLOYMENT and DEMO-DATASET also still describe the old app.
- **Frontend checks:** there are no automated UI tests, and ESLint is not configured. Frontend quality currently rests on the typecheck, the production build and manual browser checks.

## 4. Decisions worth knowing about

All are listed in PROGRESS.md → "Decisions made overnight". The main ones:

- **Backend rebuilt, not patched.** The backend was rewritten, and routes changed; `docs/openapi.json` is the contract.
- **Why-Stuck ranking was not rigged.** The #1 bottleneck is the Wadgaon/Dhanora s.19 lapse, not the forest parcel. I refined the scoring on principle rather than tuning it to a result.
- **People decide, never automatic matching.** This applies to reconciliation, court links and extracted fields: machines only propose. Every decision is audited, and nothing is merged or overwritten.
- **Field sessions are remembered on the device** so the installed app opens offline. An expired token only pauses sync; the evidence stays safe on the device.
- **Two servers were run together briefly, three times.** Each time it was the production frontend (not the dev server) with the backend, while I checked screens in the browser, with at least 3 GB free. Each check found and fixed real bugs.

## 5. Needs Parvati

1. **Finish the database in your own PowerShell.** The Claude app redirects `%LOCALAPPDATA%`, so your real cluster has no `rnlam` database yet. From the repo root:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\db-setup.ps1
   ```
   Then:
   ```powershell
   cd backend; npx prisma migrate deploy; npm run seed:demo
   ```
2. **OneDrive:** pause sync for this folder, or move the repo (for example to `C:\dev\R-NLAM`). Syncing `node_modules` makes builds very slow.
3. **eCourts / NJDG access** is needed for real court data (6.9).
4. **Better legal retrieval** needs an embedding model download (about 100–400 MB).
5. **Two screens not yet clicked through with every service up:** the document "Read fields" dialog, and Ask the Act with the AI service running. Their APIs are tested.
6. **Service worker check in normal Chrome.** The Claude app's built-in browser refused to register it, although the file is served correctly.
7. **Hindi and Marathi wording** should be read by a native speaker. A test proves every string is present, not that it is good.
8. **Real Bhashini, CPGRAMS and DigiLocker** need credentials or onboarding.
9. **Pushing is yours.** Nothing has been pushed:
   ```powershell
   git push origin main
   ```

## 6. How to see it

Run each command in its own terminal, from the repo root.

**Backend** (starts the DB too; API on :4000, Swagger at /api/docs):
```powershell
cd backend; npm run start:dev
```

**Frontend** (UI on :3000). For development:
```powershell
cd frontend; npm run dev
```
Or the production build, which is lighter on memory:
```powershell
cd frontend; npx next build; npx next start
```

**AI service** (optional; needed for "Read fields" and Ask the Act):
```powershell
cd ai-service; .venv\Scripts\python -m uvicorn app.main:app --port 8000
```

### A 10-minute demo path

Open http://localhost:3000/login and pick a persona.

1. **Anita Deshpande (national).** The wall screen opens.
   1. Press the full-screen button. The cost of delay ticks every second.
   2. Show the top 10 stuck projects with their briefs.
2. **Why is it stuck?** Open #1, the Wadgaon/Dhanora s.19 lapse, to show its score, evidence and owner. Press **Dispute** to show the audited feedback.
3. **GIS consent gate.** YTL-KRS-004 overlaps reserved forest.
   1. Try *Declare award*. The backend refuses, citing the Act.
   2. Upload the clearance and certificate, and it goes through.
4. **Sameer Khan (Yavatmal Collector).**
   1. Open **Court case links** and confirm SCS 131/2025 (the forest-land suit).
   2. Back in Why-Stuck, a litigation bottleneck now appears with its CNR.
5. **Citizen Namdeo** (9800000002, OTP shown on screen) at `/citizen/login`.
   1. Switch to **मराठी**. His complaint about the delayed award is there in Marathi.
   2. As Sameer Khan, answer it under **Citizen grievances**.
6. **Kiran Bhosale (field).** Under Capture evidence:
   1. Tick the simulated walk, walk the boundary, then seal and queue.
   2. Open **Sync** to see the server re-check the seal and report the overlap with the recorded boundary.
7. **Priya Wagh (Wardha Collector).**
   1. **Field evidence** shows a conflict to resolve.
   2. In **Documents**, use *Read fields* on the award copy (needs the AI service).
   3. **Ask the Act** answers with section citations.
8. **Audit.** Run *Verify now*, then `npm run demo:tamper` and verify again: the edited entry is pinpointed. Finish with `npm run demo:restore`.
