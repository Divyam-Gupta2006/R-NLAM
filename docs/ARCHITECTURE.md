# R-NLAM System Architecture Document

## Executive Summary
R-NLAM (Real-Time National Land Acquisition & Management System) is a national-scale digital orchestration, spatial intelligence, and decision-support layer designed to coordinate, monitor, and provide operational transparency across the complete land acquisition lifecycle.

Operating Principle:
> **Track the Land. Track the Case. Track the Money. Track the People. Track the Time.**

---

## Technical Stack Overview

| Layer | Component | Technology |
|---|---|---|
| **Frontend Platform** | Framework | Next.js 14 (App Router) + React |
| | UI & Styling | Tailwind CSS + Lucide Icons + Recharts |
| | GIS Viewer | Leaflet / MapLibre |
| | Field PWA | PWA + Dexie.js (IndexedDB) for Offline-first operations |
| **Backend API** | Framework | NestJS Enterprise Application (TypeScript) |
| | ORM | Prisma ORM (Single Authoritative ORM) |
| | Database | PostgreSQL 16 + PostGIS 3.4 Extensions |
| | Cache & Queues | Redis 7 |
| | Object Storage | MinIO S3-Compatible Object Store |
| | Auth Server | Keycloak 23 (OAuth2 / OIDC, RBAC) |
| **AI Microservices** | Framework | Python 3.13 + FastAPI |
| | Document AI | Tesseract OCR + Layout Analysis + Entity Normalizer |
| | Risk Engine | Scikit-learn / XGBoost Delay Risk Estimator |
| | Analytics Engine | Natural Language to SQL/PostGIS Translator |

---

## Component Topology

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT LAYER                                      |
|                                                                                   |
|  +------------------------+  +-----------------------+  +----------------------+  |
|  |   Government Portal    |  |       Field PWA       |  |    Citizen Portal    |  |
|  |  (Next.js App Router)  |  |  (Dexie.js IndexedDB) |  |   (Public / OTP)     |  |
|  +-----------+------------+  +-----------+-----------+  +----------+-----------+  |
+--------------|---------------------------|-------------------------|--------------+
               |                           |                         |
               +---------------------------+-------------------------+
                                           | HTTP REST / JSON
                                           v
+-----------------------------------------------------------------------------------+
|                              INTEGRATION GATEWAY                                  |
|                             NestJS API Server (4000)                              |
|                                                                                   |
|  +-----------------+  +------------------+  +-----------------+  +-------------+  |
|  |  Auth / RBAC    |  | Workflow Engine  |  | Parcel / PostGIS|  |  Audit Log  |  |
|  +-----------------+  +------------------+  +-----------------+  +-------------+  |
|  +-----------------+  +------------------+  +-----------------+  +-------------+  |
|  | Compensation    |  | R&R Management   |  | Possession      |  | Analytics   |  |
|  +-----------------+  +------------------+  +-----------------+  +-------------+  |
+-------+--------------------+-------------------+------------------+---------------+
        |                    |                   |                  |
        v                    v                   v                  v
+---------------+    +---------------+   +---------------+  +---------------+
| PostgreSQL +  |    |     Redis     |   |     MinIO     |  | Python FastAPI|
|    PostGIS    |    |  Cache/Queues |   | Object Store  |  | AI Service    |
+---------------+    +---------------+   +---------------+  +---------------+
```

---

## 5D Operational Framework

1. **LAND**: Tracks Parcel ID, Khasra/survey number, PostGIS polygon geometry, area, ownership references, verification status, acquisition status, possession status, and spatial conflicts.
2. **CASE**: Tracks statutory workflow stage, responsible authority, pending actions, uploaded documents, objections, hearings, decisions, and audit history.
3. **MONEY**: Tracks valuation, award declaration, compensation assessment, state approval, payment initiation, treasury processing, failed disbursements, disputes, and pending balances.
4. **PEOPLE**: Tracks affected landowners, affected families, eligibility verification, R&R entitlements, housing, employment benefits, and delivery status.
5. **TIME**: Tracks statutory deadlines, SLA timelines, elapsed time, actual completion, delays, escalations, critical path milestones, and project delay risk scores.

---

## Security & Governance Model

- **Privacy-by-Design**: Controls aligned to applicable DPDP requirements, government security policies, and the deployment environment.
- **Append-Oriented Tamper-Evident Audit**: Every state-changing operation writes an audit event containing `previousHash` and cryptographic `hash` (Hash Chaining).
- **Human-Controlled AI**: AI assists with OCR extraction, risk scoring, and natural language analytics, but authorized officers make all operational decisions.

