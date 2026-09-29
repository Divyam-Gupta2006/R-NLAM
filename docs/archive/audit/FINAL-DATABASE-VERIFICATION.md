# R-NLAM Final Database & Persistence Verification Report

**Verification Date**: September 15, 2026  
**Database**: PostgreSQL 15 + PostGIS 3.3 (`rnlam_db` on port 5433)  
**ORM**: Prisma ORM

---

## 1. Database Entity Inventory & Persistence Evidence

| Prisma Entity Model | Table Name in PostgreSQL | Active Record Count | Persistence Method Verified | Downstream Relations Verified |
| :--- | :--- | :---: | :--- | :--- |
| `Project` | `Project` | **8** | `POST /api/projects` | `Proposal`, `WorkflowInstance`, `Parcel` |
| `Proposal` | `Proposal` | **1** | `POST /api/proposals` | `Project` |
| `WorkflowTemplate` | `WorkflowTemplate` | **1** | Seed / `GET /templates` | `WorkflowInstance` |
| `WorkflowInstance` | `WorkflowInstance` | **8** | Auto-creation transaction | `WorkflowAction` |
| `WorkflowAction` | `WorkflowAction` | **2** | `POST /workflow/action` | `User`, `WorkflowInstance` |
| `Parcel` | `Parcel` | **2** | PostGIS Polygon Insertion | `ParcelVerification`, `Award`, `Compensation` |
| `ParcelVerification` | `ParcelVerification` | **2** | `POST /parcels/verify` | Geotagged GPS (`21.1458, 79.0882`) |
| `Award` | `Award` | **1** | `POST /api/awards` | `Compensation` |
| `Compensation` | `Compensation` | **1** | `POST /initiate-payment` | `PaymentReference` (`PAID`) |
| `PaymentReference` | `PaymentReference` | **1** | Payment transaction | UTR Reference string |
| `AffectedFamily` | `AffectedFamily` | **1** | R&R Tracking | `RRCase`, `RRDelivery` |
| `RRCase` | `RRCase` | **1** | `GET /rr/cases` | `RRDelivery` |
| `RRDelivery` | `RRDelivery` | **1** | `POST /rr/delivery` | `RRCase` |
| `Possession` | `Possession` | **1** | `POST /possession/record` | Certificate URL & Handover date |
| `Document` | `Document` | **1** | `POST /documents/upload` | MinIO Key `docs/test-doc.pdf` |
| `AuditEvent` | `AuditEvent` | **2** | `AuditService.log` | SHA-256 Hash Chain (`previousHash + data`) |
| `Notification` | `Notification` | **1** | Statutory SLA Checker | `User` Role Recipient |
| `SLATask` | `SLATask` | **1** | Task Manager | SLA Deadline & Target Date |
| `User` | `User` | **9** | Seed / Directory | `Organization`, `Jurisdiction` |

---

## 2. Downstream Mutation Persistence Proof

1. **PIA Project Creation**: `POST /api/projects` inserts `Project` row with code `TEST-GOLDEN-*` and transactionally instantiates `WorkflowInstance` at stage `Proposal Scrutiny`.
2. **Geotagged Field Verification**: `POST /api/parcels/verify` inserts `ParcelVerification` row with GPS coordinates and sets `Parcel.status = VERIFIED`. Recalculates `Project.acquiredLand` in PostgreSQL.
3. **Atomic Workflow Action**: `POST /api/workflow/action` advances `WorkflowInstance.currentStage` to `SIA Clearance` and logs a SHA-256 hashed `AuditEvent` row.
4. **Compensation Payment**: `POST /api/compensation/initiate-payment` inserts `PaymentReference` row and sets `Compensation.status = PAID`.
5. **Land Possession Handover**: `POST /api/possession/record` inserts `Possession` row with authority and GPS coordinates.

