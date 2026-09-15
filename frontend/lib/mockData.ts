export interface Project {
  id: string;
  name: string;
  code: string;
  type: string;
  state: string;
  district: string;
  pia: string;
  totalParcels: number;
  acquiredParcels: number;
  totalArea: number; // in Hectares
  budget: number; // in INR
  disbursed: number; // in INR
  rrFamilies: number;
  rrRehabilitated: number;
  stage: 'SECTION_4' | 'SECTION_11' | 'SECTION_19' | 'SECTION_23_AWARD' | 'POSSESSION_TAKEN';
  slaStatus: 'ON_TRACK' | 'AT_RISK' | 'BREACHED';
  delayRiskScore: number; // 0-100
  possessionPercentage: number;
  createdAt: string;
  targetCompletion: string;
  geometry: {
    lat: number;
    lng: number;
    zoom: number;
  };
}

export interface Parcel {
  id: string;
  khasraNo: string;
  projectId: string;
  projectName: string;
  state: string;
  district: string;
  taluka: string;
  village: string;
  ownerName: string;
  ownerContact: string;
  landType: 'Agriculture' | 'Commercial' | 'Residential' | 'Barren' | 'Forest';
  areaHectares: number;
  valuationAmount: number;
  compensationStatus: 'NOT_CALCULATED' | 'CALCULATED' | 'APPROVED' | 'DISBURSED' | 'DISPUTED';
  possessionStatus: 'PENDING_SURVEY' | 'SURVEYED' | 'NOTIFIED' | 'ACQUIRED' | 'POSSESSION_HANDOVER';
  slaDaysRemaining: number;
  riskCategory: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  coordinates: [number, number][];
  fieldSurveyStatus: 'UNSURVEYED' | 'OFFLINE_CAPTURED' | 'VERIFIED' | 'REJECTED';
  objectionsCount: number;
}

export interface RRFamily {
  id: string;
  familyHead: string;
  khasraNo: string;
  projectId: string;
  projectName: string;
  district: string;
  category: 'SC' | 'ST' | 'OBC' | 'GENERAL' | 'SF/MF';
  displacementType: 'PHYSICAL' | 'ECONOMIC' | 'BOTH';
  housingEntitlement: string;
  cashGrant: number;
  employmentBenefit: string;
  status: 'ELIGIBILITY_VERIFIED' | 'PLAN_APPROVED' | 'ENTITLEMENT_SANCTIONED' | 'DISBURSED' | 'REHABILITATED';
  disbursementStatus: 'PENDING' | 'SUCCESS' | 'FAILED';
  verificationDoc: string;
}

