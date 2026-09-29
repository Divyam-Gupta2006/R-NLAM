/**
 * Response shapes of the R-NLAM API (see docs/openapi.json for request DTOs).
 * Money fields ending in `Paise` are integer paise; dates are UTC ISO strings.
 */
import type { Blocker } from './client';

export type Role =
  | 'CENTRAL_ADMIN'
  | 'CENTRAL_OFFICER'
  | 'STATE_ADMIN'
  | 'STATE_OFFICER'
  | 'DISTRICT_OFFICER'
  | 'PIA_OFFICER'
  | 'FIELD_OFFICER'
  | 'RR_OFFICER'
  | 'FINANCE_OFFICER'
  | 'GIS_OFFICER'
  | 'CITIZEN';

export type ParcelStage =
  | 'IDENTIFIED'
  | 'PRELIM_NOTIFIED'
  | 'DECLARED'
  | 'AWARDED'
  | 'COMPENSATION_PAID'
  | 'POSSESSION_TAKEN'
  | 'HANDED_OVER'
  | 'LAPSED'
  | 'WITHDRAWN';

export type Paise = number | string;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  stateCode: string | null;
  districtCode: string | null;
  personId: string | null;
}

export interface Persona {
  email: string;
  name: string;
  role: Role;
  designation: string | null;
  jurisdiction: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  sector: string;
  description: string | null;
  stateCode: string;
  stateName: string;
  districtCodes: string[];
  districtNames: string[];
  piaName: string;
  requiredAreaHa: number;
  estimatedCostPaise: Paise;
  status: string;
  isSynthetic: boolean;
  parcelCount?: number;
  parcelsByStage?: Partial<Record<ParcelStage, number>>;
  notifiedAreaHa?: number;
  familiesAffected?: number;
  possessionPct?: number;
}

export interface ProjectDetail extends Project {
  notices: Notice[];
  stages: Array<{ stage: ParcelStage; parcels: number; areaHa: number }>;
  compensation: Array<{ status: string; count: number; amountPaise: Paise }>;
  riskAssessments: Array<{ riskScore: number; riskLevel: string; recommendation: string; model: string }>;
}

export interface Notice {
  id: string;
  projectId: string;
  kind: string;
  referenceNo: string;
  gazetteRef: string | null;
  publishedOn: string;
  _count?: { parcels: number };
  project?: { code: string; name: string };
}

export interface Parcel {
  id: string;
  projectId: string;
  parcelNumber: string;
  surveyNumber: string;
  ulpin: string | null;
  villageId: string;
  villageName: string;
  districtCode: string;
  districtName: string;
  stateCode: string;
  stateName: string;
  totalAreaHa: number;
  landClass: string;
  stage: ParcelStage;
  verificationState: string;
  displayOwnerName: string;
  familiesAffected: number;
  marketRatePaisePerHa: Paise | null;
  distanceFromUrbanKm: number | null;
  geometry: GeoJSON.Geometry | null;
  isSynthetic: boolean;
  project?: { code: string; name: string };
}

export interface Person {
  id: string;
  name: string;
  nameScript: string;
  fatherName: string | null;
  villageCode: string | null;
  source: string;
}

export interface Hearing {
  id: string;
  objectionId: string;
  scheduledAt: string;
  venue: string;
  presidingOfficer: string;
  status: string;
  outcome: string | null;
}

export interface Objection {
  id: string;
  parcelId: string;
  applicant: string;
  category: string;
  description: string;
  filedOn: string;
  status: string;
  hearings: Hearing[];
  parcel?: Pick<Parcel, 'id' | 'parcelNumber' | 'surveyNumber' | 'villageName' | 'districtName' | 'projectId'>;
}

export interface AwardLine {
  key: string;
  label: string;
  amountPaise: Paise;
  formula: string;
  citation?: string;
}

