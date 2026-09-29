import { CompensationStatus, EntitlementStatus, NoticeKind, ObjectionStatus } from '@prisma/client';
import { Blocker, Guard, GuardContext } from './lifecycle.types';

const OPEN_OBJECTION: ObjectionStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'HEARING_SCHEDULED', 'ESCALATED'];

/** s.15 objections must be heard and disposed of before the s.19 declaration and the award. */
export const noOpenObjections: Guard = {
  name: 'noOpenObjections',
  async check({ tx, entity }: GuardContext): Promise<Blocker[]> {
    const open = await tx.objection.findMany({
      where: { parcelId: entity.id, status: { in: OPEN_OBJECTION } },
      select: { id: true, category: true, status: true, applicant: true },
    });
    if (open.length === 0) return [];
    return [
      {
        code: 'OPEN_OBJECTIONS',
        message: `${open.length} objection(s) under s.15 are not yet disposed of.`,
        citation: 'RFCTLARR 2013, s.15(2)',
        overridable: false,
        evidence: { objections: open },
      },
    ];
  },
};

function requireNotice(kind: NoticeKind, citation: string): Guard {
  return {
    name: `notice:${kind}`,
    async check({ tx, entity }: GuardContext): Promise<Blocker[]> {
      const count = await tx.statutoryNotice.count({ where: { kind, parcels: { some: { id: entity.id } } } });
      if (count > 0) return [];
      return [
        {
          code: `MISSING_${kind}`,
          message: `No ${kind.replace(/_/g, ' ').toLowerCase()} notice covers this parcel.`,
          citation,
          overridable: false,
          unblockedBy: [kind],
        },
      ];
    },
  };
}

export const hasSec11Notice = requireNotice(NoticeKind.SEC_11_PRELIMINARY, 'RFCTLARR 2013, s.11(1)');
export const hasSec19Notice = requireNotice(NoticeKind.SEC_19_DECLARATION, 'RFCTLARR 2013, s.19(1)');

export const awardExists: Guard = {
  name: 'awardExists',
  async check({ tx, entity }: GuardContext): Promise<Blocker[]> {
    const n = await tx.award.count({ where: { parcelId: entity.id, status: { in: ['DECLARED', 'REVISED'] } } });
    return n > 0 ? [] : [{ code: 'NO_AWARD', message: 'No award has been declared for this parcel.', citation: 'RFCTLARR 2013, s.23', overridable: false }];
  },
};

/** Every compensation line for the parcel must be paid. */
export const allCompensationPaid: Guard = {
  name: 'allCompensationPaid',
  async check({ tx, entity }: GuardContext): Promise<Blocker[]> {
    const rows = await tx.compensation.findMany({
      where: { parcelId: entity.id },
      select: { id: true, beneficiaryName: true, status: true, amountPaise: true },
    });
    if (rows.length === 0) {
      return [{ code: 'NO_COMPENSATION', message: 'No compensation has been assessed for this parcel.', overridable: false }];
    }
    const unpaid = rows.filter((r) => r.status !== CompensationStatus.PAID);
    if (unpaid.length === 0) return [];
    return [
      {
        code: 'COMPENSATION_UNPAID',
        message: `${unpaid.length} of ${rows.length} beneficiaries have not been paid.`,
        citation: 'RFCTLARR 2013, s.38(1)',
        overridable: false,
        evidence: { unpaid: unpaid.map((u) => ({ id: u.id, beneficiary: u.beneficiaryName, status: u.status, amountPaise: u.amountPaise })) },
      },
    ];
  },
};

/**
 * s.38(1): possession only after full payment of compensation and of the
 * R&R entitlements. Here: every R&R grant on the parcel is delivered or waived.
 */
export const rrEntitlementsDelivered: Guard = {
  name: 'rrEntitlementsDelivered',
  async check({ tx, entity }: GuardContext): Promise<Blocker[]> {
    const pending = await tx.rREntitlementGrant.findMany({
      where: { case: { parcelId: entity.id }, status: EntitlementStatus.ASSIGNED },
      select: { id: true, entitlement: { select: { name: true } }, case: { select: { family: { select: { headName: true } } } } },
    });
    if (pending.length === 0) return [];
    return [
      {
        code: 'RR_PENDING',
        message: `${pending.length} R&R entitlement(s) not yet delivered to affected families.`,
        citation: 'RFCTLARR 2013, s.38(1)',
        overridable: false,
        evidence: { pending: pending.map((p) => ({ id: p.id, entitlement: p.entitlement.name, family: p.case.family.headName })) },
      },
    ];
  },
};

export const allGrantsDelivered: Guard = {
  name: 'allGrantsDelivered',
  async check({ tx, entity }: GuardContext): Promise<Blocker[]> {
    const pending = await tx.rREntitlementGrant.count({ where: { caseId: entity.id, status: EntitlementStatus.ASSIGNED } });
    return pending === 0 ? [] : [{ code: 'GRANTS_PENDING', message: `${pending} entitlement(s) still to deliver.`, overridable: false }];
  },
};

/** s.15(2): the Collector decides objections only after hearing the objector. */
export const hearingHeld: Guard = {
  name: 'hearingHeld',
  async check({ tx, entity }: GuardContext): Promise<Blocker[]> {
    const held = await tx.hearing.count({ where: { objectionId: entity.id, status: 'HELD' } });
    return held > 0
      ? []
      : [{ code: 'NOT_HEARD', message: 'The objector has not been heard yet.', citation: 'RFCTLARR 2013, s.15(2)', overridable: false }];
  },
};