export interface CompensationRecord {
  id: string;
  parcelId: string;
  khasraNo: string;
  projectName: string;
  landownerName: string;
  bankAccountNo: string;
  ifscCode: string;
  calculatedAmount: number;
  solatiumAmount: number;
  totalCompensation: number;
  status: 'VALUATION_PENDING' | 'DISTRICT_APPROVED' | 'STATE_APPROVED' | 'PAYMENT_INITIATED' | 'PAID' | 'DISPUTED' | 'PAYMENT_FAILED';
  utrNumber?: string;
  paymentDate?: string;
  pfmsStatus: 'SUCCESS' | 'PENDING' | 'REJECTED';
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  entityType: string;
  entityId: string;
  previousHash: string;
  hash: string;
  details: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'SLA_ALERT' | 'APPROVAL_REQ' | 'PAYMENT_FAILED' | 'SURVEY_CAPTURED' | 'OBJECTION_FILED';
  timestamp: string;
  read: boolean;
  link?: string;
}

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'PRJ-2026-001',
    name: 'Mumbai-Pune Expressway Expansion (Phase II)',
    code: 'MPE-PH2',
    type: 'Highway Infrastructure',
    state: 'Maharashtra',
    district: 'Pune',
    pia: 'National Highways Authority of India (NHAI)',
    totalParcels: 340,
    acquiredParcels: 265,
    totalArea: 142.5,
    budget: 4500000000,
    disbursed: 3200000000,
    rrFamilies: 180,
    rrRehabilitated: 145,
    stage: 'SECTION_19',
    slaStatus: 'ON_TRACK',
    delayRiskScore: 18,
    possessionPercentage: 78,
    createdAt: '2025-04-10',
    targetCompletion: '2026-11-30',
    geometry: { lat: 18.5204, lng: 73.8567, zoom: 11 }
  },
  {
    id: 'PRJ-2026-002',
    name: 'Delhi-Varanasi High-Speed Rail Corridor',
    code: 'DV-HSR',
    type: 'Rail Corridor',
    state: 'Uttar Pradesh',
    district: 'Gautam Buddha Nagar',
    pia: 'National High Speed Rail Corporation Ltd (NHSRCL)',
    totalParcels: 820,
    acquiredParcels: 410,
    totalArea: 380.0,
    budget: 12500000000,
    disbursed: 6100000000,
    rrFamilies: 420,
    rrRehabilitated: 210,
    stage: 'SECTION_11',
    slaStatus: 'AT_RISK',
    delayRiskScore: 62,
    possessionPercentage: 50,
    createdAt: '2025-01-15',
    targetCompletion: '2027-06-30',
    geometry: { lat: 28.5355, lng: 77.391, zoom: 10 }
  },
  {
    id: 'PRJ-2026-003',
    name: 'Dedicated Freight Corridor (Western Sector - Unit 4)',
    code: 'DFC-WEST',
    type: 'Rail Freight',
    state: 'Gujarat',
    district: 'Vadodara',
    pia: 'Dedicated Freight Corridor Corporation of India (DFCCIL)',
    totalParcels: 195,
    acquiredParcels: 180,
    totalArea: 95.2,
    budget: 2800000000,
    disbursed: 2600000000,
    rrFamilies: 94,
    rrRehabilitated: 90,
    stage: 'SECTION_23_AWARD',
    slaStatus: 'ON_TRACK',
    delayRiskScore: 12,
    possessionPercentage: 92,
    createdAt: '2024-09-01',
    targetCompletion: '2026-05-15',
    geometry: { lat: 22.3072, lng: 73.1812, zoom: 12 }
  },
  {
    id: 'PRJ-2026-004',
    name: 'Mahanadi River Basin Industrial Corridor',
    code: 'MRB-IND',
    type: 'Industrial Park',
    state: 'Odisha',
    district: 'Cuttack',
    pia: 'Odisha Industrial Infrastructure Development Corporation (IDCO)',
    totalParcels: 510,
    acquiredParcels: 190,
    totalArea: 420.8,
    budget: 8900000000,
    disbursed: 2100000000,
    rrFamilies: 310,
    rrRehabilitated: 85,
    stage: 'SECTION_4',
    slaStatus: 'BREACHED',
    delayRiskScore: 84,
    possessionPercentage: 37,
    createdAt: '2024-11-20',
    targetCompletion: '2027-12-31',
    geometry: { lat: 20.4625, lng: 85.8828, zoom: 11 }
  }
];

