/**
 * R-NLAM demo dataset: SYNTHETIC. Not real government records.
 *
 * Story (see docs/DEMO-DATASET.md): a 4-lane highway from Wardha to Yavatmal
 * (Maharashtra) crossing 12 villages in two districts. Wardha is well advanced;
 * Yavatmal is behind, with two villages still waiting for their s.19
 * declaration while the statutory clock runs. Three parcels are stuck for
 * reasons later features surface: a forest overlap (GIS gate), an owner whose
 * name differs across scripts (reconciliation), and a title suit (court link).
 * Five smaller projects in other states give the national view some breadth.
 */
import { CompensationStatus, JurisdictionLevel, NoticeKind, ParcelStage, Prisma, PrismaClient, RoleName } from '@prisma/client';
import * as crypto from 'crypto';
import { calculateAward } from '../../src/awards/award-calculator';
import { splitByShare } from '../../src/awards/split';
import { addDays, parseIstDate } from '../../src/common/dates';
import { rupeesToPaise } from '../../src/common/money';
import { PrismaService } from '../../src/prisma/prisma.service';
import { computeClocks } from '../../src/rules/clocks';
import { installPacks, RulesService } from '../../src/rules/rules.service';
import { factsOf, parcelInclude } from '../../src/statutory/statutory.service';
import { screenParcels } from '../../src/gis/gis-gate.service';
import { runReconciliation } from '../../src/reconciliation/reconciliation.module';
import { sealAudit } from '../../src/audit/merkle.service';
import { LocalDiskStorage } from '../../src/storage/storage';
import { makePdf } from './pdf';
import { corridorRect, LngLat } from './geo';
import { SeedActor, SeedHistory } from './history';
import { makeRng, Rng } from './rng';

export const DEMO_DOMAIN = '@demo.rnlam.in';
/** Latest date any seeded event may carry. */
export const ANCHOR = parseIstDate('2026-09-25');

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------
const FIRST = ['Ramesh', 'Suresh', 'Ganesh', 'Vitthal', 'Pandurang', 'Sunita', 'Kamal', 'Shobha', 'Dnyaneshwar', 'Bhaskar', 'Sanjay', 'Mangala', 'Prakash', 'Vandana', 'Ashok', 'Rekha', 'Namdeo', 'Tukaram', 'Sindhu', 'Baban', 'Laxman', 'Usha', 'Dattatray', 'Savita'];
const FATHER = ['Bhaurao', 'Shankarrao', 'Maroti', 'Dadarao', 'Keshavrao', 'Motiram', 'Bapurao', 'Wamanrao', 'Rambhau', 'Narayan'];
const SURNAME = ['Patil', 'Wankhede', 'Deshmukh', 'Thakre', 'Bhoyar', 'Kale', 'Raut', 'Ingle', 'Gawande', 'Meshram', 'Dhote', 'Chaudhari', 'Mohod', 'Tayde', 'Kolhe', 'Burade'];

const TO_DEVA: Record<string, string> = {
  Ramkumar: 'रामकुमार', Bhaurao: 'भाऊराव', Wankhede: 'वानखेडे',
};

// ---------------------------------------------------------------------------
// Geography
// ---------------------------------------------------------------------------
interface VillageSpec {
  code: string;
  name: string;
  nameLocal: string;
  district: 'MH-WRD' | 'MH-YTL';
  parcels: number;
}

const WARDHA: LngLat = [78.6022, 20.7453];
const YAVATMAL: LngLat = [78.1204, 20.3888];

const MAIN_VILLAGES: VillageSpec[] = [
  { code: 'MH-WRD-SWG', name: 'Sawangi', nameLocal: 'सावंगी', district: 'MH-WRD', parcels: 8 },
  { code: 'MH-WRD-SLK', name: 'Selu Khurd', nameLocal: 'सेलू खुर्द', district: 'MH-WRD', parcels: 8 },
  { code: 'MH-WRD-PPR', name: 'Pipri', nameLocal: 'पिपरी', district: 'MH-WRD', parcels: 8 },
  { code: 'MH-WRD-BRG', name: 'Borgaon', nameLocal: 'बोरगाव', district: 'MH-WRD', parcels: 8 },
  { code: 'MH-WRD-ANJ', name: 'Anji', nameLocal: 'आंजी', district: 'MH-WRD', parcels: 8 },
  { code: 'MH-WRD-KRG', name: 'Kharangana', nameLocal: 'खरांगणा', district: 'MH-WRD', parcels: 8 },
  { code: 'MH-YTL-KLB', name: 'Kalamb', nameLocal: 'कळंब', district: 'MH-YTL', parcels: 8 },
  { code: 'MH-YTL-KRS', name: 'Kharshi', nameLocal: 'खरशी', district: 'MH-YTL', parcels: 8 },
  { code: 'MH-YTL-RLG', name: 'Ralegaon Bk', nameLocal: 'राळेगाव बु.', district: 'MH-YTL', parcels: 8 },
  { code: 'MH-YTL-BBL', name: 'Babhulgaon', nameLocal: 'बाभुळगाव', district: 'MH-YTL', parcels: 8 },
  { code: 'MH-YTL-WDG', name: 'Wadgaon', nameLocal: 'वडगाव', district: 'MH-YTL', parcels: 7 },
  { code: 'MH-YTL-DHN', name: 'Dhanora', nameLocal: 'धानोरा', district: 'MH-YTL', parcels: 7 },
];

const DATES = {
  wardhaSia: parseIstDate('2024-12-20'),
  yavatmalSia: parseIstDate('2025-05-12'),
  wardhaSec11: parseIstDate('2025-06-10'),
  wardhaSec19: parseIstDate('2026-02-16'),
  yavatmalSec11: parseIstDate('2025-11-05'),
  yavatmalSec19: parseIstDate('2026-07-15'),
};

/** Parcels whose trouble later features explain. */
export const STORY = {
  forestParcel: 'YTL-KRS-004',
  nameMismatchParcel: 'WRD-SLK-003',
  courtCaseParcel: 'YTL-BBL-005',
  livePayParcel: 'WRD-BRG-006',
  livePossessionParcel: 'WRD-ANJ-002',
  rrBlockedParcel: 'WRD-KRG-005',
} as const;

// ---------------------------------------------------------------------------
// Other projects (breadth for the national view)
// ---------------------------------------------------------------------------
interface OtherProject {
  code: string;
  name: string;
  sector: string;
  stateCode: string;
  stateName: string;
  district: { code: string; name: string };
  pia: string;
  from: LngLat;
  to: LngLat;
  villages: Array<{ code: string; name: string }>;
  sec11: string;
  sec19: string | null;
  ratePerHa: [number, number];
  maturity: number; // 0..1 how far along parcels are
}

const OTHER_PROJECTS: OtherProject[] = [
  {
    code: 'DFC-GJ-SPUR', name: 'Freight Corridor Spur: Palanpur Logistics Park', sector: 'Railways', stateCode: 'GJ', stateName: 'Gujarat',
    district: { code: 'GJ-BNK', name: 'Banaskantha' }, pia: 'Dedicated Freight Corridor Corporation (synthetic record)',
    from: [72.43, 24.17], to: [72.33, 24.05], villages: [{ code: 'GJ-BNK-CHD', name: 'Chadotar' }, { code: 'GJ-BNK-MLN', name: 'Malan' }, { code: 'GJ-BNK-JGN', name: 'Jagana' }],
    sec11: '2025-03-12', sec19: '2025-11-20', ratePerHa: [1_800_000, 3_200_000], maturity: 0.8,
  },
  {
    code: 'SOLAR-RJ-BKN', name: 'Bikaner Solar Park Evacuation Line', sector: 'Energy', stateCode: 'RJ', stateName: 'Rajasthan',
    district: { code: 'RJ-BKN', name: 'Bikaner' }, pia: 'State Transmission Utility (synthetic record)',
    from: [73.31, 28.02], to: [73.12, 27.86], villages: [{ code: 'RJ-BKN-GJN', name: 'Gajner' }, { code: 'RJ-BKN-KLY', name: 'Kolayat' }],
    sec11: '2025-08-01', sec19: '2026-04-10', ratePerHa: [400_000, 900_000], maturity: 0.45,
  },
  {
    code: 'RING-KA-MYS', name: 'Mysuru Outer Ring Road Phase II', sector: 'Roads', stateCode: 'KA', stateName: 'Karnataka',
    district: { code: 'KA-MYS', name: 'Mysuru' }, pia: 'State Highways Development Project (synthetic record)',
    from: [76.58, 12.35], to: [76.7, 12.26], villages: [{ code: 'KA-MYS-HNK', name: 'Hinkal' }, { code: 'KA-MYS-BGR', name: 'Bogadi' }, { code: 'KA-MYS-SGH', name: 'Siddalingapura' }],
    sec11: '2025-01-20', sec19: '2025-10-02', ratePerHa: [2_500_000, 5_500_000], maturity: 0.65,
  },
  {
    code: 'IND-UP-JWR', name: 'Jewar Industrial Node Access Road', sector: 'Industrial', stateCode: 'UP', stateName: 'Uttar Pradesh',
    district: { code: 'UP-GBN', name: 'Gautam Buddh Nagar' }, pia: 'Industrial Development Authority (synthetic record)',
    from: [77.55, 28.13], to: [77.63, 28.07], villages: [{ code: 'UP-GBN-RNH', name: 'Ranhera' }, { code: 'UP-GBN-DYN', name: 'Dayanatpur' }],
    sec11: '2026-01-15', sec19: null, ratePerHa: [6_000_000, 11_000_000], maturity: 0.2,
  },
  {
    code: 'CANAL-MP-NMD', name: 'Narmada Lift Irrigation Link Canal', sector: 'Irrigation', stateCode: 'MP', stateName: 'Madhya Pradesh',
    district: { code: 'MP-KHR', name: 'Khargone' }, pia: 'Water Resources Department (synthetic record)',
    from: [75.61, 21.82], to: [75.49, 21.71], villages: [{ code: 'MP-KHR-BDW', name: 'Bediya' }, { code: 'MP-KHR-KSR', name: 'Kasrawad' }],
    sec11: '2024-11-04', sec19: '2025-08-18', ratePerHa: [700_000, 1_400_000], maturity: 0.9,
  },
];

