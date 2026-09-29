# Morning report

_Draft: kept current as work lands. Detailed log in [PROGRESS.md](PROGRESS.md)._

## 1. Done and verified

| Item | Proof (command) |
|---|---|
| Private Postgres 17.11 + PostGIS 3.6.2 on port 5433 | `scripts/db-setup.ps1`, `scripts/db-status.ps1` |
| Phase 0 gap report | [docs/GAP_REPORT.md](docs/GAP_REPORT.md) |
| Backend rebuilt on a real foundation: JWT auth closed by default, one lifecycle state machine, audit hash chain that verification recomputes end to end, transactional outbox | `cd backend; npm test` (64 passed), `npm run test:e2e` (24 passed) |
| Frontend on the live API; `mockData.ts` deleted; all ~100 mock pages replaced | `cd frontend; npx tsc --noEmit`; `npx next build` (105/105 pages) |
| 6.1 statutory rule engine: cited, versioned rule packs; statutory clocks; T-60/30/7 alerts; lapse guards; calendar | same test commands; see [docs/rule-packs.md](docs/rule-packs.md) |

## 2. Partial

See PROGRESS.md "Current status" table.

## 3. Decisions made overnight

See PROGRESS.md "Decisions made overnight".

## 4. Needs Parvati

See PROGRESS.md "Needs Parvati". The first item (finish the database from your own
PowerShell) is required before you can run anything.

## 5. How to see it

```powershell
# once: finish the database (from a normal PowerShell window, repo root)
powershell -ExecutionPolicy Bypass -File scripts\db-setup.ps1
cd backend; npx prisma migrate deploy; npm run seed:demo

# each time
cd backend; npm run start:dev        # API on :4000, Swagger at /api/docs
cd frontend; npm run dev             # UI on :3000
```

Open http://localhost:3000/login and pick a persona.
