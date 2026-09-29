import { applyBasisPoints, divRound } from '../common/money';
import { daysBetween, istDateString } from '../common/dates';

/**
 * Money rules for one award. Supplied by the statutory rule engine (6.1) from
 * the rule pack in force; nothing here is hardcoded law.
 */
export interface AwardRules {
  /** First Schedule multiplier, in hundredths (e.g. 200 = ×2.00). */
  multiplierHundredths: number;
  multiplierCitation: string;
  /** Solatium as basis points of the compensation (10 000 = 100%). */
  solatiumBp: number;
  solatiumCitation: string;
  /** Additional amount, basis points per year on market value (1 200 = 12% p.a.). */
  additionalBpPerYear: number;
  additionalCitation: string;
  /** Day-count basis for the additional amount (365 by default). */
  dayCountBasis: number;
}

export interface AwardInputs {
  areaHa: number;
  marketRatePaisePerHa: bigint;
  assetsValuePaise: bigint;
  /** Start of the s.30(3) additional amount: the s.4(2) SIA notification (s.11 if SIA was exempted). */
  additionalFrom: Date;
  /** Award date, or possession date if possession was taken earlier (s.30(3)). */
  cutoffDate: Date;
}

export interface AwardLine {
  key: 'marketValue' | 'multipliedValue' | 'assets' | 'compensation' | 'solatium' | 'additional' | 'total';
  label: string;
  amountPaise: bigint;
  formula: string;
  citation?: string;
}

export interface AwardBreakdown {
  marketValuePaise: bigint;
  multiplier: string; // "2.00"
  multipliedValuePaise: bigint;
  assetsValuePaise: bigint;
  compensationPaise: bigint; // multiplied land value + assets, the base for solatium
  solatiumPaise: bigint;
  additionalDays: number;
  additionalAmountPaise: bigint;
  totalPaise: bigint;
  lines: AwardLine[];
}

/** Area in hectares → integer "micro-hectares" so money maths stays in BigInt. */
function toMicroHa(areaHa: number): bigint {
  return BigInt(Math.round(areaHa * 1_000_000));
}

export function calculateAward(input: AwardInputs, rules: AwardRules): AwardBreakdown {
  if (input.areaHa <= 0) throw new RangeError('areaHa must be positive');
  if (input.cutoffDate < input.additionalFrom) throw new RangeError('cutoff date precedes the start of the additional amount');

  const marketValuePaise = divRound(input.marketRatePaisePerHa * toMicroHa(input.areaHa), 1_000_000n);
  const multipliedValuePaise = divRound(marketValuePaise * BigInt(rules.multiplierHundredths), 100n);
  const compensationPaise = multipliedValuePaise + input.assetsValuePaise;
  const solatiumPaise = applyBasisPoints(compensationPaise, rules.solatiumBp);

  const additionalDays = Math.max(0, daysBetween(input.additionalFrom, input.cutoffDate));
  // market value × rate × days / (basis × 10 000), rounded once at the end
  const additionalAmountPaise = divRound(
    marketValuePaise * BigInt(rules.additionalBpPerYear) * BigInt(additionalDays),
    BigInt(rules.dayCountBasis) * 10_000n,
  );
  const totalPaise = compensationPaise + solatiumPaise + additionalAmountPaise;
  const multiplier = (rules.multiplierHundredths / 100).toFixed(2);

  return {
    marketValuePaise,
    multiplier,
    multipliedValuePaise,
    assetsValuePaise: input.assetsValuePaise,
    compensationPaise,
    solatiumPaise,
    additionalDays,
    additionalAmountPaise,
    totalPaise,
    lines: [
      { key: 'marketValue', label: 'Market value of land', amountPaise: marketValuePaise, formula: `${input.areaHa} ha × rate`, citation: 'RFCTLARR 2013, s.26' },
      { key: 'multipliedValue', label: `Multiplied by factor ${multiplier}`, amountPaise: multipliedValuePaise, formula: `market value × ${multiplier}`, citation: rules.multiplierCitation },
      { key: 'assets', label: 'Value of assets attached to land', amountPaise: input.assetsValuePaise, formula: 'as assessed', citation: 'RFCTLARR 2013, s.29' },
      { key: 'compensation', label: 'Compensation (land + assets)', amountPaise: compensationPaise, formula: 'multiplied value + assets' },
      { key: 'solatium', label: 'Solatium', amountPaise: solatiumPaise, formula: `${rules.solatiumBp / 100}% of compensation`, citation: rules.solatiumCitation },
      {
        key: 'additional',
        label: 'Additional amount',
        amountPaise: additionalAmountPaise,
        formula: `${rules.additionalBpPerYear / 100}% p.a. on market value × ${additionalDays} days (${istDateString(input.additionalFrom)} → ${istDateString(input.cutoffDate)})`,
        citation: rules.additionalCitation,
      },
      { key: 'total', label: 'Total award', amountPaise: totalPaise, formula: 'compensation + solatium + additional amount' },
    ],
  };
}
