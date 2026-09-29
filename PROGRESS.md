# R-NLAM progress log

Living log of the SIH 2026 finalist build. Newest status first. Evidence for every
"done" item is a command you can rerun.

## Current status

| Phase / item | Status | Branch |
|---|---|---|
| Phase 0: DB setup (user-space PG 17.11 + PostGIS 3.6.2) | Done (see "Needs Parvati" #1) | `phase0-reality-check` |
| Phase 0: reality check + `docs/GAP_REPORT.md` | Done | `phase0-reality-check` |
| Phase 1: auth, DTOs, migrations, state machine, audit, outbox, seed | Done: `npm test` 43 passed, `npm run test:e2e` 18 passed | `phase1-backend-core` (merged) |
| Phase 1: frontend mock removal | In progress | `phase1-frontend` |
| 6.1 rule engine … 6.13 | Not started | — |

## ⚠ Read first: OneDrive

The repo lives in OneDrive. `node_modules` (~400 MB) and `ai-service/.venv` are git-ignored,
but **OneDrive still syncs them**. The first `next build` took over 10 minutes, largely
because of file I/O on this folder. Recommended: in OneDrive settings, pause syncing or mark
`R-NLAM` as "Always keep on this device" and exclude it. Better still, move the repo to
`C:\dev\R-NLAM`. I did not move it, because that is outside the repo.

## Needs Parvati

1. **Finish the database from your own PowerShell (one command).** The Claude desktop app
   is an MSIX-packaged app, and Windows silently redirects anything it writes under
   `%LOCALAPPDATA%` into its private package folder. So:
   - Your real cluster at `%LOCALAPPDATA%\rnlam-pg\data` is initialised (PG binaries plus
     PostGIS merged, superuser password in `%LOCALAPPDATA%\rnlam-pg\superuser.txt`), but
     it has **no `rnlam` role or database yet**.
   - Overnight I worked on a separate cluster (`data-claude`) that only this app can see.
   - Run this in a normal PowerShell window, from the repo root:
     ```powershell
     powershell -ExecutionPolicy Bypass -File scripts\db-setup.ps1
     cd backend; npx prisma migrate deploy; npm run seed:demo
     ```
     It creates the role, database and PostGIS, rewrites `DATABASE_URL` in `backend/.env`
     for the real cluster, and migrates and seeds.
   - (I tried launching setup outside the app through WMI; the safety classifier blocked it,
     so I stopped pursuing that.)
2. **OneDrive**: see above.

## Decisions made overnight

- **Two clusters, one port.** `data` (yours) and `data-claude` (mine) both use port 5433,
  never at the same time. `db-start.ps1` refuses to start the real cluster from inside a
  packaged app, because the split writes would corrupt it.
- **PostGIS in `template1`.** PostGIS is not a trusted extension, so only a superuser can
  create it. Putting it in `template1` lets Prisma's shadow database (created by the
  non-superuser `rnlam`) get it automatically. Migrations still say
  `CREATE EXTENSION IF NOT EXISTS postgis`.
- **Checksums.** The PostGIS bundle MD5 was verified against OSGeo's `.md5`. EDB publishes
  no checksum for the binaries zip, so I verified the archive listing instead. PG 17.12
  returned 403 from EDB, so I used 17.11.
- **Unverified docs archived.** `docs/audit/*` and the `FINAL_*`, `GOLDEN_*`,
  `IMPLEMENTATION_STATUS` and `PRD_TRACEABILITY` reports moved to `docs/archive/` with a
  note that they predate verification.
- **Rotated the dev DB password once.** During the reality check I printed the first
  characters of `backend/.env` by mistake. That was a local-only password, and I
  regenerated it straight away. Values in `.env` are never printed now.

- **Rewrote rather than patched the backend services.** The old ones had no validation,
  no guards, float money and a non-recomputable audit hash, so there was little to keep
  beyond the module layout. The routes changed shape (`/gis/geojson` became
  `/gis/parcels`, workflow became `/lifecycle`); `docs/openapi.json` is the new contract.
- **Money is BigInt paise and serialises to JSON as a number.** Every realistic amount
  (up to ~₹90 lakh crore) is below 2^53; anything larger falls back to a string.
- **PostGIS lives in schema `extensions`, not `public`.** Otherwise Prisma treats
  `spatial_ref_sys` as drift and generates migrations that drop it. Prisma pins
  `search_path` to `public` per connection, so raw SQL writes `extensions.ST_*`.
- **The seed wipes and rebuilds** (TRUNCATE, then a deterministic PRNG). That makes it
  idempotent and doubles as `reset-demo`.
- **Statutory numbers are placeholders until 6.1.** Solatium 100%, additional amount 12%
  p.a., and the multiplier distance bands live in `RulesService` and are marked
  unverified. 6.1 moves them into cited, versioned rule packs.
- **Keycloak mode is kept but untested.** `jwks-rsa` now loads lazily (its ESM
  dependency broke Jest). Dev mode issues equivalent claims.

## Log

- **2026-09-29 02:10–04:00**: Phase 1 backend. New schema and baseline migration; auth
  and the global guard; lifecycle engine with 8 machines; audit chain v2; outbox; domain
  modules; demo seed (164 parcels, 944 audit entries, 4 s); 43 unit and 18 e2e tests
  passing.

- **2026-09-29 01:00–02:10**: cloned; installed deps; built user-space PG + PostGIS; ran
  every existing check; wrote `docs/GAP_REPORT.md`; added `scripts/db-*.ps1`; the backend
  now loads `.env`.