// ---------------------------------------------------------------------------

export async function wipe(prisma: PrismaClient) {
  // One statement, so FK order does not matter; sequences restart for a clean audit seq.
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
}

interface Ctx {
  prisma: PrismaClient;
  history: SeedHistory;
  rng: Rng;
  rules: RulesService;
  users: Record<string, { id: string; role: RoleName }>;
  jur: Record<string, { id: string; name: string; nameLocal: string | null }>;
  entitlements: Record<string, { id: string; amountPaise: bigint | null }>;
  counters: { award: Record<string, number>; person: number };
}

const actor = (u: { id: string; role: RoleName }): SeedActor => ({ id: u.id, role: u.role });
const SYSTEM: SeedActor = { id: null, role: 'SYSTEM' };
const hashId = (s: string) => crypto.createHash('sha256').update(`rnlam-demo-salt:${s}`).digest('hex');
const clampDate = (d: Date) => (d > ANCHOR ? ANCHOR : d);

export async function seedDemo(prisma: PrismaClient) {
  await wipe(prisma);
  const ctx: Ctx = {
    prisma,
    history: new SeedHistory(),
    rng: makeRng(2026_09_29),
    rules: new RulesService(prisma as unknown as PrismaService),
    users: {},
    jur: {},
    entitlements: {},
    counters: { award: {}, person: 0 },
  };

  await installPacks(prisma);
  await seedJurisdictions(ctx);
  await seedOrgsAndUsers(ctx);
  await seedEntitlements(ctx);
  const main = await seedMainProject(ctx);
  for (const p of OTHER_PROJECTS) await seedOtherProject(ctx, p);
  await seedConstraintLayers(ctx);
  await seedCitizenLogins(ctx);
  const written = await ctx.history.flush(prisma);
  const clocks = await seedClocks(prisma);
  const identity = await runReconciliation(prisma);
  // Seal the historical audit trail into one Merkle root per IST day.
  const merkle = await sealAudit(prisma, new Date());
  // Liability fact views read the tables just written.
  await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW mv_liability_s80');
  await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW mv_liability_additional');

  const counts = {
    projects: await prisma.project.count(),
    parcels: await prisma.parcel.count(),
    awards: await prisma.award.count(),
    compensation: await prisma.compensation.count(),
    families: await prisma.affectedFamily.count(),
    users: await prisma.user.count(),
    ...written,
    clocks,
    identityCandidates: identity.candidates,
    identityAutoLinked: identity.autoLinked,
    merkleRoots: merkle.sealed,
  };
  return { mainProjectId: main.id, counts };
}

// ---------------------------------------------------------------------------

async function seedJurisdictions(ctx: Ctx) {
  const { prisma } = ctx;
  const nation = await prisma.jurisdiction.create({ data: { level: JurisdictionLevel.NATION, code: 'IN', name: 'India', nameLocal: 'भारत', stateCode: 'IN' } });
  const states: Array<[string, string, string]> = [
    ['MH', 'Maharashtra', 'महाराष्ट्र'],
    ['GJ', 'Gujarat', 'ગુજરાત'],
    ['RJ', 'Rajasthan', 'राजस्थान'],
    ['KA', 'Karnataka', 'ಕರ್ನಾಟಕ'],
    ['UP', 'Uttar Pradesh', 'उत्तर प्रदेश'],
    ['MP', 'Madhya Pradesh', 'मध्य प्रदेश'],
  ];
  for (const [code, name, nameLocal] of states) {
    const s = await prisma.jurisdiction.create({ data: { level: JurisdictionLevel.STATE, code, name, nameLocal, stateCode: code, parentId: nation.id } });
    ctx.jur[code] = s;
  }
  const districts: Array<[string, string, string | null, string]> = [
    ['MH-WRD', 'Wardha', 'वर्धा', 'MH'],
    ['MH-YTL', 'Yavatmal', 'यवतमाळ', 'MH'],
    ...OTHER_PROJECTS.map((p) => [p.district.code, p.district.name, null, p.stateCode] as [string, string, null, string]),
  ];
  for (const [code, name, nameLocal, st] of districts) {
    ctx.jur[code] = await prisma.jurisdiction.create({ data: { level: JurisdictionLevel.DISTRICT, code, name, nameLocal, stateCode: st, parentId: ctx.jur[st].id } });
  }
  for (const v of MAIN_VILLAGES) {
    ctx.jur[v.code] = await prisma.jurisdiction.create({
      data: { level: JurisdictionLevel.VILLAGE, code: v.code, name: v.name, nameLocal: v.nameLocal, stateCode: 'MH', parentId: ctx.jur[v.district].id },
    });
  }
  for (const p of OTHER_PROJECTS) {
    for (const v of p.villages) {
      ctx.jur[v.code] = await prisma.jurisdiction.create({
        data: { level: JurisdictionLevel.VILLAGE, code: v.code, name: v.name, stateCode: p.stateCode, parentId: ctx.jur[p.district.code].id },
      });
    }
  }
}

async function seedOrgsAndUsers(ctx: Ctx) {
  const { prisma } = ctx;
  const dolr = await prisma.organization.create({ data: { code: 'DOLR', name: 'Department of Land Resources (synthetic record)', type: 'CENTRAL_DEPT' } });
  const mhRev = await prisma.organization.create({ data: { code: 'MH-REV', name: 'Revenue & Forest Department, Maharashtra (synthetic record)', type: 'STATE_DEPT', stateCode: 'MH' } });
  const nhai = await prisma.organization.create({ data: { code: 'NHAI', name: 'National Highways Authority of India (synthetic record)', type: 'PIA' } });

  // Fictional officers. One persona per role for the dev role switcher.
  const people: Array<{ key: string; email: string; name: string; role: RoleName; designation: string; jur?: string; org: string }> = [
    { key: 'central', email: 'js.landreforms', name: 'Anita Deshpande', role: RoleName.CENTRAL_ADMIN, designation: 'Joint Secretary (Land Reforms)', org: dolr.id },
    { key: 'centralOfficer', email: 'director.monitoring', name: 'Rahul Menon', role: RoleName.CENTRAL_OFFICER, designation: 'Director, Monitoring Cell', org: dolr.id },
    { key: 'stateAdmin', email: 'ps.revenue.mh', name: 'Madhuri Kulkarni', role: RoleName.STATE_ADMIN, designation: 'Principal Secretary (Revenue)', jur: 'MH', org: mhRev.id },
    { key: 'stateOfficer', email: 'dy.secretary.mh', name: 'Nitin Jadhav', role: RoleName.STATE_OFFICER, designation: 'Deputy Secretary (LA)', jur: 'MH', org: mhRev.id },
    { key: 'collectorWardha', email: 'collector.wardha', name: 'Priya Wagh', role: RoleName.DISTRICT_OFFICER, designation: 'Collector & District Magistrate, Wardha', jur: 'MH-WRD', org: mhRev.id },
    { key: 'collectorYavatmal', email: 'collector.yavatmal', name: 'Sameer Khan', role: RoleName.DISTRICT_OFFICER, designation: 'Collector & District Magistrate, Yavatmal', jur: 'MH-YTL', org: mhRev.id },
    { key: 'field', email: 'surveyor.wardha', name: 'Kiran Bhosale', role: RoleName.FIELD_OFFICER, designation: 'Circle Officer (Survey), Wardha', jur: 'MH-WRD', org: mhRev.id },
    { key: 'rr', email: 'rr.wardha', name: 'Deepa Nair', role: RoleName.RR_OFFICER, designation: 'R&R Administrator, Wardha', jur: 'MH-WRD', org: mhRev.id },
    { key: 'finance', email: 'finance.mh', name: 'Arvind Joshi', role: RoleName.FINANCE_OFFICER, designation: 'Accounts Officer (LA), Maharashtra', jur: 'MH', org: mhRev.id },
    { key: 'gis', email: 'gis.mh', name: 'Farah Siddiqui', role: RoleName.GIS_OFFICER, designation: 'GIS Analyst, MRSAC liaison', jur: 'MH', org: mhRev.id },
    { key: 'pia', email: 'pd.nhai.wardha', name: 'Col. Vikram Rathore (Retd.)', role: RoleName.PIA_OFFICER, designation: 'Project Director, PIU Wardha', org: nhai.id },
  ];
  for (const p of people) {
    const u = await prisma.user.create({
      data: {
        email: p.email + DEMO_DOMAIN,
        name: p.name,
        role: p.role,
        designation: p.designation,
        organizationId: p.org,
        jurisdictionId: p.jur ? ctx.jur[p.jur].id : null,
      },
    });
    ctx.users[p.key] = { id: u.id, role: u.role };
  }
  // State admins for the other states, so the national view has owners.
  for (const p of OTHER_PROJECTS) {
    const u = await prisma.user.create({
      data: {
        email: `collector.${p.district.code.toLowerCase()}${DEMO_DOMAIN}`,
        name: `Collector, ${p.district.name}`,
        role: RoleName.DISTRICT_OFFICER,
        designation: `Collector, ${p.district.name} (synthetic)`,
        jurisdictionId: ctx.jur[p.district.code].id,
        active: true,
      },
    });
    ctx.users[`collector:${p.district.code}`] = { id: u.id, role: u.role };
  }
}