export const MOCK_PARCELS: Parcel[] = [
  {
    id: 'PCL-1001',
    khasraNo: '142/A',
    projectId: 'PRJ-2026-001',
    projectName: 'Mumbai-Pune Expressway Expansion',
    state: 'Maharashtra',
    district: 'Pune',
    taluka: 'Haveli',
    village: 'Lonikand',
    ownerName: 'Ramesh Balaji Patil',
    ownerContact: '+91 98220 12345',
    landType: 'Agriculture',
    areaHectares: 1.45,
    valuationAmount: 8500000,
    compensationStatus: 'APPROVED',
    possessionStatus: 'NOTIFIED',
    slaDaysRemaining: 14,
    riskCategory: 'LOW',
    coordinates: [[18.525, 73.858], [18.527, 73.860], [18.526, 73.863], [18.523, 73.861]],
    fieldSurveyStatus: 'VERIFIED',
    objectionsCount: 0
  },
  {
    id: 'PCL-1002',
    khasraNo: '142/B',
    projectId: 'PRJ-2026-001',
    projectName: 'Mumbai-Pune Expressway Expansion',
    state: 'Maharashtra',
    district: 'Pune',
    taluka: 'Haveli',
    village: 'Lonikand',
    ownerName: 'Suresh Vishnu Shinde',
    ownerContact: '+91 94223 98765',
    landType: 'Agriculture',
    areaHectares: 2.10,
    valuationAmount: 12400000,
    compensationStatus: 'DISBURSED',
    possessionStatus: 'POSSESSION_HANDOVER',
    slaDaysRemaining: 0,
    riskCategory: 'LOW',
    coordinates: [[18.528, 73.861], [18.530, 73.864], [18.529, 73.867], [18.526, 73.863]],
    fieldSurveyStatus: 'VERIFIED',
    objectionsCount: 0
  },
  {
    id: 'PCL-1003',
    khasraNo: '88/4',
    projectId: 'PRJ-2026-002',
    projectName: 'Delhi-Varanasi High-Speed Rail Corridor',
    state: 'Uttar Pradesh',
    district: 'Gautam Buddha Nagar',
    taluka: 'Dadri',
    village: 'Bishnuli',
    ownerName: 'Mahesh Pal Sharma',
    ownerContact: '+91 98110 54321',
    landType: 'Residential',
    areaHectares: 0.75,
    valuationAmount: 18500000,
    compensationStatus: 'DISPUTED',
    possessionStatus: 'SURVEYED',
    slaDaysRemaining: -5,
    riskCategory: 'CRITICAL',
    coordinates: [[28.538, 77.393], [28.541, 77.396], [28.539, 77.399], [28.536, 77.395]],
    fieldSurveyStatus: 'OFFLINE_CAPTURED',
    objectionsCount: 3
  },
  {
    id: 'PCL-1004',
    khasraNo: '92/1',
    projectId: 'PRJ-2026-003',
    projectName: 'Dedicated Freight Corridor',
    state: 'Gujarat',
    district: 'Vadodara',
    taluka: 'Padra',
    village: 'Dabhasa',
    ownerName: 'Vikramsinh Gohil',
    ownerContact: '+91 99099 11223',
    landType: 'Commercial',
    areaHectares: 3.50,
    valuationAmount: 31000000,
    compensationStatus: 'CALCULATED',
    possessionStatus: 'ACQUIRED',
    slaDaysRemaining: 22,
    riskCategory: 'MEDIUM',
    coordinates: [[22.309, 73.183], [22.312, 73.186], [22.310, 73.189], [22.307, 73.185]],
    fieldSurveyStatus: 'VERIFIED',
    objectionsCount: 1
  }
];

export const MOCK_RR_FAMILIES: RRFamily[] = [
  {
    id: 'RR-801',
    familyHead: 'Dnyaneshwar Mahadev Pawar',
    khasraNo: '142/A',
    projectId: 'PRJ-2026-001',
    projectName: 'Mumbai-Pune Expressway Expansion',
    district: 'Pune',
    category: 'OBC',
    displacementType: 'BOTH',
    housingEntitlement: 'Plot 42, Sector 5 R&R Colony, Lonikand',
    cashGrant: 500000,
    employmentBenefit: 'One-time annuity stipend ₹5,000/month for 20 yrs',
    status: 'ENTITLEMENT_SANCTIONED',
    disbursementStatus: 'SUCCESS',
    verificationDoc: 'RRFAM-PCL-1001-A.pdf'
  },
  {
    id: 'RR-802',
    familyHead: 'Ramdas Kishen Jadhav',
    khasraNo: '88/4',
    projectId: 'PRJ-2026-002',
    projectName: 'Delhi-Varanasi High-Speed Rail',
    district: 'Gautam Buddha Nagar',
    category: 'SC',
    displacementType: 'PHYSICAL',
    housingEntitlement: 'Flats 201-202, Sector 12 PM Awas (Urban)',
    cashGrant: 750000,
    employmentBenefit: 'Skill training + Job priority in Express Freight',
    status: 'ELIGIBILITY_VERIFIED',
    disbursementStatus: 'PENDING',
    verificationDoc: 'RRFAM-PCL-1003-B.pdf'
  }
];

