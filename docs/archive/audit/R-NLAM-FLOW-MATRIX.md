# R-NLAM Flow Audit Traceability Matrix (Post Mock-to-Live Integration)

## Executive Audit Metrics

- **Audit Date**: 2026-09-15
- **Target System**: R-NLAM v3.0 Production Ready MVP
- **Backend API**: `http://localhost:4000/api` (NestJS 10 / Prisma / PostgreSQL 15 + PostGIS 3.3)
- **AI Service**: `http://127.0.0.1:8000` (Python FastAPI)
- **Frontend App**: `http://localhost:3000` (Next.js 14 App Router - 104 Routes)

---

## 1. Node Status Summary

| Status Category | Symbol | Count BEFORE | Count AFTER | Percentage AFTER |
| :--- | :---: | :---: | :---: | :---: |
| **LIVE / VERIFIED** | 🟢 | 42 | **101** | **92.7%** |
| **PARTIAL / SIMULATED** | 🟡 | 8 | **6** | **5.5%** |
| **MOCKED / HARDCODED** | 🟠 | 59 | **2** (Dev Auth Only) | **1.8%** |
| **BROKEN / MISSING** | 🔴 | 0 | **0** | **0.0%** |
| **BLOCKED** | ⚪ | 0 | **0** | **0.0%** |
| **TOTAL TESTED NODES** | | 109 | **109** | **100.0%** |

- **Flow Functional Coverage (LIVE Only)**: **92.7%**
- **Flow Functional Coverage (LIVE + PARTIAL)**: **98.2%**

---

## 2. Role-by-Role Coverage Matrix

| Role Branch | Total Nodes | 🟢 LIVE AFTER | 🟡 PARTIAL AFTER | 🟠 MOCKED AFTER | Coverage % |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Central Administrator** | 17 | 17 | 0 | 0 | **100.0%** |
| **State Administrator** | 8 | 8 | 0 | 0 | **100.0%** |
| **District / CALA Officer** | 13 | 12 | 1 | 0 | **92.3%** |
| **PIA Officer** | 7 | 6 | 1 | 0 | **85.7%** |
| **Field Officer (PWA)** | 6 | 6 | 0 | 0 | **100.0%** |
| **Finance Officer** | 5 | 4 | 1 | 0 | **80.0%** |
| **R&R Officer** | 5 | 5 | 0 | 0 | **100.0%** |
| **GIS Officer** | 5 | 3 | 2 | 0 | **60.0%** |
| **Citizen / Landowner** | 6 | 6 | 0 | 0 | **100.0%** |
| **Project Workspace Hub**| 13 | 12 | 1 | 0 | **92.3%** |
| **AI Microservice Engine**| 3 | 3 | 0 | 0 | **100.0%** |
| **Workflow / Audit Core**| 6 | 6 | 0 | 0 | **100.0%** |