async function seedEntitlements(ctx: Ctx) {
  // Second Schedule of RFCTLARR 2013 (amounts as enacted; states may enhance).
  const items: Array<[string, string, string, number | null, string, string]> = [
    ['HOUSE_RURAL', 'House for displaced family (rural)', 'HOUSING', null, 'Constructed house as per Indira Awas Yojana specifications, or cash in lieu', 'Second Schedule, item 1'],
    ['CHOICE_EMPLOYMENT_OR_ANNUITY', 'Employment, one-time payment or annuity', 'EMPLOYMENT', 500000, 'Job for one member, or ₹5,00,000 one-time, or ₹2,000/month annuity for 20 years', 'Second Schedule, item 4'],
    ['SUBSISTENCE_GRANT', 'Subsistence grant for displaced family', 'SUBSISTENCE', 36000, '₹3,000 per month for one year', 'Second Schedule, item 5'],
    ['TRANSPORTATION', 'Transportation cost', 'TRANSPORT', 50000, 'One-time financial assistance of ₹50,000', 'Second Schedule, item 6'],
    ['CATTLE_SHED', 'Cattle shed / petty shop', 'GRANT', 25000, 'One-time financial assistance of at least ₹25,000', 'Second Schedule, item 7'],
    ['ARTISAN_GRANT', 'Artisan, small trader grant', 'GRANT', 25000, 'One-time financial assistance of at least ₹25,000', 'Second Schedule, item 8'],
    ['RESETTLEMENT_ALLOWANCE', 'One-time resettlement allowance', 'GRANT', 50000, 'One-time resettlement allowance of ₹50,000', 'Second Schedule, item 9'],
  ];
  for (const [code, name, category, rupees, description, cite] of items) {
    const e = await ctx.prisma.entitlement.create({
      data: { code, name, category, amountPaise: rupees === null ? null : rupeesToPaise(rupees), description, citation: `RFCTLARR 2013, ${cite}` },
    });
    ctx.entitlements[code] = { id: e.id, amountPaise: e.amountPaise };
  }
}

// ---------------------------------------------------------------------------

async function makePerson(ctx: Ctx, villageCode: string, overrides: Partial<Prisma.PersonCreateInput> = {}) {
  const { rng } = ctx;
  ctx.counters.person++;
  const first = rng.pick(FIRST);
  const father = rng.pick(FATHER);
  const surname = rng.pick(SURNAME);
  return ctx.prisma.person.create({
    data: {
      name: `${first} ${father} ${surname}`,
      nameScript: 'Latn',
      fatherName: `${father} ${surname}`,
      villageCode,
      idHash: hashId(`person-${ctx.counters.person}`),
      source: 'LAND_RECORDS',
      ...overrides,
    },
  });
}

type CompPlan = 'ASSESSED' | 'APPROVED' | 'FAILED' | 'PARTIAL' | 'PAID' | 'ON_HOLD';

interface ParcelPlan {
  target: ParcelStage;
  comp?: CompPlan;
  rrDelivered?: boolean;
  displaced?: boolean;
  families?: number;
}

interface NoticeSet {
  sia?: { id: string; date: Date };
  sec11?: { id: string; date: Date };
  sec19?: { id: string; date: Date };
}

interface BuiltParcel {
  id: string;
  parcelNumber: string;
  projectId: string;
  districtCode: string;
}

/**
 * Create one parcel and walk it through the lifecycle up to `plan.target`,
 * writing every record and every historical transition on the way.
 */
