/**
 * Planning assumptions, NOT statutory: typical time needed to clear each kind
 * of blocker. Statutory risk is judged on (days to deadline − lead time), so a
 * forest clearance that usually takes most of a year is urgent even when the
 * award deadline is ten months away. Shown to officers with every score, and
 * adjustable here.
 */
export const LEAD_TIME_DAYS: Record<string, number> = {
  FOREST: 270, // Stage-I + Stage-II forest clearance
  FRA_CLAIM: 180, // recognition and verification of rights
  SCHEDULED_AREA: 90, // convening the Gram Sabha and recording consent
  CRZ: 240,
  PROTECTED_AREA: 365,
  OBJECTION_HEARINGS: 30, // hear and dispose of pending s.15 objections
  IDENTITY_RECONCILIATION: 15,
  LITIGATION: 180,
};

export function leadTimeNote(kind: string): string {
  const d = LEAD_TIME_DAYS[kind];
  return d ? `planning assumption: ~${d} days to clear (${kind.replace(/_/g, ' ').toLowerCase()})` : '';
}
