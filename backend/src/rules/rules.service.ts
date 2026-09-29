import { Injectable } from '@nestjs/common';
import { AwardRules } from '../awards/award-calculator';

export interface ParcelForRules {
  stateCode: string;
  isRural: boolean;
  distanceFromUrbanKm: number | null;
}

/**
 * Resolves which statutory rules apply to a parcel on a date.
 *
 * Phase 1 placeholder: central RFCTLARR 2013 values held in code. Section 6.1
 * replaces this with versioned rule packs stored as data and resolved by
 * (state, act, effective date). Callers do not change.
 */
@Injectable()
export class RulesService {
  async awardRules(parcel: ParcelForRules, _onDate: Date): Promise<{ rules: AwardRules; packCode: string; unverified: string[] }> {
    // First Schedule: rural factor between 1.00 and 2.00 by distance from urban
    // area, as notified by the appropriate Government. Bands below are a
    // placeholder until the state notification is encoded in a rule pack.
    let multiplierHundredths = 100;
    if (parcel.isRural) {
      const km = parcel.distanceFromUrbanKm ?? 0;
      multiplierHundredths = km <= 10 ? 120 : km <= 20 ? 140 : km <= 30 ? 160 : km <= 40 ? 180 : 200;
    }
    return {
      packCode: 'RFCTLARR-CENTRAL-PLACEHOLDER',
      unverified: ['multiplier distance bands'],
      rules: {
        multiplierHundredths,
        multiplierCitation: 'RFCTLARR 2013, First Schedule, item 2 (factor by distance from urban area)',
        solatiumBp: 10_000,
        solatiumCitation: 'RFCTLARR 2013, s.30(1)',
        additionalBpPerYear: 1_200,
        additionalCitation: 'RFCTLARR 2013, s.30(3)',
        dayCountBasis: 365,
      },
    };
  }
}
