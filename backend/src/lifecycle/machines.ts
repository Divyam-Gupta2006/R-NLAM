import { RoleName } from '@prisma/client';
import { R } from '../auth/auth.types';
import {
  allCompensationPaid,
  allGrantsDelivered,
  awardExists,
  hasSec11Notice,
  hasSec19Notice,
  hearingHeld,
  noOpenObjections,
  rrEntitlementsDelivered,
} from './core-guards';
import { MachineDef } from './lifecycle.types';

const { CENTRAL_ADMIN, STATE_ADMIN, STATE_OFFICER, DISTRICT_OFFICER, PIA_OFFICER, FIELD_OFFICER, FINANCE_OFFICER } = RoleName;

/**
 * The land-acquisition lifecycle of one parcel under RFCTLARR 2013:
 * identified → s.11 preliminary notification → s.19 declaration → s.23 award
 * → compensation paid → s.38 possession → handed to the requiring body.
 */
export const parcelMachine: MachineDef = {
  entityType: 'Parcel',
  table: '"Parcel"',
  stateField: 'stage',
  delegate: 'parcel',
  eventType: 'parcel.stage_changed.v1',
  eventFields: ['projectId', 'villageId', 'districtCode', 'stateCode'],
  states: ['IDENTIFIED', 'PRELIM_NOTIFIED', 'DECLARED', 'AWARDED', 'COMPENSATION_PAID', 'POSSESSION_TAKEN', 'HANDED_OVER', 'LAPSED', 'WITHDRAWN'],
  transitions: [
    { event: 'PUBLISH_PRELIMINARY', label: 'Preliminary notification (s.11)', from: ['IDENTIFIED'], to: 'PRELIM_NOTIFIED', roles: R.ACQUISITION, guards: [hasSec11Notice], domainOnly: true },
    { event: 'DECLARE', label: 'Declaration (s.19)', from: ['PRELIM_NOTIFIED'], to: 'DECLARED', roles: R.ACQUISITION, guards: [noOpenObjections, hasSec19Notice], domainOnly: true },
    { event: 'DECLARE_AWARD', label: 'Declare award (s.23)', from: ['DECLARED'], to: 'AWARDED', roles: R.ACQUISITION, guards: [noOpenObjections, awardExists], domainOnly: true },
    { event: 'COMPLETE_PAYMENT', label: 'All compensation paid', from: ['AWARDED'], to: 'COMPENSATION_PAID', roles: R.FINANCE, guards: [allCompensationPaid] },
    { event: 'TAKE_POSSESSION', label: 'Take possession (s.38)', from: ['COMPENSATION_PAID'], to: 'POSSESSION_TAKEN', roles: [CENTRAL_ADMIN, STATE_ADMIN, DISTRICT_OFFICER, FIELD_OFFICER], guards: [allCompensationPaid, rrEntitlementsDelivered], domainOnly: true },
    { event: 'HAND_OVER', label: 'Hand over to requiring body', from: ['POSSESSION_TAKEN'], to: 'HANDED_OVER', roles: [CENTRAL_ADMIN, STATE_ADMIN, DISTRICT_OFFICER], domainOnly: true },
    { event: 'LAPSE', label: 'Proceedings lapsed', from: ['PRELIM_NOTIFIED', 'DECLARED'], to: 'LAPSED', roles: R.ACQUISITION },
    { event: 'WITHDRAW', label: 'Withdraw from acquisition (s.93)', from: ['IDENTIFIED', 'PRELIM_NOTIFIED', 'DECLARED'], to: 'WITHDRAWN', roles: [CENTRAL_ADMIN, STATE_ADMIN] },
  ],
};

export const objectionMachine: MachineDef = {
  entityType: 'Objection',
  table: '"Objection"',
  stateField: 'status',
  delegate: 'objection',
  eventType: 'objection.status_changed.v1',
  eventFields: ['parcelId'],
  states: ['SUBMITTED', 'UNDER_REVIEW', 'HEARING_SCHEDULED', 'RESOLVED', 'REJECTED', 'ESCALATED'],
  transitions: [
    { event: 'REVIEW', label: 'Start review', from: ['SUBMITTED'], to: 'UNDER_REVIEW', roles: R.ACQUISITION },
    { event: 'SCHEDULE_HEARING', label: 'Schedule hearing', from: ['SUBMITTED', 'UNDER_REVIEW', 'ESCALATED'], to: 'HEARING_SCHEDULED', roles: R.ACQUISITION, domainOnly: true },
    { event: 'RESOLVE', label: 'Allow / resolve', from: ['HEARING_SCHEDULED', 'UNDER_REVIEW'], to: 'RESOLVED', roles: R.ACQUISITION, guards: [hearingHeld] },
    { event: 'REJECT', label: 'Disallow', from: ['HEARING_SCHEDULED', 'UNDER_REVIEW'], to: 'REJECTED', roles: R.ACQUISITION, guards: [hearingHeld] },
    { event: 'ESCALATE', label: 'Escalate', from: ['UNDER_REVIEW', 'HEARING_SCHEDULED'], to: 'ESCALATED', roles: R.ACQUISITION },
  ],
};

