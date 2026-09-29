import { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Where citizen grievances are lodged. The real CPGRAMS integration needs an
 * onboarding agreement with DARPG; until then the synthetic adapter issues
 * numbers in the CPGRAMS pattern, clearly marked SYN.
 */
export interface GrievanceAdapter {
  readonly channel: string;
  lodge(db: Db, g: { category: string; description: string }, now: Date): Promise<{ registrationNo: string }>;
}

export class SyntheticCpgramsAdapter implements GrievanceAdapter {
  readonly channel = 'CPGRAMS_SYNTHETIC';
  async lodge(db: Db, _g: { category: string; description: string }, now: Date) {
    const year = now.getUTCFullYear();
    const n = (await db.grievance.count({ where: { registrationNo: { startsWith: `DOLR/SYN/${year}/` } } })) + 1;
    return { registrationNo: `DOLR/SYN/${year}/${String(n).padStart(7, '0')}` };
  }
}

/**
 * Where a citizen's documents are issued. DigiLocker issuance needs issuer
 * registration; the synthetic adapter returns a URI marking the issue as
 * synthetic, bound to the document's SHA-256.
 */
export interface DigiLockerAdapter {
  readonly channel: string;
  issue(doc: { id: string; sha256: string; kind: string }, holderRef: string): Promise<{ uri: string }>;
}

export class SyntheticDigiLockerAdapter implements DigiLockerAdapter {
  readonly channel = 'DIGILOCKER_SYNTHETIC';
  async issue(doc: { id: string; sha256: string; kind: string }, holderRef: string) {
    return { uri: `digilocker-synthetic://in.gov.dolr.rnlam/${doc.kind.toLowerCase()}/${doc.sha256.slice(0, 16)}?holder=${holderRef.slice(0, 8)}` };
  }
}

export const GRIEVANCE_ADAPTER = Symbol('GRIEVANCE_ADAPTER');
export const DIGILOCKER_ADAPTER = Symbol('DIGILOCKER_ADAPTER');