async function buildParcel(
  ctx: Ctx,
  args: {
    projectId: string;
    parcelNumber: string;
    surveyNumber: string;
    village: { code: string; name: string };
    district: { code: string; name: string };
    state: { code: string; name: string };
    geometry: object;
    areaHa: number;
    ratePerHa: number;
    distanceKm: number;
    landClass: string;
    notices: NoticeSet;
    plan: ParcelPlan;
    collector: { id: string; role: RoleName };
    holders?: Array<{ personId: string; name: string; share: number }>;
    ulpin?: string;
  },
): Promise<BuiltParcel> {
  const { prisma, rng, history } = ctx;
  const { plan } = args;
  const families = plan.families ?? rng.int(1, 3);

  const parcel = await prisma.parcel.create({
    data: {
      projectId: args.projectId,
      parcelNumber: args.parcelNumber,
      surveyNumber: args.surveyNumber,
      ulpin: args.ulpin,
      villageId: ctx.jur[args.village.code].id,
      villageName: args.village.name,
      districtCode: args.district.code,
      districtName: args.district.name,
      stateCode: args.state.code,
      stateName: args.state.name,
      totalAreaHa: args.areaHa,
      landClass: args.landClass,
      isRural: true,
      distanceFromUrbanKm: args.distanceKm,
      marketRatePaisePerHa: rupeesToPaise(args.ratePerHa),
      displayOwnerName: '',
      geometry: args.geometry as Prisma.InputJsonValue,
      familiesAffected: families,
      verificationState: 'OFFICER_VERIFIED',
    },
  });

  // Holders
  let holders = args.holders;
  if (!holders) {
    const n = rng.chance(0.35) ? 2 : rng.chance(0.15) ? 3 : 1;
    const shares = n === 1 ? [100] : n === 2 ? [50, 50] : [40, 30, 30];
    holders = [];
    for (let i = 0; i < n; i++) {
      const p = await makePerson(ctx, args.village.code);
      holders.push({ personId: p.id, name: p.name, share: shares[i] });
    }
  }
  for (const h of holders) {
    await prisma.parcelHolder.create({ data: { parcelId: parcel.id, personId: h.personId, sharePct: h.share, nameAsRecorded: h.name, source: 'LAND_RECORDS' } });
  }
  await prisma.parcel.update({ where: { id: parcel.id }, data: { displayOwnerName: holders.map((h) => h.name).join(', ') } });
  await prisma.landRecordReference.create({
    data: {
      surveyNo: args.surveyNumber,
      villageCode: args.village.code,
      ownerName: holders.map((h) => h.name).join('; '),
      areaHa: args.areaHa,
      recordDate: parseIstDate('2025-04-01'),
      rawData: { synthetic: true, holders: holders.map((h) => ({ name: h.name, share: h.share })) },
    },
  });

  const stageOrder: ParcelStage[] = ['IDENTIFIED', 'PRELIM_NOTIFIED', 'DECLARED', 'AWARDED', 'COMPENSATION_PAID', 'POSSESSION_TAKEN', 'HANDED_OVER'];
  const reach = (s: ParcelStage) => stageOrder.indexOf(plan.target) >= stageOrder.indexOf(s);
  const col = actor(args.collector);
  let stage: ParcelStage = 'IDENTIFIED';
  const move = async (event: string, to: ParcelStage, at: Date, by: SeedActor, context?: Record<string, unknown>) => {
    history.transition({ entityType: 'Parcel', entityId: parcel.id, event, from: stage, to, at, actor: by, context: { projectId: args.projectId, ...context } });
    stage = to;
  };

  // R&R families (created up front; cases progress with the parcel)
  const rrCases: string[] = [];
  const displaced = plan.displaced ?? rng.chance(0.25);
  if (displaced) {
    const fam = await prisma.affectedFamily.create({
      data: {
        projectId: args.projectId,
        headName: holders[0].name,
        familySize: rng.int(3, 7),
        idHash: hashId(`family-${parcel.id}`),
        villageName: args.village.name,
        category: rng.chance(0.2) ? 'SC_ST' : 'LANDOWNER',
        isVulnerable: rng.chance(0.2),
        isDisplaced: true,
      },
    });
    const rc = await prisma.rRCase.create({ data: { projectId: args.projectId, parcelId: parcel.id, familyId: fam.id } });
    rrCases.push(rc.id);
  }

  if (!reach('PRELIM_NOTIFIED') || !args.notices.sec11) {
    return { id: parcel.id, parcelNumber: parcel.parcelNumber, projectId: args.projectId, districtCode: args.district.code };
  }
  if (args.notices.sia) await prisma.statutoryNotice.update({ where: { id: args.notices.sia.id }, data: { parcels: { connect: { id: parcel.id } } } });
  await prisma.statutoryNotice.update({ where: { id: args.notices.sec11.id }, data: { parcels: { connect: { id: parcel.id } } } });
  await move('PUBLISH_PRELIMINARY', 'PRELIM_NOTIFIED', args.notices.sec11.date, col, { noticeId: args.notices.sec11.id });

  if (!reach('DECLARED') || !args.notices.sec19) {
    await prisma.parcel.update({ where: { id: parcel.id }, data: { stage } });
    return { id: parcel.id, parcelNumber: parcel.parcelNumber, projectId: args.projectId, districtCode: args.district.code };
  }
  await prisma.statutoryNotice.update({ where: { id: args.notices.sec19.id }, data: { parcels: { connect: { id: parcel.id } } } });
  await move('DECLARE', 'DECLARED', args.notices.sec19.date, col, { noticeId: args.notices.sec19.id });

  if (!reach('AWARDED')) {
    await prisma.parcel.update({ where: { id: parcel.id }, data: { stage } });
    return { id: parcel.id, parcelNumber: parcel.parcelNumber, projectId: args.projectId, districtCode: args.district.code };
  }

  // Award
  const awardDate = clampDate(addDays(args.notices.sec19.date, rng.int(55, 140)));
  const { rules, packCode, packs, unverified } = await ctx.rules.awardRules({ stateCode: args.state.code, isRural: true, distanceFromUrbanKm: args.distanceKm }, awardDate);
  // s.30(3): the additional amount runs from the s.4(2) SIA notification.
  const additionalFrom = args.notices.sia?.date ?? args.notices.sec11.date;
  const assets = rng.chance(0.5) ? rng.int(20, 400) * 1000 : 0;
  const b = calculateAward(
    { areaHa: args.areaHa, marketRatePaisePerHa: rupeesToPaise(args.ratePerHa), assetsValuePaise: rupeesToPaise(assets), additionalFrom, cutoffDate: awardDate },
    rules,
  );
  const seq = (ctx.counters.award[args.district.code] = (ctx.counters.award[args.district.code] ?? 0) + 1);
  const award = await prisma.award.create({
    data: {
      awardNumber: `AWD/${args.district.code}/${awardDate.getUTCFullYear()}/${String(seq).padStart(4, '0')}`,
      projectId: args.projectId,
      parcelId: parcel.id,
      awardDate,
      marketValuePaise: b.marketValuePaise,
      multiplier: new Prisma.Decimal(b.multiplier),
      assetsValuePaise: b.assetsValuePaise,
      solatiumPaise: b.solatiumPaise,
      additionalAmountPaise: b.additionalAmountPaise,
      totalPaise: b.totalPaise,
      calculation: JSON.parse(JSON.stringify({ ...b, packCode, packs, unverified, additionalFrom, additionalFromEvent: args.notices.sia ? 'SEC_4_SIA' : 'SEC_11_PRELIMINARY' }, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))),
    },
  });
  const shares = splitByShare(b.totalPaise, holders.map((h) => ({ ...h, sharePct: h.share })));
  const comps: Array<{ id: string; amountPaise: bigint }> = [];
  for (const s of shares) {
    const c = await prisma.compensation.create({
      data: {
        projectId: args.projectId,
        parcelId: parcel.id,
        awardId: award.id,
        personId: s.personId,
        beneficiaryName: s.name,
        sharePct: s.share,
        amountPaise: s.amountPaise,
        bankAccountLast4: String(rng.int(1000, 9999)),
        ifscCode: 'SYNT0000' + rng.int(100, 999),
        createdAt: awardDate,
      },
    });
    comps.push({ id: c.id, amountPaise: c.amountPaise });
  }
  await move('DECLARE_AWARD', 'AWARDED', awardDate, col, { awardId: award.id, awardNumber: award.awardNumber, totalPaise: award.totalPaise });

  // R&R plan follows the award
  for (const caseId of rrCases) {
    const assigned = ['RESETTLEMENT_ALLOWANCE', 'SUBSISTENCE_GRANT', 'TRANSPORTATION', 'CHOICE_EMPLOYMENT_OR_ANNUITY'];
    let st = 'IDENTIFIED';
    const step = (event: string, to: string, at: Date) => {
      history.transition({ entityType: 'RRCase', entityId: caseId, event, from: st, to, at, actor: actor(ctx.users.rr) });
      st = to;
    };
    step('VERIFY_ELIGIBILITY', 'ELIGIBILITY_VERIFIED', addDays(awardDate, 7));
    step('CREATE_PLAN', 'PLAN_CREATED', addDays(awardDate, 14));
    for (const code of assigned) {
      await prisma.rREntitlementGrant.create({ data: { caseId, entitlementId: ctx.entitlements[code].id, amountPaise: ctx.entitlements[code].amountPaise } });
    }
    step('ASSIGN_BENEFITS', 'BENEFIT_ASSIGNED', addDays(awardDate, 20));
    const deliver = plan.rrDelivered ?? reach('POSSESSION_TAKEN');
    if (deliver) {
      const on = clampDate(addDays(awardDate, rng.int(30, 70)));
      await prisma.rREntitlementGrant.updateMany({ where: { caseId }, data: { status: 'DELIVERED', deliveredOn: on } });
      step('MARK_DELIVERED', 'BENEFIT_DELIVERED', on);
      if (reach('HANDED_OVER')) step('CLOSE', 'COMPLETED', clampDate(addDays(on, 20)));
    } else if (rng.chance(0.5)) {
      // partially delivered: the first grant only
      const first = await prisma.rREntitlementGrant.findFirst({ where: { caseId }, orderBy: { createdAt: 'asc' } });
      if (first) await prisma.rREntitlementGrant.update({ where: { id: first.id }, data: { status: 'DELIVERED', deliveredOn: clampDate(addDays(awardDate, 35)) } });
    }
    await prisma.rRCase.update({ where: { id: caseId }, data: { status: st as Prisma.RRCaseUpdateInput['status'] } });
  }

  // Compensation
  const fin = actor(ctx.users.finance);
  const compPlan: CompPlan = reach('COMPENSATION_PAID') ? 'PAID' : plan.comp ?? 'APPROVED';
  const approveAt = clampDate(addDays(awardDate, rng.int(6, 20)));
  let paidAt = approveAt;
  for (const [i, c] of comps.entries()) {
    let st: CompensationStatus = 'ASSESSED';
    const step = (event: string, to: CompensationStatus, at: Date, by: SeedActor, context?: Record<string, unknown>) => {
      history.transition({ entityType: 'Compensation', entityId: c.id, event, from: st, to, at, actor: by, context: { parcelId: parcel.id, amountPaise: c.amountPaise, ...context } });
      st = to;
    };
    const payThis = compPlan === 'PAID' || (compPlan === 'PARTIAL' && i === 0);
    if (compPlan === 'ON_HOLD') {
      step('HOLD', 'ON_HOLD', approveAt, col);
    } else if (compPlan !== 'ASSESSED') {
      step('APPROVE', 'APPROVED', approveAt, col);
      if (payThis || compPlan === 'FAILED') {
        const at = clampDate(addDays(approveAt, rng.int(3, 25)));
        paidAt = at > paidAt ? at : paidAt;
        const utr = `SYN${String(rng.int(100000000, 999999999))}${i}`;
        step('INITIATE_PAYMENT', 'INITIATED', at, fin, { gateway: 'PFMS_SYNTHETIC' });
        const ok = compPlan !== 'FAILED';
        await prisma.paymentReference.create({ data: { compensationId: c.id, utrNumber: utr, amountPaise: c.amountPaise, status: ok ? 'SUCCESS' : 'FAILED', transactedAt: at } });
        if (ok) {
          step('CONFIRM_PAID', 'PAID', at, fin, { utrNumber: utr });
          await prisma.compensation.update({ where: { id: c.id }, data: { paidOn: at } });
        } else {
          step('MARK_FAILED', 'FAILED', at, fin);
          await prisma.compensation.update({ where: { id: c.id }, data: { bankAccountLast4: '0000' } });
        }
      }
    }
    await prisma.compensation.update({ where: { id: c.id }, data: { status: st } });
  }

  if (reach('COMPENSATION_PAID')) {
    await move('COMPLETE_PAYMENT', 'COMPENSATION_PAID', paidAt, SYSTEM, { reason: 'Last beneficiary paid' });
  }
  if (reach('POSSESSION_TAKEN')) {
    const takenOn = clampDate(addDays(paidAt, rng.int(20, 60)));
    const pos = await prisma.possession.create({ data: { projectId: args.projectId, parcelId: parcel.id, status: 'POSSESSION_TAKEN', takenOn, authority: 'Collector (seed)' } });
    await move('TAKE_POSSESSION', 'POSSESSION_TAKEN', takenOn, col, { takenOn });
    history.transition({ entityType: 'Possession', entityId: pos.id, event: 'TAKE', from: 'ELIGIBLE', to: 'POSSESSION_TAKEN', at: takenOn, actor: col });
    if (reach('HANDED_OVER')) {
      const handedOverOn = clampDate(addDays(takenOn, rng.int(7, 30)));
      await prisma.possession.update({ where: { id: pos.id }, data: { status: 'HANDED_TO_PIA', handedOverOn } });
      await move('HAND_OVER', 'HANDED_OVER', handedOverOn, col);
      history.transition({ entityType: 'Possession', entityId: pos.id, event: 'HAND_OVER', from: 'POSSESSION_TAKEN', to: 'HANDED_TO_PIA', at: handedOverOn, actor: col });
    }
  } else if (reach('COMPENSATION_PAID')) {
    await prisma.possession.create({ data: { projectId: args.projectId, parcelId: parcel.id, status: 'ELIGIBLE' } });
  }

  await prisma.parcel.update({ where: { id: parcel.id }, data: { stage, acquiredAreaHa: reach('AWARDED') ? args.areaHa : 0 } });
  return { id: parcel.id, parcelNumber: parcel.parcelNumber, projectId: args.projectId, districtCode: args.district.code };
}