export const hearingMachine: MachineDef = {
  entityType: 'Hearing',
  table: '"Hearing"',
  stateField: 'status',
  delegate: 'hearing',
  eventType: 'hearing.status_changed.v1',
  eventFields: ['objectionId'],
  states: ['SCHEDULED', 'HELD', 'ADJOURNED', 'CANCELLED'],
  transitions: [
    { event: 'RECORD_HELD', label: 'Record hearing held', from: ['SCHEDULED'], to: 'HELD', roles: R.ACQUISITION },
    { event: 'ADJOURN', label: 'Adjourn', from: ['SCHEDULED'], to: 'ADJOURNED', roles: R.ACQUISITION },
    { event: 'RESCHEDULE', label: 'Reschedule', from: ['ADJOURNED'], to: 'SCHEDULED', roles: R.ACQUISITION, domainOnly: true },
    { event: 'CANCEL', label: 'Cancel', from: ['SCHEDULED', 'ADJOURNED'], to: 'CANCELLED', roles: R.ACQUISITION },
  ],
};

export const compensationMachine: MachineDef = {
  entityType: 'Compensation',
  table: '"Compensation"',
  stateField: 'status',
  delegate: 'compensation',
  eventType: 'compensation.status_changed.v1',
  eventFields: ['parcelId', 'projectId', 'amountPaise'],
  states: ['ASSESSED', 'APPROVED', 'INITIATED', 'PAID', 'FAILED', 'DISPUTED', 'ON_HOLD'],
  transitions: [
    { event: 'APPROVE', label: 'Approve for payment', from: ['ASSESSED'], to: 'APPROVED', roles: [CENTRAL_ADMIN, STATE_ADMIN, DISTRICT_OFFICER] },
    { event: 'INITIATE_PAYMENT', label: 'Initiate payment', from: ['APPROVED'], to: 'INITIATED', roles: [CENTRAL_ADMIN, FINANCE_OFFICER], domainOnly: true },
    { event: 'CONFIRM_PAID', label: 'Confirm credited', from: ['INITIATED'], to: 'PAID', roles: [CENTRAL_ADMIN, FINANCE_OFFICER], domainOnly: true },
    { event: 'MARK_FAILED', label: 'Payment failed', from: ['INITIATED'], to: 'FAILED', roles: [CENTRAL_ADMIN, FINANCE_OFFICER] },
    { event: 'RETRY', label: 'Retry payment', from: ['FAILED'], to: 'APPROVED', roles: [CENTRAL_ADMIN, FINANCE_OFFICER] },
    { event: 'DISPUTE', label: 'Mark disputed (reference to authority)', from: ['ASSESSED', 'APPROVED', 'FAILED'], to: 'DISPUTED', roles: R.ACQUISITION },
    { event: 'HOLD', label: 'Put on hold', from: ['ASSESSED', 'APPROVED'], to: 'ON_HOLD', roles: [CENTRAL_ADMIN, STATE_ADMIN, DISTRICT_OFFICER] },
    { event: 'RELEASE', label: 'Release hold', from: ['ON_HOLD', 'DISPUTED'], to: 'APPROVED', roles: [CENTRAL_ADMIN, STATE_ADMIN, DISTRICT_OFFICER] },
  ],
};

export const rrCaseMachine: MachineDef = {
  entityType: 'RRCase',
  table: '"RRCase"',
  stateField: 'status',
  delegate: 'rRCase',
  eventType: 'rr_case.status_changed.v1',
  eventFields: ['parcelId', 'projectId', 'familyId'],
  states: ['IDENTIFIED', 'ELIGIBILITY_VERIFIED', 'PLAN_CREATED', 'BENEFIT_ASSIGNED', 'BENEFIT_DELIVERED', 'COMPLETED'],
  transitions: [
    { event: 'VERIFY_ELIGIBILITY', label: 'Verify eligibility', from: ['IDENTIFIED'], to: 'ELIGIBILITY_VERIFIED', roles: R.RR },
    { event: 'CREATE_PLAN', label: 'Create R&R plan', from: ['ELIGIBILITY_VERIFIED'], to: 'PLAN_CREATED', roles: R.RR },
    { event: 'ASSIGN_BENEFITS', label: 'Assign entitlements', from: ['PLAN_CREATED'], to: 'BENEFIT_ASSIGNED', roles: R.RR, domainOnly: true },
    { event: 'MARK_DELIVERED', label: 'All benefits delivered', from: ['BENEFIT_ASSIGNED'], to: 'BENEFIT_DELIVERED', roles: R.RR, guards: [allGrantsDelivered] },
    { event: 'CLOSE', label: 'Close case', from: ['BENEFIT_DELIVERED'], to: 'COMPLETED', roles: R.RR },
  ],
};

