# R-NLAM Gap Report (Phase 0 reality check)

Date: 2026-09-29 · Commit examined: `76f67a6` ("Initial R-NLAM implementation")
Method: everything below was **run**, not read. Earlier "VERIFIED" reports are in
[`archive/`](archive/README.md) and are not treated as evidence.

Status key: **Works** (ran it, correct) · **Partial** (runs, but incomplete or wrong in an
important way) · **Mock-only** (UI or response is hardcoded/synthetic, no real logic) ·
**Missing** (not present).

## Environment used

| Item | Result | Evidence |
|---|---|---|
| Postgres 17.11 + PostGIS 3.6.2, user-space, port 5433 | Works | `scripts/db-setup.ps1`; `SELECT postgis_full_version()` → `POSTGIS="3.6.2"` |
| `npm ci` backend / frontend | Works | 237 / 150 packages installed |
| Backend type-check | Works | `npx tsc -p tsconfig.build.json --noEmit` → exit 0 (but `strictNullChecks` and `noImplicitAny` are **off**) |
| Frontend production build | Works | `npx next build` → exit 0, ~130 routes |
| AI service tests | Works | `pytest -q` → 8 passed; `verify_sanity.py` → 4/4 |
| Prisma migrations | **Missing** | No `prisma/migrations/`; project used `prisma db push` |
| Seed scripts | Partial | `ts-node prisma/seed-demo.ts` fails: *Environment variable not found: DATABASE_URL* (scripts never load `.env`). Works with `-r dotenv/config`: 15 projects, 150 parcels, 447 audit events |
| `next@14.2.5` | Partial | npm flags a published security advisory; needs a patch bump |

## Modules

| Module | Status | Evidence / notes |
|---|---|---|
| Auth: Keycloak | Partial | `verify_keycloak_auth.js` → 3 passed, 3 failed (no Keycloak running). Its "fail-closed" test passes on an HTTP **200**, so it tests nothing |
| Auth: login | Mock-only | `POST /auth/login` returns `rnlam_jwt_<userId>_<ts>`: a string, not a signed token. No password or OTP |
| Auth: RBAC | **Broken** | `curl /api/projects` and `/api/audit` with **no credentials → 200**. Any caller can send `X-User-Role: CENTRAL_ADMIN` and be treated as admin (dev auth is ON unless `NODE_ENV=production`). 5 controllers have no guard at all (auth, citizen, integrations, sla, users) |
| Input validation | **Missing** | Controllers take `@Body() body: any`; `POST /projects {}` with admin header → **500**. Swagger lists 62 operations and **0 schemas** |
| Projects / proposals / parcels / objections / hearings / awards / possession / R&R | Partial | CRUD-style endpoints work against the DB (`verify_runtime.js` 10/10, `verify_golden_demo.js` 15/15). No lifecycle rules: any status can be set to any other |
| Workflow engine | Mock-only | `POST /workflow/action` accepts arbitrary `fromStage`/`toStage` strings, no guards, no events, **no audit entry**. If the actor is unknown it silently uses the *first user in the DB* |
| Compensation | Partial | `initiate-payment` marks a case PAID with a fabricated `PFMS<timestamp>` UTR. Amounts are `Float` rupees (money in floats). No solatium, multiplier, 12% additional amount or interest |
| Audit hash chain | Partial | Entries are chained, but the hash covers only actor/action/entity plus a timestamp that is **not stored**, so no hash can be recomputed. `GET /audit/verify-chain` only checks `previousHash` links, so editing `newState` or `action` in a row goes **undetected**. `GET /audit/verify` → 404 |
| GIS | Partial | `Parcel.geometry` is a **JSON** column. Despite the PostGIS extension there are no geometry columns, no spatial index, and no `ST_*` query anywhere. `/gis/geojson` just returns the stored JSON |
| Documents | Partial | Metadata rows only; `minioKey` is written but nothing is stored (no MinIO client, no local-disk adapter) |
| Notifications / SLA | Partial | `check-breaches` flags past-due SLA tasks. No statutory clock logic |
| Integrations (Bhoomi, PFMS, DigiLocker) | Mock-only | Canned responses. Labelled `*_MOCK` in the API, not in the UI |
| Analytics KPIs | Works | `/analytics/kpis` aggregates real DB rows |
| Citizen API | Partial | Returns rows for a hardcoded citizen, with no identity binding |
| Event stream (Kafka/outbox) | **Missing** | No events emitted anywhere |
| Field offline (Dexie) | Partial | IndexedDB queue exists in `frontend/lib/db.ts`; sync posts to `/parcels/verify`. No hashing, no conflict handling, no PWA manifest or service worker |
| AI: OCR | Mock-only | No Tesseract anywhere. `ocr_service.py` runs **regexes over text passed in the request**; image or PDF bytes are not OCR'd |
| AI: delay risk | Partial | Random Forest trained at startup on 500 **synthetic** rows generated from a formula. Works as a demo, but must be labelled synthetic |
| AI: NL→SQL | Mock-only | Keyword → canned SQL string templates; nothing is executed or validated |

