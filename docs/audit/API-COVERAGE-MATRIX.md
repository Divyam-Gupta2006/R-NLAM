# R-NLAM API Endpoint Coverage Matrix

## Overview
This matrix documents every NestJS REST API endpoint and FastAPI microservice route active in the system, along with its backing Prisma model, HTTP status, and consuming frontend components.

---

| API Endpoint | Method | Backend Module | Primary Database Model | Consuming Frontend Page / Component | Verified Status |
| :--- | :---: | :--- | :--- | :--- | :---: |
| `/api/analytics/kpis` | `GET` | `AnalyticsModule` | `Project`, `Parcel`, `Compensation` | `/central/overview`, `/state/overview` | 🟢 **LIVE (200)** |
| `/api/analytics/project/:id` | `GET` | `AnalyticsModule` | `Project`, `WorkflowInstance` | `/project/[id]` Workspace Hub | 🟢 **LIVE (200)** |
| `/api/analytics/states` | `GET` | `AnalyticsModule` | `Jurisdiction`, `Project` | `/central/states` | 🟢 **LIVE (200)** |
| `/api/analytics/districts` | `GET` | `AnalyticsModule` | `Jurisdiction`, `Project` | `/central/districts`, `/state/districts` | 🟢 **LIVE (200)** |
| `/api/projects` | `GET` | `ProjectsModule` | `Project` | `/central/projects`, `/state/projects` | 🟢 **LIVE (200)** |
| `/api/projects/:id` | `GET` | `ProjectsModule` | `Project` | `/project/[id]` Workspace Hub | 🟢 **LIVE (200)** |
| `/api/projects` | `POST` | `ProjectsModule` | `Project`, `WorkflowInstance` | `/pia/new-project` | 🟢 **LIVE (201)** |
| `/api/proposals` | `GET` | `ProposalsModule` | `Proposal` | `/district/proposals`, `/state/approvals` | 🟢 **LIVE (200)** |
| `/api/proposals/:id/status` | `PATCH` | `ProposalsModule` | `Proposal` | Proposal Review Action Buttons | 🟢 **LIVE (200)** |
| `/api/workflow/templates` | `GET` | `WorkflowModule` | `WorkflowTemplate` | `/central/workflows` | 🟢 **LIVE (200)** |
| `/api/workflow/instance/:id` | `GET` | `WorkflowModule` | `WorkflowInstance` | `/project/[id]` Tab 5 | 🟢 **LIVE (200)** |
| `/api/workflow/action` | `POST` | `WorkflowModule` | `WorkflowAction`, `WorkflowInstance` | `ActionButtons.tsx` | 🟢 **LIVE (201)** |
| `/api/parcels` | `GET` | `ParcelsModule` | `Parcel` | `/central/land`, `/district/parcels` | 🟢 **LIVE (200)** |
| `/api/parcels/:id` | `GET` | `ParcelsModule` | `Parcel` | `/field/parcel/[id]`, Parcel Detail Drawer | 🟢 **LIVE (200)** |
| `/api/parcels/verify` | `POST` | `ParcelsModule` | `ParcelVerification`, `Parcel` | `/field/sync`, Dexie Offline Queue | 🟢 **LIVE (200)** |
| `/api/gis/geojson` | `GET` | `GisModule` | `Parcel` (PostGIS `ST_AsGeoJSON`) | `MapViewer.tsx`, `/district/gis` | 🟢 **LIVE (200)** |
| `/api/gis/stats` | `GET` | `GisModule` | PostGIS Spatial Aggregation | `/gis/analytics` | 🟢 **LIVE (200)** |
| `/api/objections` | `GET` | `ObjectionsModule` | `Objection` | `/district/objections` | 🟢 **LIVE (200)** |
| `/api/objections` | `POST` | `ObjectionsModule` | `Objection` | `/citizen/grievance` | 🟢 **LIVE (201)** |
| `/api/hearings` | `GET` | `HearingsModule` | `Hearing` | `/district/hearings` | 🟢 **LIVE (200)** |
| `/api/awards` | `GET` | `AwardsModule` | `Award` | `/district/awards` | 🟢 **LIVE (200)** |
| `/api/compensation/cases` | `GET` | `CompensationModule` | `Compensation` | `/finance/compensation`, `/finance/payments` | 🟢 **LIVE (200)** |
| `/api/compensation/initiate-payment` | `POST` | `CompensationModule` | `PaymentReference`, `Compensation` | Payment Action Button | 🟢 **LIVE (201)** |
| `/api/rr/families` | `GET` | `RRModule` | `AffectedFamily` | `/rr/families`, `/state/rr` | 🟢 **LIVE (200)** |
| `/api/rr/delivery` | `POST` | `RRModule` | `RRDelivery` | Benefit Delivery Button | 🟢 **LIVE (201)** |
| `/api/possession/cases` | `GET` | `PossessionModule` | `Possession` | `/district/possession`, `/pia/possession` | 🟢 **LIVE (200)** |
| `/api/possession/record` | `POST` | `PossessionModule` | `Possession` | Land Handover Form | 🟢 **LIVE (201)** |
| `/api/documents` | `GET` | `DocumentsModule` | `Document` | `/district/documents` | 🟢 **LIVE (200)** |
| `/api/documents/upload` | `POST` | `DocumentsModule` | `Document` (MinIO S3 Bucket) | Document Upload Drawer | 🟢 **LIVE (201)** |
| `/api/audit` | `GET` | `AuditModule` | `AuditEvent` | `/central/audit` | 🟢 **LIVE (200)** |
| `/api/audit/verify-chain` | `GET` | `AuditModule` | `AuditEvent` (SHA-256 Chain) | Audit Verification Badge | 🟢 **LIVE (200)** |
| `/api/notifications` | `GET` | `NotificationsModule` | `Notification` | `/notifications`, Top Bar Notification Bell | 🟢 **LIVE (200)** |
| `/api/users` | `GET` | `UsersModule` | `User`, `Organization` | `/central/users` | 🟢 **LIVE (200)** |
| `/api/integrations/status` | `GET` | `IntegrationsModule` | Integration Gateway Adapters | `/central/integrations` | 🟢 **LIVE (200)** |
| `/api/citizen/summary` | `GET` | `CitizenModule` | Dynamic DB Aggregation | `/citizen/home` | 🟢 **LIVE (200)** |
| `/api/citizen/projects` | `GET` | `CitizenModule` | `Project` (Public View) | `/citizen/projects` | 🟢 **LIVE (200)** |
| `/api/citizen/my-land` | `GET` | `CitizenModule` | `Parcel` (PostGIS) | `/citizen/my-land` | 🟢 **LIVE (200)** |
| `/api/citizen/compensation` | `GET` | `CitizenModule` | `Compensation` | `/citizen/compensation` | 🟢 **LIVE (200)** |
| `/api/citizen/rr` | `GET` | `CitizenModule` | `AffectedFamily` | `/citizen/rr` | 🟢 **LIVE (200)** |
| `/api/citizen/grievance` | `POST` | `CitizenModule` | `Objection` | `/citizen/grievance` | 🟢 **LIVE (201)** |
| `/api/sla/tasks` | `GET` | `SlaModule` | `SLATask` | `/district/sla`, `/state/sla` | 🟢 **LIVE (200)** |
| `/api/sla/check-breaches` | `POST` | `SlaModule` | `Notification`, `SLATask` | Breach Checker Trigger | 🟢 **LIVE (200)** |
| `:8000/api/v1/ocr/extract-document` | `POST` | Python AI Service | FastOCR / Layout Engine | Document Upload Drawer | 🟢 **LIVE (200)** |
| `:8000/api/v1/risk/assess-delay` | `POST` | Python AI Service | Scikit-Learn Random Forest | `/central/risk` | 🟢 **LIVE (200)** |
| `:8000/api/v1/analytics/nlp-query` | `POST` | Python AI Service | Safe SQL NLP Translator | `/central/analytics` | 🟢 **LIVE (200)** |

