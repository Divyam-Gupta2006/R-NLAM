import Dexie, { Table } from 'dexie';

export interface OfflineParcel {
  id: string;
  project: string;
  khasraNo: string;
  village: string;
  ownerName: string;
  areaHectares: number;
  landType: string;
  status: 'PENDING_SURVEY' | 'SURVEYED' | 'VERIFIED' | 'SYNCED' | 'CONFLICT';
  lat: number;
  lng: number;
  photos: string[];
  notes?: string;
  boundaryGeoJSON?: string;
  capturedAt?: string;
  surveyorId?: string;
  syncStatus: 'SYNCED' | 'QUEUED' | 'ERROR' | 'LOCAL_ONLY';
  syncError?: string;
}

export interface SyncQueueItem {
  id: string;
  parcelId: string;
  action: 'CREATE' | 'UPDATE' | 'SURVEY_SUBMIT';
  data: any;
  timestamp: string;
  retryCount: number;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  errorLog?: string;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  action: string;
  userRole: string;
  entityType: string;
  entityId: string;
  previousHash: string;
  hash: string;
  details: string;
}

export class RNlamDatabase extends Dexie {
  parcels!: Table<OfflineParcel>;
  syncQueue!: Table<SyncQueueItem>;
  auditLogs!: Table<AuditRecord>;

  constructor() {
    super('RNlamOfflineDB');
    // @ts-ignore
    this.version(1).stores({
      parcels: 'id, project, khasraNo, status, syncStatus',
      syncQueue: 'id, parcelId, timestamp, status',
      auditLogs: 'id, timestamp, entityId, hash'
    });
  }
}

export const db = new RNlamDatabase();