export const MOCK_COMPENSATION: CompensationRecord[] = [
  {
    id: 'CMP-901',
    parcelId: 'PCL-1001',
    khasraNo: '142/A',
    projectName: 'Mumbai-Pune Expressway Expansion',
    landownerName: 'Ramesh Balaji Patil',
    bankAccountNo: '91802003847291',
    ifscCode: 'SBIN0001420',
    calculatedAmount: 8500000,
    solatiumAmount: 8500000,
    totalCompensation: 17000000,
    status: 'STATE_APPROVED',
    utrNumber: 'PFMS202609128834',
    pfmsStatus: 'PENDING'
  },
  {
    id: 'CMP-902',
    parcelId: 'PCL-1002',
    khasraNo: '142/B',
    projectName: 'Mumbai-Pune Expressway Expansion',
    landownerName: 'Suresh Vishnu Shinde',
    bankAccountNo: '30291083921822',
    ifscCode: 'MAHB0000912',
    calculatedAmount: 12400000,
    solatiumAmount: 12400000,
    totalCompensation: 24800000,
    status: 'PAID',
    utrNumber: 'MAHB202609109923',
    paymentDate: '2026-09-10',
    pfmsStatus: 'SUCCESS'
  },
  {
    id: 'CMP-903',
    parcelId: 'PCL-1003',
    khasraNo: '88/4',
    projectName: 'Delhi-Varanasi High-Speed Rail',
    landownerName: 'Mahesh Pal Sharma',
    bankAccountNo: '50100284719283',
    ifscCode: 'HDFC0000124',
    calculatedAmount: 18500000,
    solatiumAmount: 18500000,
    totalCompensation: 37000000,
    status: 'DISPUTED',
    pfmsStatus: 'REJECTED'
  }
];

export const MOCK_AUDIT_LOGS: AuditEntry[] = [
  {
    id: 'AUD-501',
    timestamp: '2026-09-14T14:32:00Z',
    user: 'Collector_Pune',
    role: 'DISTRICT_COLLECTOR',
    action: 'APPROVE_SECTION_19',
    entityType: 'PROJECT',
    entityId: 'PRJ-2026-001',
    previousHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    hash: '0xa3b89d41e7f9c2a1104e8d356c9a0b12e34f567890abcdef1234567890abcdef',
    details: 'Approved Section 19 declaration for 340 parcels in Haveli taluka.'
  },
  {
    id: 'AUD-502',
    timestamp: '2026-09-14T16:45:12Z',
    user: 'Finance_Sec_MH',
    role: 'FINANCE_OFFICER',
    action: 'INITIATE_PAYMENT',
    entityType: 'COMPENSATION',
    entityId: 'CMP-902',
    previousHash: '0xa3b89d41e7f9c2a1104e8d356c9a0b12e34f567890abcdef1234567890abcdef',
    hash: '0xf7e6d5c4b3a2918076543210fedcba9876543210123456789abcdef012345678',
    details: 'Direct Bank Transfer of ₹2,48,00,000 dispatched via PFMS UTR MAHB202609109923.'
  },
  {
    id: 'AUD-503',
    timestamp: '2026-09-15T02:15:30Z',
    user: 'Surveyor_04',
    role: 'FIELD_SURVEYOR',
    action: 'FIELD_CAPTURED_OFFLINE',
    entityType: 'PARCEL',
    entityId: 'PCL-1003',
    previousHash: '0xf7e6d5c4b3a2918076543210fedcba9876543210123456789abcdef012345678',
    hash: '0x11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
    details: 'Captured offline spatial boundary & 3 geotagged photos for Khasra 88/4.'
  }
];

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'NOTIF-1',
    title: 'SLA Breach Warning',
    message: 'Section 11 hearing deadline breached for Parcel Khasra 88/4 (Gautam Buddha Nagar).',
    type: 'SLA_ALERT',
    timestamp: '10 mins ago',
    read: false,
    link: '/district/objections'
  },
  {
    id: 'NOTIF-2',
    title: 'Compensation Approval Required',
    message: '3 compensation awards pending District Collector signature for Project PRJ-2026-001.',
    type: 'APPROVAL_REQ',
    timestamp: '1 hour ago',
    read: false,
    link: '/district/awards'
  },
  {
    id: 'NOTIF-3',
    title: 'Offline Field Sync Completed',
    message: '14 parcels successfully synced from Surveyor-04 tablet with cryptographic hash match.',
    type: 'SURVEY_CAPTURED',
    timestamp: '3 hours ago',
    read: true,
    link: '/field/sync'
  }
];

