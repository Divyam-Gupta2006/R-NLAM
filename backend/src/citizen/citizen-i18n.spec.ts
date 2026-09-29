import { ClockKind, CompensationStatus, EntitlementStatus, GrievanceStatus, HearingStatus, NoticeKind, ObjectionStatus, ParcelStage } from '@prisma/client';
import { DICTS, translate } from '../../../frontend/lib/i18n/citizen';
import { AwardLine } from '../awards/award-calculator';
import { CITIZEN_DOC_KINDS, GRIEVANCE_CATEGORIES } from './citizen.module';

/**
 * The citizen portal builds some keys at runtime (`stage_${stage}`,
 * `comp_${status}`, …). This checks every value the API can return has
 * wording in all three languages, so no raw code ever reaches a citizen.
 */
const LINE_KEYS: Array<AwardLine['key']> = ['marketValue', 'multipliedValue', 'assets', 'compensation', 'solatium', 'additional', 'total'];
const ENTITLEMENT_CODES = ['HOUSE_RURAL', 'CHOICE_EMPLOYMENT_OR_ANNUITY', 'SUBSISTENCE_GRANT', 'TRANSPORTATION', 'CATTLE_SHED', 'ARTISAN_GRANT', 'RESETTLEMENT_ALLOWANCE'];
const OBJECTION_CATEGORIES = ['COMPENSATION_AMOUNT', 'MEASUREMENT', 'TITLE', 'PUBLIC_PURPOSE', 'OTHER'];

const dynamicKeys = [
  ...Object.values(ParcelStage).flatMap((s) => [`stage_${s}_title`, `stage_${s}_next`]),
  ...Object.values(CompensationStatus).map((s) => `comp_${s}`),
  ...Object.values(ObjectionStatus).map((s) => `objst_${s}`),
  ...Object.values(HearingStatus).map((s) => `hear_${s}`),
  ...Object.values(EntitlementStatus).map((s) => `ent_${s}`),
  ...Object.values(GrievanceStatus).map((s) => `gst_${s}`),
  ...Object.values(NoticeKind).map((k) => `notice_${k}`),
  ...Object.values(ClockKind).map((k) => `clock_${k}`),
  ...CITIZEN_DOC_KINDS.map((k) => `doc_${k}`),
  ...GRIEVANCE_CATEGORIES.map((c) => `gcat_${c}`),
  ...OBJECTION_CATEGORIES.map((c) => `obj_${c}`),
  ...ENTITLEMENT_CODES.map((c) => `ent_${c}`),
  ...LINE_KEYS.map((k) => `line_${k}`),
];

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const DEVANAGARI = /[ऀ-ॿ]/;

describe('citizen portal wording', () => {
  it.each(['en', 'hi', 'mr'] as const)('%s has wording for every status, stage, kind and category the API returns', (lang) => {
    const missing = dynamicKeys.filter((k) => !(k in DICTS[lang]));
    expect(missing).toEqual([]);
  });

  it('every Hindi and Marathi string uses the same {placeholders} as English', () => {
    const bad: string[] = [];
    for (const [key, en] of Object.entries(DICTS.en)) {
      for (const lang of ['hi', 'mr'] as const) {
        if (placeholders((DICTS[lang] as Record<string, string>)[key]).join() !== placeholders(en).join()) bad.push(`${lang}.${key}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('Hindi and Marathi strings are actually in Devanagari (not English left behind)', () => {
    // Allowed to stay Latin: product and scheme names, codes.
    const latinOk = new Set(['appTitle', 'toDigiLocker', 'inDigiLocker', 'sendOtp', 'syntheticDigiLocker', 'syntheticCpgrams']);
    for (const lang of ['hi', 'mr'] as const) {
      const english = Object.entries(DICTS[lang]).filter(([k, v]) => !latinOk.has(k) && !DEVANAGARI.test(v as string)).map(([k]) => k);
      expect({ lang, english }).toEqual({ lang, english: [] });
    }
  });

  it('Hindi and Marathi are not copies of each other where the languages differ', () => {
    const same = Object.keys(DICTS.hi).filter((k) => (DICTS.hi as Record<string, string>)[k] === (DICTS.mr as Record<string, string>)[k]);
    // A few short words are genuinely the same in both (e.g. "भाषा", "आज").
    expect(same.length).toBeLessThan(Object.keys(DICTS.hi).length * 0.1);
  });

  it('fills placeholders and falls back to English, then the key', () => {
    expect(translate('mr', 'greeting', { name: 'सुनीता' })).toBe('नमस्कार, सुनीता');
    expect(translate('hi', 'daysLeft', { n: 12 })).toBe('12 दिन बाकी');
    expect(translate('mr', 'no_such_key')).toBe('no_such_key');
  });
});
