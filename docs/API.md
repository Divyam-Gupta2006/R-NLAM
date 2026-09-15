# R-NLAM REST API Specification

## Global Conventions
- Base URL: `http://localhost:4000/api`
- Content Type: `application/json`
- Auth Header: `Bearer <jwt_token>`

---

## Endpoint Summary

### 1. Authentication & User Scope (`/api/auth`)
- `POST /auth/login` — Authenticate user, return JWT token and role payload.
- `GET /auth/me` — Return active user details, role, jurisdiction, organization.

### 2. Projects & Proposals (`/api/projects`, `/api/proposals`)
- `GET /projects` — List projects with role/jurisdiction filter.
- `GET /projects/:id` — Get detailed project workspace data (Overview, Timeline, KPIs).
- `POST /projects` — Create new project (PIA role).
- `POST /proposals` — Upload proposal details & attach land requirements.
- `PATCH /proposals/:id/submit` — Submit proposal for District Scrutiny.

### 3. Workflow Engine (`/api/workflow`)
- `GET /workflow/templates` — List legal workflow templates.
- `GET /workflow/instance/:projectId` — Get current workflow state & active tasks.
- `POST /workflow/action` — Execute transition action (`Approve`, `Return`, `Reject`, `Raise Query`, `Forward`, `Verify`).

### 4. GIS & Parcels (`/api/parcels`, `/api/gis`)
- `GET /parcels?projectId=:id` — Get list of parcels with status & area calculations.
- `GET /parcels/:id` — Get complete 5D parcel detail view.
- `GET /gis/geojson?projectId=:id` — Get PostGIS polygon feature collection for map rendering.
- `POST /parcels/verify` — Officer field verification update (status, GPS, geotagged photo).

### 5. Financial & Awards (`/api/awards`, `/api/compensation`)
- `GET /awards?projectId=:id` — List declared awards.
- `POST /awards` — Declare new award for verified parcels.
- `GET /compensation/cases` — List compensation payment queue.
- `POST /compensation/initiate-payment` — Initiate financial disbursement via treasury adapter.

### 6. R&R Management (`/api/rr`)
- `GET /rr/families?projectId=:id` — List affected families.
- `POST /rr/eligibility` — Verify family eligibility & assign entitlements.
- `POST /rr/delivery` — Record benefit delivery (housing, financial allowance).

### 7. Possession Management (`/api/possession`)
- `GET /possession/cases` — List possession handover queue.
- `POST /possession/record` — Record possession taken (capture GPS, photos, handover doc).

### 8. Documents & Vault (`/api/documents`)
- `POST /documents/upload` — Upload file to MinIO object store & index metadata.
- `GET /documents/:id/download` — Get secure download URL.

### 9. Governance & Audit (`/api/audit`, `/api/notifications`)
- `GET /audit?entityType=:type&entityId=:id` — Query tamper-evident hash-chained audit log.
- `GET /notifications` — List in-app notifications & SLA/statutory alerts.

### 10. AI Services Gateway (`/api/ai` -> FastAPI 8000)
- `POST /ai/ocr/extract` — Extract entities from PDF/image scan.
- `POST /ai/risk/assess` — Estimate project delay risk score & contributing factors.
- `POST /ai/analytics/nlp` — Translate natural language question to structured SQL/map response.