export interface Award {
  id: string;
  awardNumber: string;
  parcelId: string;
  awardDate: string;
  marketValuePaise: Paise;
  multiplier: string;
  assetsValuePaise: Paise;
  solatiumPaise: Paise;
  additionalAmountPaise: Paise;
  totalPaise: Paise;
  status: string;
  calculation: { lines: AwardLine[]; packCode?: string; unverified?: string[]; additionalDays?: number };
  parcel?: Pick<Parcel, 'parcelNumber' | 'surveyNumber' | 'villageName' | 'displayOwnerName' | 'stage'>;
}

export interface PaymentReference {
  id: string;
  utrNumber: string;
  gatewaySource: string;
  amountPaise: Paise;
  status: string;
  transactedAt: string;
}

export interface Compensation {
  id: string;
  projectId: string;
  parcelId: string;
  awardId: string | null;
  beneficiaryName: string;
  sharePct: number;
  amountPaise: Paise;
  status: string;
  paidOn: string | null;
  bankAccountLast4: string | null;
  paymentReferences: PaymentReference[];
  parcel?: Pick<Parcel, 'id' | 'parcelNumber' | 'surveyNumber' | 'villageName' | 'districtName' | 'stage'>;
  award?: { awardNumber: string; awardDate: string } | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CompensationPage extends Paged<Compensation> {
  totalsByStatus: Array<{ status: string; count: number; amountPaise: Paise }>;
  gateway: { name: string; synthetic: boolean };
}

export interface Entitlement {
  id: string;
  code: string;
  name: string;
  category: string;
  amountPaise: Paise | null;
  description: string;
  citation: string | null;
}

export interface RRGrant {
  id: string;
  status: string;
  amountPaise: Paise | null;
  deliveredOn: string | null;
  entitlement: Entitlement;
}

export interface Family {
  id: string;
  headName: string;
  familySize: number;
  villageName: string;
  category: string;
  isVulnerable: boolean;
  isDisplaced: boolean;
}

export interface RRCase {
  id: string;
  projectId: string;
  parcelId: string;
  status: string;
  family: Family;
  grants: RRGrant[];
  parcel?: Pick<Parcel, 'id' | 'parcelNumber' | 'villageName' | 'districtName' | 'stage'>;
}

export interface Possession {
  id: string;
  parcelId: string;
  status: string;
  takenOn: string | null;
  handedOverOn: string | null;
  authority: string | null;
  parcel?: Pick<Parcel, 'id' | 'parcelNumber' | 'surveyNumber' | 'villageName' | 'districtName' | 'totalAreaHa' | 'stage'>;
}

export interface Transition {
  id: string;
  entityType: string;
  entityId: string;
  event: string;
  fromState: string;
  toState: string;
  actorRole: string | null;
  reason: string | null;
  override: boolean;
  createdAt: string;
  actor?: { name: string; designation: string | null } | null;
}

export interface DocumentRecord {
  id: string;
  kind: string;
  title: string;
  fileName: string;
  sha256: string;
  mimeType: string;
  sizeBytes: number;
  referenceNo: string | null;
  issuedOn: string | null;
  isSynthetic: boolean;
  createdAt: string;
  parcel?: { parcelNumber: string; villageName: string } | null;
  project?: { code: string } | null;
}

export interface ParcelDetail extends Parcel {
  project: { id: string; code: string; name: string; sector: string; piaName: string };
  village: { code: string; name: string; nameLocal: string | null };
  holders: Array<{ id: string; sharePct: number; nameAsRecorded: string; source: string; person: Person }>;
  notices: Notice[];
  objections: Objection[];
  awards: Award[];
  compensations: Compensation[];
  rrCases: RRCase[];
  possessions: Possession[];
  documents: DocumentRecord[];
  history: Transition[];
}

export interface LifecycleOption {
  event: string;
  label: string;
  to: string;
  domainOnly: boolean;
  permitted: boolean;
  blockers: Blocker[];
  canOverride: boolean;
}

export interface LifecycleView {
  entityType: string;
  entityId: string;
  state: string;
  options: LifecycleOption[];
  history: Transition[];
}

export interface AuditEntry {
  seq: number;
  id: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  previousState: unknown;
  newState: unknown;
  reason: string | null;
  highlighted: boolean;
  timestamp: string;
  previousHash: string;
  hash: string;
  user?: { name: string; role: string; designation: string | null } | null;
}

export interface AuditVerification {
  valid: boolean;
  checked: number;
  break: null | { kind: 'LINK_BROKEN' | 'CONTENT_ALTERED'; seq: number; id: string };
  headHash: string | null;
  durationMs: number;
  message: string;
}

export interface Kpis {
  projects: number;
  parcels: number;
  notifiedAreaHa: number;
  possessedAreaHa: number;
  possessionPct: number;
  familiesAffected: number;
  rrEntitlementsPending: number;
  openObjections: number;
  compensation: { assessedPaise: Paise; paidPaise: Paise; pendingPaise: Paise; disputedOrHeldPaise: Paise };
  stageFunnel: Array<{ stage: ParcelStage; parcels: number; areaHa: number }>;
}

export interface Breakdown {
  code: string;
  name: string;
  stateCode: string;
  parcels: number;
  areaHa: number;
  familiesAffected: number;
  paidParcels: number;
  possessedParcels: number;
  possessionPct: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface SlaTask {
  id: string;
  taskName: string;
  assignedRole: Role;
  slaDays: number;
  startDate: string;
  targetDate: string;
  completedDate: string | null;
  isBreached: boolean;
  daysRemaining: number | null;
  project: { code: string; name: string; stateCode: string };
}

export interface Jurisdiction {
  id: string;
  level: 'NATION' | 'STATE' | 'DISTRICT' | 'TEHSIL' | 'VILLAGE';
  code: string;
  name: string;
  nameLocal: string | null;
  parentId: string | null;
  stateCode: string;
}

export interface Health {
  status: string;
  database: string;
  postgis: string | null;
  now: string;
  clockPinned: boolean;
  adapters: Record<string, string>;
}

export interface Integration {
  key: string;
  name: string;
  mode: 'SYNTHETIC' | 'LIVE' | 'NOT_CONNECTED';
  note: string;
}

export interface OutboxEvent {
  seq: number;
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  dispatchedAt: string | null;
}

/** s.80 interest owed on one compensation line (paid late, or unpaid after possession). */
export interface CitizenInterest {
  accruedPaise: Paise;
  dailyPaise: Paise;
  possessionOn: string;
  paidOn: string | null;
  ratesBp: [number, number];
}

export interface CitizenMe {
  asOf: string;
  person: { name: string; fatherName: string | null; villageCode: string | null };
  holdings: Array<{
    sharePct: number;
    nameAsRecorded: string;
    parcel: Parcel & {
      project: { id: string; code: string; name: string; sector: string; piaName: string };
      village: { name: string; nameLocal: string | null };
      notices: Notice[];
      awards: Award[];
      compensations: Array<Compensation & { interest: CitizenInterest | null }>;
      objections: Objection[];
      possessions: Possession[];
    };
  }>;
  rrCases: RRCase[];
}

export interface Grievance {
  id: string;
  registrationNo: string;
  channel: string;
  parcelId: string;
  category: string;
  description: string;
  language: string;
  status: 'RECEIVED' | 'UNDER_REVIEW' | 'RESOLVED';
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
}

export interface CitizenDocument {
  id: string;
  kind: string;
  title: string;
  referenceNo: string | null;
  issuedOn: string | null;
  sha256: string;
  sizeBytes: number;
  isSynthetic: boolean;
  parcel: { parcelNumber: string; surveyNumber: string; villageName: string };
  digilocker: { id: string; uri: string; channel: string; issuedAt: string } | null;
}
