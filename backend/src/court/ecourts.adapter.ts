import { CourtCaseCategory, CourtCaseStatus } from '@prisma/client';

/** A case as an eCourts/NJDG search would return it, normalised. */
export interface CourtCaseRecord {
  cnr: string;
  courtName: string;
  caseType: string;
  caseNumber: string;
  category: CourtCaseCategory;
  status: CourtCaseStatus;
  stayOrder: boolean;
  filedOn: string; // ISO date
  nextHearingOn: string | null;
  disposedOn: string | null;
  petitioners: string[];
  respondents: string[];
  subject: string;
  surveyNumbers: string[];
  villageName: string | null;
  districtCode: string;
}

/**
 * Where court cases come from. The real eCourts / NJDG services need an
 * access agreement (see MORNING_REPORT "Needs Parvati"); until then the
 * synthetic adapter serves a fixed, clearly labelled dataset.
 */
export interface EcourtsAdapter {
  readonly source: string;
  casesForDistrict(districtCode: string): Promise<CourtCaseRecord[]>;
}

export const ECOURTS = Symbol('ECOURTS');

/**
 * SYNTHETIC. Invented cases written around the demo parcels, including
 * deliberate near-misses (a namesake, a common survey number in another
 * village, a name-only hit) so the matcher's restraint can be seen.
 */