## Frontend

| Area | Status | Evidence |
|---|---|---|
| Pages importing `lib/mockData.ts` | Mock-only | **37 pages + 4 shared components** (`grep -rl mockData app components context`) |
| Pages with **inline** hardcoded arrays (neither mockData nor API) | Mock-only | **67 pages**, e.g. `state/sla` hardcodes two projects. The real mock surface is ~100 pages, not 37 |
| Pages calling the API | Partial | ~25 pages use `lib/api/client.ts`, which always sends `X-User-Role` (defaults to `CENTRAL_ADMIN`) |
| Role switcher | Partial | `RoleContext` switches the sidebar and a header value; no real session |
| Loading / empty / error states | Missing | Most pages render nothing or crash on empty data |
| i18n | Missing | English only |
| Design tokens | Partial | Tailwind defaults; no shared token file |

## Pitch-deck differentiators (section 6)

| # | Feature | Status | Evidence |
|---|---|---|---|
| 6.1 | Statutory rule engine, versioned rule packs | **Missing** | No rule tables. Sections appear only as strings in `StatutoryMilestone.referenceLaw` |
| 6.2 | Live interest liability + roll-up | **Missing** | No interest computation anywhere (`grep -ri interest backend/src` → none) |
| 6.3 | Geo-gated consent (GIS gate) | **Missing** | No constraint layers, no `ST_Intersects`, no workflow guard |
| 6.4 | "Why is this project stuck?" engine | **Missing** | Nearest thing is the AI risk score, which is not explainable per bottleneck |
| 6.5 | Owner reconciliation (transliteration, Jaro-Winkler) | **Missing** | — |
| 6.6 | Digital thread, parcel graph, event bus | **Missing** | Audit drawer exists; no parcel timeline, graph or events |
| 6.7 | Merkle roots and inclusion proofs | **Missing** | The chain itself is not recomputable (see Audit above) |
| 6.8 | Document AI with confidence, RAG with citations | Mock-only / Missing | Regex extraction with fixed confidences; no RAG |
| 6.9 | eCourts candidate case links | **Missing** | — |
| 6.10 | Offline GNSS evidence, installable PWA | Partial | Dexie queue only (see Field above) |
| 6.11 | Citizen digital twin, multilingual | Mock-only | Citizen pages have inline data, English only |
| 6.12 | Change detection | **Missing** | — |
| 6.13 | National command dashboard | Partial | `central/overview` uses live KPIs plus hardcoded panels |
| — | Demo mode, reset, guided tour | Partial | `reset-demo.ts` exists; no toggle, no tour |

## Fixed during Phase 0

- Seed scripts, `start` and `start:dev` now preload `.env` (`-r dotenv/config`).
- `npm run db:start|db:stop|db:status`; `start:dev` starts the DB first.
- Removed absolute `c:/Users/Acer/...` links; unverified reports moved to `docs/archive/`.

## What this means for the plan

The backend has the right module skeleton and a usable data model, but its three
trust-critical properties (**who is calling**, **is this transition legal**, and **can the
record be proven untampered**) are all missing or bypassable. Phase 1 therefore starts
with the backend: real dev JWTs and closed-by-default guards, validated DTOs, Prisma
migrations with PostGIS geometry and money in paise, one lifecycle state machine that
writes audit and outbox entries in the same transaction, and a recomputable hash chain.
Frontend mock removal follows on top of that API.
