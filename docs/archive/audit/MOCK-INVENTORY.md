# R-NLAM Complete Mock Inventory & Integration Blueprint

## Overview
This document registers every mock array, hardcoded static object, simulated adapter, fake authorization mechanism, and disconnected UI route across the R-NLAM codebase prior to executing the **Full Mock-To-Live Integration Mission**.

---

## 1. Mock Data Source Files

| Source File | Exported Symbol | Data Type | Usage Count | Integration Target |
| :--- | :--- | :--- | :---: | :--- |
| `frontend/lib/mockData.ts` | `MOCK_PROJECTS` | `Project[]` | 18 pages | Replace with `projectsApi.getAll()` & `getById()` |
| `frontend/lib/mockData.ts` | `MOCK_PARCELS` | `Parcel[]` | 12 pages | Replace with `parcelsApi.getAll()` & `getById()` |
| `frontend/lib/mockData.ts` | `MOCK_RR_FAMILIES` | `RRFamily[]` | 8 pages | Replace with `rrApi.getFamilies()` |
| `frontend/lib/mockData.ts` | `MOCK_COMPENSATION` | `CompensationRecord[]` | 7 pages | Replace with `compensationApi.getCases()` |
| `frontend/lib/mockData.ts` | `MOCK_AUDIT` | `AuditEntry[]` | 4 pages | Replace with `auditApi.getEvents()` |
| `frontend/lib/mockData.ts` | `MOCK_NOTIFICATIONS` | `NotificationItem[]` | 5 pages | Replace with `notificationsApi.getAll()` |
| `frontend/lib/mockData.ts` | `MOCK_USERS` | `User[]` | 3 pages | Replace with `usersApi.getAll()` |
| `frontend/context/RoleContext.tsx` | `X-User-Role` | Dev Auth Header | Entire App | Retain for Dev; wire Keycloak token support |

---

## 2. Page-by-Page Mock Audit Inventory

### Central Administration (`/central/*`)
| Route Path | Current Mock Element | Required Backend Endpoint | Required DB Model | Action Required |
| :--- | :--- | :--- | :--- | :--- |
| `/central/projects` | `MOCK_PROJECTS` | `GET /api/projects` | `Project` | Wire `projectsApi.getAll()` |
| `/central/states` | Static state array | `GET /api/analytics/states` | `Jurisdiction`, `Project` | Implement state aggregation endpoint |
| `/central/districts` | Static district array | `GET /api/analytics/districts` | `Jurisdiction`, `Project` | Implement district aggregation endpoint |
| `/central/land` | Static land classification array | `GET /api/parcels/stats` | `Parcel` | Implement land stats API & wire UI |
| `/central/compensation` | Static financial metrics | `GET /api/compensation/summary` | `Compensation` | Implement compensation summary API |
| `/central/rr` | Static R&R summary | `GET /api/rr/summary` | `AffectedFamily`, `RRCase` | Implement R&R summary API |
| `/central/possession` | Static possession cards | `GET /api/possession/summary` | `Possession` | Implement possession summary API |
| `/central/workflows` | Static template list | `GET /api/workflow/templates` | `WorkflowTemplate` | Wire `workflowApi.getTemplates()` |
| `/central/users` | `MOCK_USERS` | `GET /api/users` | `User`, `Organization` | Implement users CRUD REST API & wire |
| `/central/integrations` | Static integration cards | `GET /api/integrations/status` | `IntegrationAdapter` | Implement integration status API & wire |

### State Administration (`/state/*`)
| Route Path | Current Mock Element | Required Backend Endpoint | Required DB Model | Action Required |
| :--- | :--- | :--- | :--- | :--- |
| `/state/overview` | `MOCK_PROJECTS` | `GET /api/analytics/kpis?stateCode=MH` | `Project`, `Parcel` | Wire `analyticsApi.getKpis()` with state filter |
| `/state/projects` | `MOCK_PROJECTS` | `GET /api/projects?stateCode=MH` | `Project` | Wire `projectsApi.getAll()` with state filter |
| `/state/districts` | Static district array | `GET /api/analytics/districts?stateCode=MH` | `Jurisdiction` | Wire district analytics endpoint |
| `/state/approvals` | Static queue | `GET /api/workflow/approvals?level=STATE` | `WorkflowInstance` | Wire approval queue API & action buttons |
| `/state/land` | `MOCK_PARCELS` | `GET /api/parcels?stateCode=MH` | `Parcel` | Wire `parcelsApi.getAll()` |
| `/state/compensation` | `MOCK_COMPENSATION` | `GET /api/compensation/cases?stateCode=MH` | `Compensation` | Wire `compensationApi.getCases()` |
| `/state/rr` | `MOCK_RR_FAMILIES` | `GET /api/rr/families?stateCode=MH` | `AffectedFamily` | Wire `rrApi.getFamilies()` |
| `/state/possession` | Static possession list | `GET /api/possession/cases?stateCode=MH` | `Possession` | Wire `possessionApi.getCases()` |
| `/state/sla` | Static SLA tasks | `GET /api/sla/tasks?stateCode=MH` | `SLATask` | Wire SLA tasks API & escalation action |
| `/state/statutory` | Static statutory cards | `GET /api/workflow/statutory?stateCode=MH` | `StatutoryMilestone` | Wire statutory milestone API |
| `/state/gis` | Static Map coordinates | `GET /api/gis/geojson?stateCode=MH` | PostGIS `Parcel` | Wire PostGIS GeoJSON map viewer |