export type UserRole =
  | 'CENTRAL_ADMIN'
  | 'STATE_OFFICER'
  | 'DISTRICT_COLLECTOR'
  | 'PIA_OFFICER'
  | 'FIELD_SURVEYOR'
  | 'RR_OFFICER'
  | 'FINANCE_OFFICER'
  | 'GIS_EXPERT'
  | 'CITIZEN';

export interface UserRoleOption {
  id: UserRole;
  label: string;
  portalPath: string;
  badgeColor: string;
  description: string;
}

export const USER_ROLES: UserRoleOption[] = [
  {
    id: 'CENTRAL_ADMIN',
    label: 'Central Administrator',
    portalPath: '/central/overview',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'National overview, cross-state monitoring, AI delay risk analytics & system governance.'
  },
  {
    id: 'STATE_OFFICER',
    label: 'State Nodal Officer',
    portalPath: '/state/overview',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'State-wide approval routing, statutory SLA monitoring & inter-district coordination.'
  },
  {
    id: 'DISTRICT_COLLECTOR',
    label: 'District Collector (CALA)',
    portalPath: '/district/work-queue',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    description: 'Competent Authority Land Acquisition: Section 4-23 declarations, hearings & awards.'
  },
  {
    id: 'PIA_OFFICER',
    label: 'Project Implementing Agency (PIA)',
    portalPath: '/pia/projects',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    description: 'NHAI/Railways/IDCO officer creating proposals, DPR submission & spatial requirements.'
  },
  {
    id: 'FIELD_SURVEYOR',
    label: 'Field Surveyor',
    portalPath: '/field/assignments',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
    description: 'Offline-first PWA ground survey, GPS polygon capture & geotagged photos.'
  },
  {
    id: 'RR_OFFICER',
    label: 'R&R Administrator',
    portalPath: '/rr/families',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    description: 'Resettlement & Rehabilitation entitlement matrix, family verification & housing allocation.'
  },
  {
    id: 'FINANCE_OFFICER',
    label: 'Finance & Treasury Officer',
    portalPath: '/finance/compensation',
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    description: 'PFMS integration, direct bank transfer authorization & financial audits.'
  },
  {
    id: 'GIS_EXPERT',
    label: 'GIS & Remote Sensing Expert',
    portalPath: '/gis/projects',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
    description: 'PostGIS spatial overlay, shapefile import/export, satellite land-use verification.'
  },
  {
    id: 'CITIZEN',
    label: 'Landowner / Citizen',
    portalPath: '/citizen/home',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    description: 'Public transparency portal, parcel search, objection filing & compensation tracking.'
  }
];