// ---------------------------------------------------------------------------

async function seedMainProject(ctx: Ctx) {
  const { prisma, rng, history } = ctx;
  const nhai = await prisma.organization.findUniqueOrThrow({ where: { code: 'NHAI' } });
  const project = await prisma.project.create({
    data: {
      code: 'NH-WY-4L',
      name: 'Wardha–Yavatmal 4-Lane Highway',
      sector: 'Roads',
      description: 'Upgrade of the Wardha–Yavatmal corridor to 4 lanes with paved shoulders (SYNTHETIC demonstration project).',
      stateCode: 'MH',
      stateName: 'Maharashtra',
      districtCodes: ['MH-WRD', 'MH-YTL'],
      districtNames: ['Wardha', 'Yavatmal'],
      piaOrgId: nhai.id,
      piaName: 'National Highways Authority of India (synthetic record)',
      requiredAreaHa: 0,
      estimatedCostPaise: rupeesToPaise(18_400_000_000),
      status: 'ACTIVE',
      alignment: { type: 'LineString', coordinates: [WARDHA, YAVATMAL] },
    },
  });
  history.audit({ action: 'PROJECT_CREATED', entityType: 'Project', entityId: project.id, at: parseIstDate('2024-12-02'), actor: actor(ctx.users.pia), newState: { code: project.code } });
  for (const [event, from, to, at, by] of [
    ['SUBMIT', 'DRAFT', 'SUBMITTED', '2024-12-02', ctx.users.pia],
    ['START_SCRUTINY', 'SUBMITTED', 'UNDER_SCRUTINY', '2024-12-20', ctx.users.stateOfficer],
    ['APPROVE', 'UNDER_SCRUTINY', 'APPROVED', '2025-03-18', ctx.users.stateAdmin],
    ['ACTIVATE', 'APPROVED', 'ACTIVE', '2025-04-02', ctx.users.stateAdmin],
  ] as const) {
    history.transition({ entityType: 'Project', entityId: project.id, event, from, to, at: parseIstDate(at), actor: actor(by) });
  }

  // Notices per district
  const wardhaSia = await prisma.statutoryNotice.create({ data: { projectId: project.id, kind: NoticeKind.SEC_4_SIA, referenceNo: 'SIA/WRD/4/2024/11', gazetteRef: 'Notification of SIA study, s.4(2) (synthetic ref)', publishedOn: DATES.wardhaSia } });
  const ytlSia = await prisma.statutoryNotice.create({ data: { projectId: project.id, kind: NoticeKind.SEC_4_SIA, referenceNo: 'SIA/YTL/4/2025/04', gazetteRef: 'Notification of SIA study, s.4(2) (synthetic ref)', publishedOn: DATES.yavatmalSia } });
  const wardhaSec11 = await prisma.statutoryNotice.create({ data: { projectId: project.id, kind: NoticeKind.SEC_11_PRELIMINARY, referenceNo: 'LAQ/WRD/11/2025/03', gazetteRef: 'Maharashtra Government Gazette (synthetic ref)', publishedOn: DATES.wardhaSec11 } });
  const wardhaSec19 = await prisma.statutoryNotice.create({ data: { projectId: project.id, kind: NoticeKind.SEC_19_DECLARATION, referenceNo: 'LAQ/WRD/19/2026/01', gazetteRef: 'Maharashtra Government Gazette (synthetic ref)', publishedOn: DATES.wardhaSec19 } });
  const ytlSec11 = await prisma.statutoryNotice.create({ data: { projectId: project.id, kind: NoticeKind.SEC_11_PRELIMINARY, referenceNo: 'LAQ/YTL/11/2025/09', gazetteRef: 'Maharashtra Government Gazette (synthetic ref)', publishedOn: DATES.yavatmalSec11 } });
  const ytlSec19 = await prisma.statutoryNotice.create({ data: { projectId: project.id, kind: NoticeKind.SEC_19_DECLARATION, referenceNo: 'LAQ/YTL/19/2026/02', gazetteRef: 'Maharashtra Government Gazette (synthetic ref)', publishedOn: DATES.yavatmalSec19 } });
  for (const n of [wardhaSia, ytlSia, wardhaSec11, wardhaSec19, ytlSec11, ytlSec19]) {
    history.audit({ action: `NOTICE_PUBLISHED_${n.kind}`, entityType: 'StatutoryNotice', entityId: n.id, at: n.publishedOn, actor: actor(n.referenceNo.includes('WRD') ? ctx.users.collectorWardha : ctx.users.collectorYavatmal), newState: { referenceNo: n.referenceNo } });
  }

  // Wardha plan: most parcels well along; a few deliberately stuck.
  const wardhaPlans: ParcelPlan[] = [
    ...Array(10).fill({ target: 'HANDED_OVER' }),
    ...Array(11).fill({ target: 'POSSESSION_TAKEN' }),
    ...Array(8).fill({ target: 'COMPENSATION_PAID', rrDelivered: true }),
    ...Array(7).fill({ target: 'AWARDED', comp: 'APPROVED' }),
    ...Array(4).fill({ target: 'AWARDED', comp: 'ASSESSED' }),
    ...Array(3).fill({ target: 'AWARDED', comp: 'PARTIAL' }),
    ...Array(2).fill({ target: 'AWARDED', comp: 'FAILED' }),
    ...Array(3).fill({ target: 'DECLARED' }),
  ];
  // Deterministic shuffle
  for (let i = wardhaPlans.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [wardhaPlans[i], wardhaPlans[j]] = [wardhaPlans[j], wardhaPlans[i]];
  }
  const ytlPlanFor = (villageCode: string, idx: number): ParcelPlan => {
    if (villageCode === 'MH-YTL-WDG' || villageCode === 'MH-YTL-DHN') return { target: 'PRELIM_NOTIFIED' };
    if (villageCode === 'MH-YTL-KLB' && idx < 4) return { target: 'AWARDED', comp: idx < 2 ? 'APPROVED' : 'ASSESSED' };
    return { target: 'DECLARED' };
  };

  const overrides: Record<string, ParcelPlan> = {
    [STORY.forestParcel]: { target: 'DECLARED', families: 3, displaced: true },
    [STORY.nameMismatchParcel]: { target: 'AWARDED', comp: 'ON_HOLD', families: 2 },
    [STORY.courtCaseParcel]: { target: 'DECLARED', families: 2 },
    [STORY.livePayParcel]: { target: 'AWARDED', comp: 'APPROVED', displaced: false },
    [STORY.livePossessionParcel]: { target: 'COMPENSATION_PAID', rrDelivered: true, displaced: true },
    [STORY.rrBlockedParcel]: { target: 'COMPENSATION_PAID', rrDelivered: false, displaced: true, families: 4 },
  };

  const totalKm = 82;
  const perParcelKm = totalKm / MAIN_VILLAGES.reduce((s, v) => s + v.parcels, 0);
  let km = 0.4;
  let wIdx = 0;
  const built: BuiltParcel[] = [];
  let requiredArea = 0;

  for (const v of MAIN_VILLAGES) {
    const isWardha = v.district === 'MH-WRD';
    const district = { code: v.district, name: isWardha ? 'Wardha' : 'Yavatmal' };
    const collector = isWardha ? ctx.users.collectorWardha : ctx.users.collectorYavatmal;
    const prefix = `${isWardha ? 'WRD' : 'YTL'}-${v.code.split('-')[2]}`;
    for (let i = 1; i <= v.parcels; i++) {
      const parcelNumber = `${prefix}-${String(i).padStart(3, '0')}`;
      // Highway strips: 120–300 m long, 50–70 m wide → roughly 0.6–2.1 ha.
      const len = rng.float(0.12, 0.3);
      const width = rng.float(0.025, 0.035);
      const { geometry, areaHa } = corridorRect(WARDHA, YAVATMAL, km, km + len, width, width);
      km += perParcelKm;
      requiredArea += areaHa;

      let plan: ParcelPlan = isWardha ? wardhaPlans[wIdx++ % wardhaPlans.length] : ytlPlanFor(v.code, i);
      if (overrides[parcelNumber]) plan = overrides[parcelNumber];

      let holders: Array<{ personId: string; name: string; share: number }> | undefined;
      if (parcelNumber === STORY.nameMismatchParcel) {
        // Land record in Devanagari; the award register spells the same man in Latin.
        const deva = await makePerson(ctx, v.code, {
          name: `${TO_DEVA.Ramkumar} ${TO_DEVA.Bhaurao} ${TO_DEVA.Wankhede}`,
          nameScript: 'Deva',
          fatherName: `${TO_DEVA.Bhaurao} ${TO_DEVA.Wankhede}`,
          phone: '9800000003',
        });
        const other = await makePerson(ctx, v.code);
        holders = [
          { personId: deva.id, name: deva.name, share: 60 },
          { personId: other.id, name: other.name, share: 40 },
        ];
      }
      if (parcelNumber === STORY.livePossessionParcel) {
        const citizen = await makePerson(ctx, v.code, { name: 'Sunita Maroti Bhoyar', fatherName: 'Maroti Bhoyar', phone: '9800000001', gender: 'F' });
        holders = [{ personId: citizen.id, name: citizen.name, share: 100 }];
      }
      if (parcelNumber === STORY.forestParcel) {
        const citizen = await makePerson(ctx, v.code, { name: 'Namdeo Dadarao Meshram', fatherName: 'Dadarao Meshram', phone: '9800000002' });
        holders = [{ personId: citizen.id, name: citizen.name, share: 100 }];
      }

      const p = await buildParcel(ctx, {
        projectId: project.id,
        parcelNumber,
        surveyNumber: `${rng.int(12, 480)}/${rng.int(1, 6)}`,
        village: { code: v.code, name: v.name },
        district,
        state: { code: 'MH', name: 'Maharashtra' },
        geometry,
        areaHa,
        ratePerHa: isWardha ? rng.int(90, 160) * 10_000 : rng.int(70, 120) * 10_000,
        distanceKm: rng.int(4, 38),
        landClass: parcelNumber === STORY.forestParcel ? 'Agricultural (dry), abutting forest' : rng.pick(['Agricultural (irrigated)', 'Agricultural (dry)', 'Agricultural (dry)', 'Horticulture']),
        notices: isWardha
          ? { sia: { id: wardhaSia.id, date: DATES.wardhaSia }, sec11: { id: wardhaSec11.id, date: DATES.wardhaSec11 }, sec19: { id: wardhaSec19.id, date: DATES.wardhaSec19 } }
          : {
              sia: { id: ytlSia.id, date: DATES.yavatmalSia },
              sec11: { id: ytlSec11.id, date: DATES.yavatmalSec11 },
              sec19: v.code === 'MH-YTL-WDG' || v.code === 'MH-YTL-DHN' ? undefined : { id: ytlSec19.id, date: DATES.yavatmalSec19 },
            },
        plan,
        collector,
        holders,
        ulpin: `27${String(rng.int(100000000000, 999999999999))}`,
      });
      built.push(p);
    }
  }

  requiredArea += await seedUrgencyParcels(ctx, project.id, perParcelKm, { sia: { id: wardhaSia.id, date: DATES.wardhaSia }, sec11: { id: wardhaSec11.id, date: DATES.wardhaSec11 } });
  await prisma.project.update({ where: { id: project.id }, data: { requiredAreaHa: Math.round(requiredArea * 100) / 100 } });

  // The Latin-script record of the name-mismatch owner, created by the award register.
  const nm = built.find((b) => b.parcelNumber === STORY.nameMismatchParcel)!;
  const latin = await prisma.person.create({
    data: { name: 'Ramkumar B. Wankhede', nameScript: 'Latn', fatherName: 'Bhaurao Wankhede', villageCode: 'MH-WRD-SLK', source: 'AWARD', idHash: hashId('award-register-wankhede') },
  });
  const devaComp = await prisma.compensation.findFirstOrThrow({ where: { parcelId: nm.id, person: { nameScript: 'Deva' } } });
  await prisma.compensation.update({ where: { id: devaComp.id }, data: { personId: latin.id, beneficiaryName: latin.name } });
  history.audit({
    action: 'COMPENSATION_HELD_IDENTITY',
    entityType: 'Compensation',
    entityId: devaComp.id,
    at: parseIstDate('2026-06-02'),
    actor: actor(ctx.users.collectorWardha),
    reason: 'Beneficiary name in award register (Latin) does not match 7/12 extract (Devanagari); identity to be reconciled before payment.',
  });

  // Objections: Wadgaon (pending, hearing next week), Babhulgaon (title suit, escalated), Wardha (historical, resolved)
  const objectionFor = async (parcelNumber: string, category: string, description: string, status: 'HEARING_SCHEDULED' | 'ESCALATED' | 'RESOLVED', filedOn: string, hearing?: { at: string; held: boolean }) => {
    const p = built.find((b) => b.parcelNumber === parcelNumber)!;
    const holder = await prisma.parcelHolder.findFirstOrThrow({ where: { parcelId: p.id } });
    const o = await prisma.objection.create({ data: { parcelId: p.id, applicant: holder.nameAsRecorded, category, description, filedOn: parseIstDate(filedOn), status } });
    const by = p.districtCode === 'MH-WRD' ? ctx.users.collectorWardha : ctx.users.collectorYavatmal;
    history.audit({ action: 'OBJECTION_FILED', entityType: 'Objection', entityId: o.id, at: parseIstDate(filedOn), actor: SYSTEM, newState: { category } });
    let st = 'SUBMITTED';
    if (hearing) {
      const h = await prisma.hearing.create({
        data: {
          objectionId: o.id,
          scheduledAt: new Date(parseIstDate(hearing.at).getTime() + 11 * 3600_000),
          venue: `Collectorate, ${p.districtCode === 'MH-WRD' ? 'Wardha' : 'Yavatmal'}`,
          presidingOfficer: p.districtCode === 'MH-WRD' ? 'Sub-Divisional Officer (LA), Wardha' : 'Sub-Divisional Officer (LA), Yavatmal',
          status: hearing.held ? 'HELD' : 'SCHEDULED',
          outcome: hearing.held ? 'Objector heard; measurement re-verified on site.' : null,
        },
      });
      history.transition({ entityType: 'Objection', entityId: o.id, event: 'SCHEDULE_HEARING', from: st, to: 'HEARING_SCHEDULED', at: addDays(parseIstDate(filedOn), 10), actor: actor(by) });
      st = 'HEARING_SCHEDULED';
      if (hearing.held) history.transition({ entityType: 'Hearing', entityId: h.id, event: 'RECORD_HELD', from: 'SCHEDULED', to: 'HELD', at: parseIstDate(hearing.at), actor: actor(by) });
    }
    if (status === 'ESCALATED') history.transition({ entityType: 'Objection', entityId: o.id, event: 'ESCALATE', from: st, to: 'ESCALATED', at: addDays(parseIstDate(filedOn), 40), actor: actor(by) });
    if (status === 'RESOLVED') history.transition({ entityType: 'Objection', entityId: o.id, event: 'RESOLVE', from: st, to: 'RESOLVED', at: addDays(parseIstDate(hearing!.at), 5), actor: actor(by) });
  };
  await objectionFor('YTL-WDG-002', 'MEASUREMENT', 'The notified area includes my well and 0.12 ha more than the actual strip required.', 'HEARING_SCHEDULED', '2025-12-18', { at: '2026-10-07', held: false });
  await objectionFor('YTL-WDG-005', 'COMPENSATION_AMOUNT', 'Guideline rate used is from 2023; recent sale deeds in the village are higher.', 'HEARING_SCHEDULED', '2025-12-22', { at: '2026-10-07', held: false });
  await objectionFor('YTL-DHN-003', 'PUBLIC_PURPOSE', 'Alignment could shift 40 m east onto government land and spare our orchard.', 'HEARING_SCHEDULED', '2025-12-29', { at: '2026-10-09', held: false });
  await objectionFor(STORY.courtCaseParcel, 'TITLE', 'Title disputed between brothers; partition suit pending before the Civil Judge (Senior Division), Yavatmal.', 'ESCALATED', '2025-12-10', { at: '2026-01-20', held: true });
  await objectionFor('WRD-SWG-002', 'MEASUREMENT', 'Boundary stone position disputed with the neighbour.', 'RESOLVED', '2025-07-02', { at: '2025-07-25', held: true });

  // SLA tasks (administrative, not statutory)
  const sla = [
    ['Joint measurement survey: Wadgaon & Dhanora', RoleName.FIELD_OFFICER, 30, '2025-11-20', null],
    ['Draft s.19 declaration: Wadgaon & Dhanora', RoleName.DISTRICT_OFFICER, 45, '2026-08-20', null],
    ['R&R plan approval: Wardha displaced families', RoleName.RR_OFFICER, 30, '2026-05-01', '2026-05-26'],
    ['Fund requisition to PIA for Yavatmal awards', RoleName.FINANCE_OFFICER, 21, '2026-08-25', null],
  ] as const;
  for (const [taskName, role, days, start, done] of sla) {
    const s = parseIstDate(start);
    await prisma.sLATask.create({
      data: { projectId: project.id, taskName, assignedRole: role, slaDays: days, startDate: s, targetDate: addDays(s, days), completedDate: done ? parseIstDate(done) : null },
    });
  }

  return project;
}