export const SYNTHETIC_CASES: CourtCaseRecord[] = [
  // Yavatmal
  {
    cnr: 'MHYT020045122025',
    courtName: 'Civil Judge (Senior Division), Yavatmal',
    caseType: 'Special Civil Suit',
    caseNumber: 'SCS 118/2025',
    category: 'TITLE_SUIT',
    status: 'PENDING',
    stayOrder: false,
    filedOn: '2025-11-28',
    nextHearingOn: '2026-10-14',
    disposedOn: null,
    petitioners: ['Ramesh Dadarao Burade'],
    respondents: ['Suresh Dadarao Burde', 'Kamal Dadarao Patil'],
    subject: 'Partition and separate possession of ancestral agricultural land, S. No. 311/4, Mauza Babhulgaon',
    surveyNumbers: ['S. No. 311/4'],
    villageName: 'Babhulgaon',
    districtCode: 'MH-YTL',
  },
  {
    cnr: 'MHYT020051902025',
    courtName: 'Civil Judge (Senior Division), Yavatmal',
    caseType: 'Special Civil Suit',
    caseNumber: 'SCS 131/2025',
    category: 'TITLE_SUIT',
    status: 'PENDING',
    stayOrder: false,
    filedOn: '2025-12-19',
    nextHearingOn: '2026-11-03',
    disposedOn: null,
    petitioners: ['Namdeo Dadarao Meshram'],
    respondents: ['State of Maharashtra through the Collector, Yavatmal', 'Divisional Forest Officer, Yavatmal'],
    subject: 'Declaration that S. No. 460/2, Mauza Kharshi is private agricultural land and not reserved forest',
    surveyNumbers: ['460/2'],
    villageName: 'Kharshi',
    districtCode: 'MH-YTL',
  },
  {
    // Near-miss: same survey number, different village.
    cnr: 'MHYT030011872024',
    courtName: 'Civil Judge (Junior Division), Kalamb',
    caseType: 'Regular Civil Suit',
    caseNumber: 'RCS 64/2024',
    category: 'TITLE_SUIT',
    status: 'PENDING',
    stayOrder: false,
    filedOn: '2024-04-08',
    nextHearingOn: '2026-10-09',
    disposedOn: null,
    petitioners: ['Vithoba Keshav Gawande'],
    respondents: ['Prakash Namdeo Thakre'],
    subject: 'Permanent injunction over the boundary of S. No. 311/4, Mauza Kalamb',
    surveyNumbers: ['311/4'],
    villageName: 'Kalamb',
    districtCode: 'MH-YTL',
  },
  {
    // Near-miss: a holder's name, nothing about land.
    cnr: 'MHYT040084502025',
    courtName: 'Judicial Magistrate First Class, Babhulgaon',
    caseType: 'Summary Criminal Case',
    caseNumber: 'SCC 845/2025',
    category: 'OTHER',
    status: 'PENDING',
    stayOrder: false,
    filedOn: '2025-09-02',
    nextHearingOn: '2026-10-21',
    disposedOn: null,
    petitioners: ['Gajanan Agro Traders'],
    respondents: ['Laxman Wamanrao Kolhe'],
    subject: 'Complaint under s.138 of the Negotiable Instruments Act (dishonoured cheque)',
    surveyNumbers: [],
    villageName: null,
    districtCode: 'MH-YTL',
  },
  {
    cnr: 'MHYT010002332026',
    courtName: 'Motor Accident Claims Tribunal, Yavatmal',
    caseType: 'MACP',
    caseNumber: 'MACP 23/2026',
    category: 'OTHER',
    status: 'PENDING',
    stayOrder: false,
    filedOn: '2026-01-15',
    nextHearingOn: '2026-10-30',
    disposedOn: null,
    petitioners: ['Rekha Sunil Ingle'],
    respondents: ['United India Insurance Co. Ltd.'],
    subject: 'Claim for compensation for a road accident on the Yavatmal–Darwha road',
    surveyNumbers: [],
    villageName: null,
    districtCode: 'MH-YTL',
  },
  // Wardha
  {
    cnr: 'MHWR010023112026',
    courtName: 'Land Acquisition, Rehabilitation and Resettlement Authority, Wardha',
    caseType: 'LAR Reference',
    caseNumber: 'LAR 7/2026',
    category: 'LAR_REFERENCE',
    status: 'PENDING',
    stayOrder: false,
    filedOn: '2026-06-30',
    nextHearingOn: '2026-10-20',
    disposedOn: null,
    petitioners: ['Pandurang Shankarrao Dhote'],
    respondents: ['Collector, Wardha', 'National Highways Authority of India'],
    subject: 'Reference under s.64 against Award No. AWD/MH-WRD/2026/0029 (S. No. 441/3, Mauza Borgaon): market value',
    surveyNumbers: ['441/3'],
    villageName: 'Borgaon',
    districtCode: 'MH-WRD',
  },
  {
    cnr: 'MHNG010033452026',
    courtName: 'High Court of Bombay, Nagpur Bench',
    caseType: 'Writ Petition',
    caseNumber: 'WP 3345/2026',
    category: 'WRIT_PETITION',
    status: 'PENDING',
    stayOrder: true,
    filedOn: '2026-08-04',
    nextHearingOn: '2026-10-07',
    disposedOn: null,
    petitioners: ['Sanjay Wamanrao Mohod', 'Three others'],
    respondents: ['State of Maharashtra', 'Collector, Wardha'],
    subject: 'Direction to deliver R&R entitlements before dispossession, S. No. 126/6, Mauza Kharangana; status quo on possession ordered 18.08.2026',
    surveyNumbers: ['126/6'],
    villageName: 'Kharangana',
    districtCode: 'MH-WRD',
  },
  {
    // Near-miss: the holder is a party, but the suit is about another plot.
    cnr: 'MHWR020009982024',
    courtName: 'Civil Judge (Junior Division), Seloo',
    caseType: 'Regular Civil Suit',
    caseNumber: 'RCS 211/2024',
    category: 'TITLE_SUIT',
    status: 'PENDING',
    stayOrder: false,
    filedOn: '2024-07-22',
    nextHearingOn: '2026-11-11',
    disposedOn: null,
    petitioners: ['Bhaurao Tukaram Kolhe'],
    respondents: ['Ganesh Motiram Kolhe'],
    subject: 'Right of way (easement) over S. No. 88/1, Mauza Selu Khurd',
    surveyNumbers: ['88/1'],
    villageName: 'Selu Khurd',
    districtCode: 'MH-WRD',
  },
  {
    cnr: 'MHWR010004412023',
    courtName: 'Civil Judge (Senior Division), Wardha',
    caseType: 'Special Civil Suit',
    caseNumber: 'SCS 52/2023',
    category: 'TITLE_SUIT',
    status: 'DISPOSED',
    stayOrder: false,
    filedOn: '2023-02-10',
    nextHearingOn: null,
    disposedOn: '2025-03-14',
    petitioners: ['Sunita Maroti Bhoyar'],
    respondents: ['Dnyaneshwar Maroti Bhoyar'],
    subject: 'Partition of S. No. 198/2, Mauza Anji (disposed: compromise decree)',
    surveyNumbers: ['198/2'],
    villageName: 'Anji',
    districtCode: 'MH-WRD',
  },
  {
    cnr: 'MHWR010019022025',
    courtName: 'Civil Judge (Senior Division), Wardha',
    caseType: 'Special Civil Suit',
    caseNumber: 'SCS 190/2025',
    category: 'TITLE_SUIT',
    status: 'PENDING',
    stayOrder: false,
    filedOn: '2025-10-01',
    nextHearingOn: '2026-12-02',
    disposedOn: null,
    petitioners: ['Kisan Vitthal Dhage'],
    respondents: ['Shobha Kisan Dhage'],
    subject: 'Partition of S. No. 902/1, Mauza Pipri',
    surveyNumbers: ['902/1'],
    villageName: 'Pipri',
    districtCode: 'MH-WRD',
  },
  {
    cnr: 'MHWR050007712026',
    courtName: 'Civil Judge (Junior Division), Wardha',
    caseType: 'Regular Civil Suit',
    caseNumber: 'RCS 77/2026',
    category: 'OTHER',
    status: 'PENDING',
    stayOrder: false,
    filedOn: '2026-03-12',
    nextHearingOn: '2026-10-16',
    disposedOn: null,
    petitioners: ['Wardha Nagar Parishad'],
    respondents: ['Mohan Lal Agrawal'],
    subject: 'Recovery of shop rent, Ward No. 12, Wardha town',
    surveyNumbers: [],
    villageName: null,
    districtCode: 'MH-WRD',
  },
];

export class SyntheticEcourtsAdapter implements EcourtsAdapter {
  readonly source = 'ECOURTS_SYNTHETIC';
  async casesForDistrict(districtCode: string): Promise<CourtCaseRecord[]> {
    return SYNTHETIC_CASES.filter((c) => c.districtCode === districtCode);
  }
}