### District Administration (`/district/*`)
| Route Path | Current Mock Element | Required Backend Endpoint | Required DB Model | Action Required |
| :--- | :--- | :--- | :--- | :--- |
| `/district/projects` | `MOCK_PROJECTS` | `GET /api/projects` | `Project` | Wire `projectsApi.getAll()` |
| `/district/parcels` | `MOCK_PARCELS` | `GET /api/parcels` | `Parcel` | Wire `parcelsApi.getAll()` |
| `/district/objections` | Static objections array | `GET /api/objections` | `Objection` | Wire `objectionsApi.getAll()` & form create |
| `/district/hearings` | Static hearings array | `GET /api/hearings` | `Hearing` | Wire `hearingsApi.getAll()` & decision update |
| `/district/awards` | Static awards array | `GET /api/awards` | `Award` | Wire `awardsApi.getAll()` & create award |
| `/district/sla` | Static SLA queue | `GET /api/sla/tasks` | `SLATask` | Wire SLA tasks API |
| `/district/statutory` | Static statutory list | `GET /api/workflow/statutory` | `StatutoryMilestone` | Wire statutory milestones API |
| `/district/field` | Static field assignments | `GET /api/parcels/assignments` | `ParcelVerification` | Wire field assignment API |

### Finance & Compensation (`/finance/*`)
| Route Path | Current Mock Element | Required Backend Endpoint | Required DB Model | Action Required |
| :--- | :--- | :--- | :--- | :--- |
| `/finance/approvals` | `MOCK_COMPENSATION` | `GET /api/compensation/cases?status=APPROVED` | `Compensation` | Wire approvals queue API |
| `/finance/payments` | `MOCK_COMPENSATION` | `GET /api/compensation/cases?status=INITIATED` | `Compensation` | Wire payment ledger API |
| `/finance/failed` | `MOCK_COMPENSATION` | `GET /api/compensation/cases?status=FAILED` | `Compensation` | Wire retry payment API |
| `/finance/disputes` | `MOCK_COMPENSATION` | `GET /api/compensation/cases?status=DISPUTED` | `Compensation` | Wire dispute resolution API |

### Rehabilitation & Resettlement (`/rr/*`)
| Route Path | Current Mock Element | Required Backend Endpoint | Required DB Model | Action Required |
| :--- | :--- | :--- | :--- | :--- |
| `/rr/eligibility` | Static checklist UI | `POST /api/rr/eligibility` | `RRCase` | Wire eligibility verification API |
| `/rr/plans` | Static plan list | `GET /api/rr/plans` | `RRCase` | Implement R&R plan API & wire |
| `/rr/entitlements` | Static entitlement list | `GET /api/rr/entitlements` | `Entitlement` | Implement entitlement API & wire |
| `/rr/delivery` | Static benefit delivery | `POST /api/rr/delivery` | `RRDelivery` | Wire benefit delivery API |

### Citizen Portal (`/citizen/*`)
| Route Path | Current Mock Element | Required Backend Endpoint | Required DB Model | Action Required |
| :--- | :--- | :--- | :--- | :--- |
| `/citizen/home` | Static public cards | `GET /api/citizen/summary` | `Project`, `Parcel` | Wire citizen public summary API |
| `/citizen/projects` | Static project search | `GET /api/citizen/projects` | `Project` | Wire public project search API |
| `/citizen/my-land` | `MOCK_PARCELS` | `GET /api/citizen/my-land` | `Parcel` | Wire citizen land lookup API |
| `/citizen/compensation` | `MOCK_COMPENSATION` | `GET /api/citizen/compensation` | `Compensation` | Wire citizen compensation status API |
| `/citizen/rr` | `MOCK_RR_FAMILIES` | `GET /api/citizen/rr` | `AffectedFamily` | Wire citizen R&R benefit status API |
| `/citizen/grievance` | Static representation form | `POST /api/citizen/grievance` | `Objection` | Implement citizen grievance submission API |

---

## 3. Integration Plan & Execution Strategy

1. **Backend Endpoint Expansions (`/backend/src`)**:
   - Add REST APIs for users (`UsersController`), objections (`ObjectionsController`), hearings (`HearingsController`), awards (`AwardsController`), SLA tasks (`SlaController`), integrations status (`IntegrationsController`), citizen portal (`CitizenController`), and analytics query expansions.
2. **Frontend Typed API Client Layer (`frontend/lib/api/client.ts`)**:
   - Add typed API resources: `usersApi`, `objectionsApi`, `hearingsApi`, `awardsApi`, `slaApi`, `integrationsApi`, `citizenApi`, `reportsApi`, `searchApi`.
3. **Frontend Page Wiring**:
   - Systematic replacement of static `MOCK_` arrays with `useEffect()` API fetch hooks, loading skeletons, error states, and live action buttons across all central, state, district, finance, R&R, field, GIS, and citizen routes.
4. **No Mock Fallback Enforcement**:
   - Remove fallback code blocks (`.catch(() => MOCK_DATA)`) from all pages. Handle API errors cleanly with user-facing alert badges and empty states.