async function seedOtherProject(ctx: Ctx, spec: OtherProject) {
  const { prisma, rng, history } = ctx;
  const project = await prisma.project.create({
    data: {
      code: spec.code,
      name: spec.name,
      sector: spec.sector,
      description: 'SYNTHETIC demonstration project.',
      stateCode: spec.stateCode,
      stateName: spec.stateName,
      districtCodes: [spec.district.code],
      districtNames: [spec.district.name],
      piaName: spec.pia,
      requiredAreaHa: 0,
      estimatedCostPaise: rupeesToPaise(rng.int(20, 90) * 100_000_000),
      status: 'ACTIVE',
      alignment: { type: 'LineString', coordinates: [spec.from, spec.to] },
    },
  });
  history.transition({ entityType: 'Project', entityId: project.id, event: 'ACTIVATE', from: 'APPROVED', to: 'ACTIVE', at: addDays(parseIstDate(spec.sec11), -30), actor: actor(ctx.users.central) });
  const collector = ctx.users[`collector:${spec.district.code}`];
  const sia = await prisma.statutoryNotice.create({ data: { projectId: project.id, kind: 'SEC_4_SIA', referenceNo: `SIA/${spec.district.code}/4`, publishedOn: addDays(parseIstDate(spec.sec11), -150) } });
  const sec11 = await prisma.statutoryNotice.create({ data: { projectId: project.id, kind: 'SEC_11_PRELIMINARY', referenceNo: `LAQ/${spec.district.code}/11`, publishedOn: parseIstDate(spec.sec11) } });
  const sec19 = spec.sec19 ? await prisma.statutoryNotice.create({ data: { projectId: project.id, kind: 'SEC_19_DECLARATION', referenceNo: `LAQ/${spec.district.code}/19`, publishedOn: parseIstDate(spec.sec19) } }) : null;

  const stages: ParcelStage[] = ['PRELIM_NOTIFIED', 'DECLARED', 'AWARDED', 'COMPENSATION_PAID', 'POSSESSION_TAKEN', 'HANDED_OVER'];
  const n = spec.villages.length * rng.int(5, 7);
  const kmTotal = 12;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const village = spec.villages[Math.floor((i / n) * spec.villages.length)];
    const len = Math.min((kmTotal / n) * 0.9, rng.float(0.12, 0.35));
    const { geometry, areaHa } = corridorRect(spec.from, spec.to, (kmTotal / n) * i + 0.2, (kmTotal / n) * i + 0.2 + len, 0.03, 0.03);
    area += areaHa;
    // maturity skews parcels towards later stages
    const idx = Math.min(stages.length - 1, Math.max(0, Math.round(rng.float(0, 1) * (stages.length - 1) * (0.4 + spec.maturity * 0.8))));
    let target = stages[idx];
    if (!sec19 && target !== 'PRELIM_NOTIFIED') target = 'PRELIM_NOTIFIED';
    await buildParcel(ctx, {
      projectId: project.id,
      parcelNumber: `${spec.district.code.split('-')[1]}-${village.code.split('-')[2]}-${String(i + 1).padStart(3, '0')}`,
      surveyNumber: `${rng.int(10, 600)}`,
      village,
      district: spec.district,
      state: { code: spec.stateCode, name: spec.stateName },
      geometry,
      areaHa,
      ratePerHa: rng.int(spec.ratePerHa[0], spec.ratePerHa[1]),
      distanceKm: rng.int(3, 40),
      landClass: rng.pick(['Agricultural (dry)', 'Agricultural (irrigated)', 'Barren', 'Horticulture']),
      notices: { sia: { id: sia.id, date: sia.publishedOn }, sec11: { id: sec11.id, date: sec11.publishedOn }, sec19: sec19 ? { id: sec19.id, date: sec19.publishedOn } : undefined },
      plan: { target, comp: rng.pick(['APPROVED', 'ASSESSED', 'APPROVED', 'PARTIAL'] as const) },
      collector,
    });
  }
  await prisma.project.update({ where: { id: project.id }, data: { requiredAreaHa: Math.round(area * 100) / 100 } });
}