export const possessionMachine: MachineDef = {
  entityType: 'Possession',
  table: '"Possession"',
  stateField: 'status',
  delegate: 'possession',
  eventType: 'possession.status_changed.v1',
  eventFields: ['parcelId', 'projectId'],
  states: ['ELIGIBLE', 'SCHEDULED', 'POSSESSION_TAKEN', 'HANDED_TO_PIA'],
  transitions: [
    { event: 'SCHEDULE', label: 'Schedule possession', from: ['ELIGIBLE'], to: 'SCHEDULED', roles: [CENTRAL_ADMIN, STATE_ADMIN, DISTRICT_OFFICER], domainOnly: true },
    { event: 'TAKE', label: 'Possession taken', from: ['ELIGIBLE', 'SCHEDULED'], to: 'POSSESSION_TAKEN', roles: [CENTRAL_ADMIN, STATE_ADMIN, DISTRICT_OFFICER, FIELD_OFFICER], domainOnly: true },
    { event: 'HAND_OVER', label: 'Handed to requiring body', from: ['POSSESSION_TAKEN'], to: 'HANDED_TO_PIA', roles: [CENTRAL_ADMIN, STATE_ADMIN, DISTRICT_OFFICER], domainOnly: true },
  ],
};

export const projectMachine: MachineDef = {
  entityType: 'Project',
  table: '"Project"',
  stateField: 'status',
  delegate: 'project',
  eventType: 'project.status_changed.v1',
  eventFields: ['stateCode'],
  states: ['DRAFT', 'SUBMITTED', 'UNDER_SCRUTINY', 'APPROVED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CLOSED'],
  transitions: [
    { event: 'SUBMIT', label: 'Submit for approval', from: ['DRAFT'], to: 'SUBMITTED', roles: [PIA_OFFICER, CENTRAL_ADMIN] },
    { event: 'START_SCRUTINY', label: 'Start scrutiny', from: ['SUBMITTED'], to: 'UNDER_SCRUTINY', roles: [STATE_ADMIN, STATE_OFFICER, CENTRAL_ADMIN] },
    { event: 'APPROVE', label: 'Approve', from: ['UNDER_SCRUTINY'], to: 'APPROVED', roles: [STATE_ADMIN, CENTRAL_ADMIN] },
    { event: 'RETURN', label: 'Return to PIA', from: ['SUBMITTED', 'UNDER_SCRUTINY'], to: 'DRAFT', roles: [STATE_ADMIN, STATE_OFFICER, CENTRAL_ADMIN] },
    { event: 'ACTIVATE', label: 'Start acquisition', from: ['APPROVED', 'ON_HOLD'], to: 'ACTIVE', roles: [STATE_ADMIN, CENTRAL_ADMIN] },
    { event: 'HOLD', label: 'Put on hold', from: ['ACTIVE'], to: 'ON_HOLD', roles: [STATE_ADMIN, CENTRAL_ADMIN] },
    { event: 'COMPLETE', label: 'Mark complete', from: ['ACTIVE'], to: 'COMPLETED', roles: [STATE_ADMIN, CENTRAL_ADMIN] },
    { event: 'CLOSE', label: 'Close', from: ['COMPLETED'], to: 'CLOSED', roles: [CENTRAL_ADMIN] },
  ],
};

export const proposalMachine: MachineDef = {
  entityType: 'Proposal',
  table: '"Proposal"',
  stateField: 'status',
  delegate: 'proposal',
  eventType: 'proposal.status_changed.v1',
  eventFields: ['projectId'],
  states: ['DRAFT', 'SUBMITTED', 'UNDER_SCRUTINY', 'QUERY_RAISED', 'APPROVED', 'REJECTED', 'WITHDRAWN'],
  transitions: [
    { event: 'SUBMIT', label: 'Submit', from: ['DRAFT', 'QUERY_RAISED'], to: 'SUBMITTED', roles: [PIA_OFFICER, CENTRAL_ADMIN] },
    { event: 'START_SCRUTINY', label: 'Start scrutiny', from: ['SUBMITTED'], to: 'UNDER_SCRUTINY', roles: [STATE_OFFICER, STATE_ADMIN, DISTRICT_OFFICER, CENTRAL_ADMIN] },
    { event: 'RAISE_QUERY', label: 'Raise query', from: ['UNDER_SCRUTINY'], to: 'QUERY_RAISED', roles: [STATE_OFFICER, STATE_ADMIN, DISTRICT_OFFICER, CENTRAL_ADMIN] },
    { event: 'APPROVE', label: 'Approve', from: ['UNDER_SCRUTINY'], to: 'APPROVED', roles: [STATE_ADMIN, CENTRAL_ADMIN] },
    { event: 'REJECT', label: 'Reject', from: ['UNDER_SCRUTINY'], to: 'REJECTED', roles: [STATE_ADMIN, CENTRAL_ADMIN] },
    { event: 'WITHDRAW', label: 'Withdraw', from: ['DRAFT', 'SUBMITTED', 'QUERY_RAISED'], to: 'WITHDRAWN', roles: [PIA_OFFICER, CENTRAL_ADMIN] },
  ],
};

export const ALL_MACHINES = [
  parcelMachine,
  objectionMachine,
  hearingMachine,
  compensationMachine,
  rrCaseMachine,
  possessionMachine,
  projectMachine,
  proposalMachine,
];

