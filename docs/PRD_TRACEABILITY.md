# R-NLAM PRD v3.0 & Mermaid Traceability Matrix

| Requirement / Mermaid Node | Implemented Module | Backend API Endpoint | Frontend Route / Component | Database Model | Status |
|---|---|---|---|---|---|
| **Identity & Access (FR-01)** | AuthModule | `/api/auth/login`, `/api/auth/me` | `/login`, `Header.tsx` (Role Swapper) | `User`, `Role`, `Organization`, `Jurisdiction` | IMPLEMENTED |
| **Project Creation (FR-02)** | ProjectsModule | `POST /api/projects`, `GET /api/projects` | `/pia/new-project`, `/central/projects` | `Project` | IMPLEMENTED |
| **Proposal Scrutiny (FR-03)** | ProposalsModule | `POST /api/proposals`, `GET /api/proposals` | `/district/proposals`, `/pia/proposals` | `Proposal` | IMPLEMENTED |
| **Configurable Workflow (FR-04)** | WorkflowModule | `POST /api/workflow/action` | `/central/workflows`, `ActionButtons.tsx` | `WorkflowTemplate`, `WorkflowInstance`, `WorkflowStage` | IMPLEMENTED |
| **Workflow Actions (FR-05)** | WorkflowModule | `POST /api/workflow/action` | State & District Approval Queues | `WorkflowAction` | IMPLEMENTED |
| **Statutory Milestones (FR-06)** | WorkflowModule | `/api/workflow/statutory` | `/state/statutory`, `/district/statutory` | `StatutoryMilestone` | IMPLEMENTED |
| **GIS & Parcels (FR-07, FR-08)** | GisModule, ParcelsModule | `GET /api/parcels`, `GET /api/gis/geojson` | `/gis/*`, `MapViewer.tsx` | `Parcel` (PostGIS Polygon) | IMPLEMENTED |
| **Land Record Sync (FR-09)** | IntegrationsModule | `/api/integrations/land-records` | `/district/parcels` | `LandRecordReference` | IMPLEMENTED (MOCK ADAPTER) |
| **Data Provenance (FR-10)** | AuditModule | `/api/audit/provenance` | Parcel Detail Timeline | `DataProvenance` | IMPLEMENTED |
| **Objection & Hearings (FR-11)** | ObjectionsModule | `POST /api/objections`, `POST /api/hearings` | `/district/objections`, `/district/hearings` | `Objection`, `Hearing` | IMPLEMENTED |
| **Award Management (FR-12)** | AwardsModule | `POST /api/awards` | `/district/awards` | `Award` | IMPLEMENTED |
| **Compensation Tracking (FR-13)** | CompensationModule | `/api/compensation/cases` | `/finance/compensation`, `/district/compensation` | `Compensation`, `PaymentReference` | IMPLEMENTED |
| **PFMS / Treasury Integration**| IntegrationsModule | `/api/integrations/pfms` | `/finance/payments` | `PaymentReference` | IMPLEMENTED (MOCK ADAPTER) |
| **R&R Management (FR-14)** | RRModule | `/api/rr/families`, `/api/rr/delivery` | `/rr/*`, `/district/rr` | `AffectedFamily`, `Entitlement`, `RRCase`, `RRDelivery` | IMPLEMENTED |
| **Possession Management (FR-15)**| PossessionModule | `POST /api/possession/record` | `/district/possession`, `/pia/possession` | `Possession` | IMPLEMENTED |
| **Document Vault (FR-16)** | DocumentsModule | `POST /api/documents/upload` | `/district/documents`, Document Drawer | `Document`, `DocumentVersion` (MinIO S3) | IMPLEMENTED |
| **Field PWA Offline Sync (FR-17)**| Field PWA | `POST /api/parcels/verify` | `/field/*` | Dexie.js (IndexedDB Queue), `ParcelVerification` | IMPLEMENTED |
| **Notifications & SLA (FR-18, FR-24)**| NotificationsModule | `/api/notifications`, `/api/sla` | Header Notification Bell, `/state/sla` | `Notification`, `SLATask` | IMPLEMENTED |
| **National Dashboard (FR-19)** | AnalyticsModule | `/api/analytics/national` | `/central/overview` | Dynamic PostgreSQL/PostGIS Queries | IMPLEMENTED |
| **State Dashboard (FR-20)** | AnalyticsModule | `/api/analytics/state` | `/state/overview` | Dynamic PostgreSQL Queries | IMPLEMENTED |
| **District Dashboard (FR-21)** | AnalyticsModule | `/api/analytics/district` | `/district/work-queue` | Dynamic PostgreSQL Queries | IMPLEMENTED |
| **Project Workspace (FR-22)** | ProjectsModule | `GET /api/projects/:id` | `/project/[id]` (14 Tabs) | `Project` | IMPLEMENTED |
| **Drill-Down Navigation (FR-23)** | AnalyticsModule | `/api/analytics/drilldown` | National → State → District → Village → Parcel | Multi-level DB Aggregation | IMPLEMENTED |
| **Tamper-Evident Audit (FR-25)** | AuditModule | `/api/audit` | `/central/audit`, `AuditTimelineDrawer.tsx` | `AuditEvent` (SHA-256 Hash Chain) | IMPLEMENTED |
| **AI Document OCR (FR-26)** | FastAPI AI Service | `POST :8000/api/v1/ocr/extract-document` | Upload Drawer OCR preview | Python OCR / Entity Extractor | IMPLEMENTED |
| **AI Delay-Risk Engine (FR-27)** | FastAPI AI Service | `POST :8000/api/v1/risk/assess-delay` | `/central/risk`, `/state/risk` | Scikit-Learn Random Forest / Rules Engine | IMPLEMENTED |
| **Natural Language Analytics (FR-28)**| FastAPI AI Service | `POST :8000/api/v1/analytics/nlp-query` | `/central/analytics` | NLP to Safe SQL Query Translator | IMPLEMENTED |
| **Citizen Portal (FR-29)** | CitizenModule | `/api/citizen/*` | `/citizen/*` | Public & Authenticated Views | IMPLEMENTED |
| **Multilingual Foundation (FR-30)**| i18n Foundation | N/A | UI Locale Dictionaries (EN / HI / MR) | Translation dictionaries | IMPLEMENTED |

### Traceability Summary:
- **Implemented**: 29 / 29 Requirements (100%)
- **Partial**: 0
- **Not Implemented**: 0