/** Citizen logins linked to the story's land holders (OTP login by phone). */
async function seedCitizenLogins(ctx: Ctx) {
  const { prisma } = ctx;
  const citizens = await prisma.person.findMany({ where: { phone: { in: ['9800000001', '9800000002', '9800000003'] } }, orderBy: { phone: 'asc' } });
  for (const p of citizens) {
    await prisma.user.create({
      data: {
        email: `citizen.${p.phone}${DEMO_DOMAIN}`,
        name: p.name,
        phone: p.phone,
        role: RoleName.CITIZEN,
        designation: 'Land holder',
        personId: p.id,
        jurisdictionId: p.villageCode ? ctx.jur[p.villageCode]?.id : undefined,
      },
    });
  }
}

/** Statutory clocks for every parcel, computed exactly as StatutoryService does at runtime. */
async function seedClocks(prisma: PrismaClient) {
  const rules = new RulesService(prisma as unknown as PrismaService);
  const parcels = await prisma.parcel.findMany({ include: parcelInclude });
  const now = new Date();
  let n = 0;
  for (const p of parcels) {
    const resolver = await rules.resolverFor(p.stateCode);
    for (const c of computeClocks(factsOf(p), resolver, now)) {
      await prisma.statutoryClock.create({ data: { ...c, parcelId: p.id, projectId: p.projectId, districtCode: p.districtCode, stateCode: p.stateCode } });
      n++;
    }
  }
  return n;
}

/**
 * s.40 urgency: four parcels for the Wardha river-bridge approach were taken
 * on 20 Aug 2025 under an urgency direction, before their award. The award came
 * later; the first holder of each was paid, the co-holders were not, so s.80
 * interest has run on their shares since possession (15% after one year).
 */
async function seedUrgencyParcels(ctx: Ctx, projectId: string, perParcelKm: number, base: NoticeSet): Promise<number> {
  const { prisma, rng, history } = ctx;
  const col = actor(ctx.users.collectorWardha);
  const fin = actor(ctx.users.finance);
  const declaredOn = parseIstDate('2025-07-15');
  const possessionOn = parseIstDate('2025-08-20');
  const awardOn = parseIstDate('2025-12-10');
  const firstPaidOn = parseIstDate('2026-01-05');
  const orderRef = 'GoM RFD urgency direction LAQ-2025/URG/07 (synthetic)';

  const sec19 = await prisma.statutoryNotice.create({
    data: { projectId, kind: NoticeKind.SEC_19_DECLARATION, referenceNo: 'LAQ/WRD/19/2025/URG', gazetteRef: 's.19 declaration under s.40(4) direction (synthetic ref)', publishedOn: declaredOn },
  });
  history.audit({ action: 'NOTICE_PUBLISHED_SEC_19_DECLARATION', entityType: 'StatutoryNotice', entityId: sec19.id, at: declaredOn, actor: col, newState: { referenceNo: sec19.referenceNo, urgency: true } });

  let area = 0;
  const villageStart = 0.4 + 24 * perParcelKm; // Borgaon stretch
  for (let i = 0; i < 4; i++) {
    const start = villageStart + i * perParcelKm + 0.42; // in the gaps between regular parcels
    const { geometry, areaHa } = corridorRect(WARDHA, YAVATMAL, start, start + rng.float(0.15, 0.25), 0.03, 0.03);
    area += areaHa;
    const holders: Array<{ personId: string; name: string; share: number }> = [];
    for (const share of [60, 40]) {
      const person = await makePerson(ctx, 'MH-WRD-BRG');
      holders.push({ personId: person.id, name: person.name, share });
    }
    const built = await buildParcel(ctx, {
      projectId,
      parcelNumber: `WRD-BRG-${101 + i}`,
      surveyNumber: `${rng.int(300, 380)}/${rng.int(1, 4)}`,
      village: { code: 'MH-WRD-BRG', name: 'Borgaon' },
      district: { code: 'MH-WRD', name: 'Wardha' },
      state: { code: 'MH', name: 'Maharashtra' },
      geometry,
      areaHa,
      ratePerHa: rng.int(110, 150) * 10_000,
      distanceKm: rng.int(8, 14),
      landClass: 'Agricultural (irrigated), river bank',
      notices: { ...base, sec19: { id: sec19.id, date: declaredOn } },
      plan: { target: 'DECLARED', displaced: false, families: 2 },
      collector: ctx.users.collectorWardha,
      holders,
      ulpin: `27${String(rng.int(100000000000, 999999999999))}`,
    });
    const parcel = await prisma.parcel.update({ where: { id: built.id }, data: { urgencyOrderRef: orderRef } });

    // Possession first (s.40), then the award.
    const pos = await prisma.possession.create({ data: { projectId, parcelId: parcel.id, status: 'POSSESSION_TAKEN', takenOn: possessionOn, authority: 'Collector, Wardha (s.40)' } });
    history.transition({ entityType: 'Parcel', entityId: parcel.id, event: 'TAKE_POSSESSION_URGENCY', from: 'DECLARED', to: 'POSSESSION_TAKEN', at: possessionOn, actor: col, context: { urgencyOrderRef: orderRef } });
    history.transition({ entityType: 'Possession', entityId: pos.id, event: 'TAKE', from: 'ELIGIBLE', to: 'POSSESSION_TAKEN', at: possessionOn, actor: col });

    const { rules, packCode, packs, unverified } = await ctx.rules.awardRules({ stateCode: 'MH', isRural: true, distanceFromUrbanKm: parcel.distanceFromUrbanKm }, awardOn);
    // s.30(3): the additional amount stops at possession, which came before the award.
    const b = calculateAward({ areaHa, marketRatePaisePerHa: parcel.marketRatePaisePerHa!, assetsValuePaise: 0n, additionalFrom: base.sia!.date, cutoffDate: possessionOn }, rules);
    const seq = (ctx.counters.award['MH-WRD'] = (ctx.counters.award['MH-WRD'] ?? 0) + 1);
    const award = await prisma.award.create({
      data: {
        awardNumber: `AWD/MH-WRD/2025/${String(seq).padStart(4, '0')}`,
        projectId,
        parcelId: parcel.id,
        awardDate: awardOn,
        marketValuePaise: b.marketValuePaise,
        multiplier: new Prisma.Decimal(b.multiplier),
        assetsValuePaise: 0n,
        solatiumPaise: b.solatiumPaise,
        additionalAmountPaise: b.additionalAmountPaise,
        totalPaise: b.totalPaise,
        calculation: JSON.parse(JSON.stringify({ ...b, packCode, packs, unverified, additionalFrom: base.sia!.date, additionalFromEvent: 'SEC_4_SIA', cutoff: 'possession (s.30(3), earlier than award)' }, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))),
      },
    });
    history.audit({ action: 'AWARD_DECLARED_AFTER_URGENCY_POSSESSION', entityType: 'Award', entityId: award.id, at: awardOn, actor: col, newState: { awardNumber: award.awardNumber, totalPaise: award.totalPaise } });
    const shares = splitByShare(b.totalPaise, holders.map((h) => ({ ...h, sharePct: h.share })));
    for (const [j, sh] of shares.entries()) {
      const c = await prisma.compensation.create({
        data: { projectId, parcelId: parcel.id, awardId: award.id, personId: sh.personId, beneficiaryName: sh.name, sharePct: sh.share, amountPaise: sh.amountPaise, bankAccountLast4: String(rng.int(1000, 9999)), createdAt: awardOn },
      });
      history.transition({ entityType: 'Compensation', entityId: c.id, event: 'APPROVE', from: 'ASSESSED', to: 'APPROVED', at: addDays(awardOn, 10), actor: col });
      if (j === 0) {
        const utr = `SYN${rng.int(100000000, 999999999)}U`;
        await prisma.paymentReference.create({ data: { compensationId: c.id, utrNumber: utr, amountPaise: c.amountPaise, transactedAt: firstPaidOn } });
        history.transition({ entityType: 'Compensation', entityId: c.id, event: 'INITIATE_PAYMENT', from: 'APPROVED', to: 'INITIATED', at: firstPaidOn, actor: fin });
        history.transition({ entityType: 'Compensation', entityId: c.id, event: 'CONFIRM_PAID', from: 'INITIATED', to: 'PAID', at: firstPaidOn, actor: fin, context: { utrNumber: utr } });
        await prisma.compensation.update({ where: { id: c.id }, data: { status: 'PAID', paidOn: firstPaidOn } });
      } else {
        await prisma.compensation.update({ where: { id: c.id }, data: { status: 'APPROVED' } });
      }
    }
    await prisma.parcel.update({ where: { id: parcel.id }, data: { stage: 'POSSESSION_TAKEN', acquiredAreaHa: areaHa } });
  }
  return area;
}

