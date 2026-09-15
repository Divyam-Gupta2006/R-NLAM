# R-NLAM Database Architecture & Entity Specification

## Database Technologies
- **RDBMS**: PostgreSQL 16
- **Spatial Extension**: PostGIS 3.4
- **ORM**: Prisma ORM (Single Authoritative ORM throughout NestJS Backend)

---

## Core Entities & Relationships

### 1. Identity & RBAC
- `User`: User profile, email, phone, role, organization reference, jurisdiction reference.
- `Role`: Central Admin, State Admin, District Officer, PIA Officer, Field Officer, R&R Officer, Finance Officer, GIS Officer, Citizen.
- `Organization`: Department or Agency metadata (e.g. NHAI, Ministry of Road Transport, CALA District Office).
- `Jurisdiction`: Geographic boundary scoping (State code, District code, Sub-district, Village code).

### 2. Project & Proposal
- `Project`: Unique project identity, code, name, sector (Roads, Railways, Energy, Urban), state, districts, estimated cost, status (`DRAFT`, `SUBMITTED`, `UNDER_SCRUTINY`, `APPROVED`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CLOSED`).
- `Proposal`: PIA proposal submissions, land requirements, alignment GeoJSON, supporting files.

### 3. Configurable Workflow Engine
- `WorkflowTemplate`: Reusable statutory framework templates (e.g. LARR 2013, National Highways Act 1956).
- `WorkflowInstance`: Active state machine attached to a project/case.
- `WorkflowStage`: Current stage (Proposal, Scrutiny, Preliminary Notification, Objections, Hearing, Declaration, Award, Compensation, R&R, Possession).
- `WorkflowAction`: Executed transition actions with user, timestamp, previous state, and new state.

### 4. Spatial Intelligence & Land Parcels
- `Parcel`: Parcel ID, village, Khasra/survey number, total area (ha), acquired area (ha), possessed area (ha), status (`PROPOSED`, `VERIFICATION_PENDING`, `VERIFIED`, `NOTIFIED`, `AWARDED`, `COMPENSATION_PENDING`, `COMPENSATION_PAID`, `DISPUTED`, `POSSESSION_TAKEN`, `HANDED_TO_PIA`), PostGIS Geometry.
- `LandRecordReference`: Authoritative state land record sync data (RoR number, owner names, land class).
- `ParcelVerification`: Field officer verification record with GPS coordinates, geotagged photo URLs, inspection notes, verification state (`UNVERIFIED`, `SYSTEM_MATCHED`, `OFFICER_VERIFIED`, `DISCREPANCY`, `DISPUTED`).

### 5. Objections, Hearings & Statutory Milestones
- `Objection`: Landowner objections, category, applicant details, status (`SUBMITTED`, `UNDER_REVIEW`, `HEARING_SCHEDULED`, `HEARD`, `RESOLVED`, `ESCALATED`, `CLOSED`).
- `Hearing`: Scheduled statutory hearing event, venue, presiding officer, decision details.
- `StatutoryMilestone`: Milestone type, statutory deadline date, threshold warning days, responsible authority, status (`UPCOMING`, `DUE_SOON`, `OVERDUE`, `COMPLETED`).
- `SLATask`: Assigned workflow task SLA tracker, start date, target completion date, actual completion date, delay status, escalation flag.

### 6. Financial & Award Tracking
- `Award`: Award number, valuation, land compensation, structure compensation, solatium, total award amount, approval status, declaration date.
- `Compensation`: Compensation case, landowner beneficiary, payment status (`ASSESSED`, `APPROVED`, `INITIATED`, `PROCESSING`, `PAID`, `FAILED`, `DISPUTED`, `ON_HOLD`).
- `PaymentReference`: Treasury / PFMS transaction reference ID, payment timestamp, disbursement status message.

### 7. Rehabilitation & Resettlement (R&R)
- `AffectedFamily`: Head of family name, Aadhaar/ID hash, family size, displacement status, vulnerability status.
- `Entitlement`: Entitlement type (Housing unit, Employment, One-time financial grant, Resettlement allowance).
- `RRCase`: Case lifecycle (`IDENTIFIED`, `ELIGIBILITY_VERIFIED`, `PLAN_CREATED`, `BENEFIT_ASSIGNED`, `BENEFIT_DELIVERED`, `COMPLETED`).
- `RRDelivery`: Benefit disbursement record, delivery date, verification proof.

### 8. Physical Possession
- `Possession`: Possession case, scheduled date, actual possession date, authority officer, possession document URL, GPS boundary verification, geotagged photos, status (`ELIGIBLE`, `SCHEDULED`, `POSSESSION_TAKEN`, `HANDED_TO_PIA`).

### 9. Document System & Audit Trail
- `Document`: Metadata for uploaded files (MinIO key, file name, MIME type, size, bucket, uploader ID, case/parcel linkage).
- `DocumentVersion`: Versioning details for updated documents.
- `AuditEvent`: Append-oriented tamper-evident record (Actor ID, Role, Action name, Entity type, Entity ID, Timestamp, Previous State, New State, Reason, Request ID, Previous Hash, Hash).
- `DataProvenance`: Source verification tracking for operational values (Value, Source system, Captured at, Verified by, Verification status).

