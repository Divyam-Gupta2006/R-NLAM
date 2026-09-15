# R-NLAM Setup, Deployment & Execution Guide

## Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: v20+
- **npm**: 10+
- **Python**: 3.10+
- **Docker & Docker Compose**: Installed and running

---

### 2. Infrastructure Setup (PostgreSQL/PostGIS, Redis, MinIO, Keycloak)

Navigate to the repository root and start infrastructure containers:

```bash
cd infrastructure
docker compose up -d
```

Verify running containers:
- PostgreSQL / PostGIS: `localhost:5432`
- Redis: `localhost:6379`
- MinIO Storage Console: `http://localhost:9001` (User: `minioadmin` / Pass: `minioadminpassword`)
- Keycloak Auth Console: `http://localhost:8080` (User: `admin` / Pass: `adminpassword`)

---

### 3. Backend Setup (NestJS + Prisma)

```bash
cd backend
npm install
npx prisma db push
npm run seed
npm run start:dev
```
Backend API runs on `http://localhost:4000/api`.

---

### 4. AI Microservice Setup (FastAPI)

```bash
cd ai-service
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000 --reload
```
FastAPI AI service runs on `http://localhost:8000`.

---

### 5. Frontend Setup (Next.js App Router)

```bash
cd frontend
npm install
npm run dev
```
Frontend web application runs on `http://localhost:3000`.

---

## Accessing Roles in Demo Mode

The header bar provides a **Role Switcher** dropdown to seamlessly switch contexts for testing:
1. **Central Admin**: Access National View, State comparisons, Risk Engine, Audit Log.
2. **State Admin**: Access State Overview, Approval Queue, SLA & Statutory milestone tracking.
3. **District Officer**: Access Work Queue, Scrutiny, Hearings, Award declarations.
4. **PIA Officer**: Access Project Creation, Alignment Upload, Proposal Submission.
5. **Field Officer**: Access Field PWA, Offline Parcel Verification, GPS & Geotagged Photo Upload, Sync Queue.
6. **R&R Officer**: Access Affected Family List, Eligibility Verification, Benefit Delivery.
7. **Finance Officer**: Access Compensation Payment Queue, Treasury Disbursement status.
8. **GIS Officer**: Access Spatial Layer Management, GeoJSON/KML Import/Export, Gap Analysis.
9. **Citizen / Landowner**: Access Citizen Transparency Portal, Parcel status, Grievance tracking.