type Pt = [number, number];
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
const mid = (a: Pt, b: Pt): Pt => mul(add(a, b), 0.5);
const poly = (pts: Pt[]) => ({ type: 'Polygon', coordinates: [[...pts, pts[0]].map(([x, y]) => [Math.round(x * 1e7) / 1e7, Math.round(y * 1e7) / 1e7])] });

/** Store a small real PDF and register it as a document on a parcel. */
async function seedDocument(ctx: Ctx, parcelId: string, projectId: string, kind: 'GRAM_SABHA_CONSENT' | 'FOREST_CLEARANCE' | 'FRA_SETTLEMENT_CERTIFICATE', title: string, referenceNo: string, issuedOn: Date, lines: string[]) {
  const storage = new LocalDiskStorage();
  const key = `documents/seed/${referenceNo.replace(/[^A-Za-z0-9-]/g, '_')}.pdf`;
  const stored = await storage.put(key, makePdf(title, [`Reference: ${referenceNo}`, `Issued: ${issuedOn.toISOString().slice(0, 10)}`, ...lines]));
  const doc = await ctx.prisma.document.create({
    data: { kind, title, fileName: key.split('/').pop()!, storageBackend: stored.backend, storageKey: key, sha256: stored.sha256, mimeType: 'application/pdf', sizeBytes: stored.sizeBytes, parcelId, projectId, referenceNo, issuedOn, uploadedById: ctx.users.collectorYavatmal.id },
  });
  ctx.history.audit({ action: 'DOCUMENT_UPLOADED', entityType: 'Document', entityId: doc.id, at: issuedOn, actor: actor(ctx.users.collectorYavatmal), newState: { kind, sha256: stored.sha256, parcelId, referenceNo } });
  return doc;
}

/**
 * Synthetic constraint layers drawn around the story parcels:
 * - a reserved forest covering half of YTL-KRS-004 (blocks its award),
 * - a pending FRA claim over a quarter of the same parcel,
 * - a Scheduled Area over YTL-DHN-006, whose Gram Sabha consent is on file,
 * - a wildlife sanctuary buffer away from the alignment (context only).
 */
async function seedConstraintLayers(ctx: Ctx) {
  const { prisma } = ctx;
  const ring = async (parcelNumber: string) => {
    const p = await prisma.parcel.findFirstOrThrow({ where: { parcelNumber } });
    const g = p.geometry as { coordinates: Pt[][] };
    const [A, B, C, D] = g.coordinates[0] as Pt[]; // start-left, end-left, end-right, start-right
    return { p, A, B, C, D };
  };

  const f = await ring(STORY.forestParcel);
  const along = sub(f.B, f.A);
  const left = sub(f.A, f.D);
  const M0 = mid(f.A, f.D);
  const M1 = mid(f.B, f.C);
  const forest = poly([add(M0, mul(along, -1.5)), add(M1, mul(along, 1.3)), add(add(M1, mul(along, 1.6)), mul(left, 22)), add(add(mid(M0, M1), mul(left, 30)), mul(along, 0.2)), add(add(M0, mul(along, -1.8)), mul(left, 25))]);
  const fraClaim = poly([add(M0, mul(along, -0.4)), mid(M0, M1), add(mid(M0, M1), mul(left, 4)), add(add(M0, mul(along, -0.4)), mul(left, 4))]);

  const s = await ring('YTL-DHN-006');
  const sAlong = sub(s.B, s.A);
  const sLeft = sub(s.A, s.D);
  const scheduled = poly([add(add(s.D, mul(sAlong, -2)), mul(sLeft, -8)), add(add(s.C, mul(sAlong, 2)), mul(sLeft, -8)), add(add(s.B, mul(sAlong, 2)), mul(sLeft, 12)), add(add(s.A, mul(sAlong, -2)), mul(sLeft, 12))]);

  const layers = [
    { code: 'MH-YTL-RF-KHARSHI', kind: 'FOREST' as const, name: 'Kharshi Reserved Forest, compartment 214', source: 'Synthetic, modelled on a forest compartment map' , geometry: forest },
    { code: 'MH-YTL-FRA-KHARSHI-07', kind: 'FRA_CLAIM' as const, name: 'Community forest-rights claim CFR/KHR/07 (pending)', source: 'Synthetic, modelled on a Sub-Divisional Level Committee register', geometry: fraClaim },
    { code: 'MH-YTL-SA-DHANORA', kind: 'SCHEDULED_AREA' as const, name: 'Scheduled Area, Dhanora cluster (Fifth Schedule)', source: 'Synthetic, illustrative boundary', geometry: scheduled },
    { code: 'MH-YTL-PA-ESZ', kind: 'PROTECTED_AREA' as const, name: 'Wildlife sanctuary eco-sensitive zone (illustrative)', source: 'Synthetic', geometry: { type: 'Polygon', coordinates: [[[78.28, 20.36], [78.36, 20.36], [78.36, 20.42], [78.28, 20.42], [78.28, 20.36]]] } },
  ];
  for (const l of layers) {
    await prisma.constraintLayer.create({ data: { ...l, isSynthetic: true, geometry: l.geometry as Prisma.InputJsonValue } });
  }
  await screenParcels(prisma);

  // The Scheduled Area parcel already has its Gram Sabha consent on file.
  await seedDocument(ctx, s.p.id, s.p.projectId, 'GRAM_SABHA_CONSENT', 'Gram Sabha resolution: consent to acquisition', 'GS/DHN/2025/11', parseIstDate('2025-10-20'), [
    'Gram Sabha, Dhanora, meeting of 20 Oct 2025',
    'Resolution 11: consent under s.41(3) RFCTLARR 2013 to acquisition of',
    `survey no. ${s.p.surveyNumber} for the Wardha-Yavatmal highway.`,
    'Quorum present; resolution passed.',
  ]);
}
