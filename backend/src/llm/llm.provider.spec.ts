import { preservesFacts, protectedTokens, TemplateProvider } from './llm.provider';

describe('LLM guard rails', () => {
  const brief = 'Award for YTL-KRS-004 is blocked (s.25 deadline 15 Jul 2027). ₹1,23,456.78 accrued; ₹657.53 a day; 3 families; forest overlap 49.99%.';

  it('extracts amounts, dates, section references and numbers', () => {
    expect(protectedTokens(brief)).toEqual(expect.arrayContaining(['₹1,23,456.78', '₹657.53', '15 Jul 2027', 's.25', '49.99%', '3']));
  });

  it('accepts a rephrasing that keeps every fact', () => {
    const ok = 'Because of the s.25 deadline (15 Jul 2027) the award for YTL-KRS-004 cannot proceed: ₹1,23,456.78 has accrued, ₹657.53 accrues daily, 3 families wait, and 49.99% of the parcel is forest. 004 KRS YTL';
    expect(preservesFacts(brief, ok).ok).toBe(true);
  });

  it('rejects a rephrasing that changes a number', () => {
    const bad = 'Award for YTL-KRS-004 is blocked (s.25 deadline 15 Jul 2027). About ₹1.2 lakh accrued; ₹657.53 a day; 3 families; forest overlap 50%.';
    const r = preservesFacts(brief, bad);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(expect.arrayContaining(['₹1,23,456.78', '49.99%']));
  });

  it('the default template provider never claims AI output and says when it cannot translate', async () => {
    const p = new TemplateProvider();
    expect(await p.rephrase('x', { language: 'en', audience: 'officer' })).toMatchObject({ aiGenerated: false, provider: 'template' });
    const hi = await p.rephrase('x', { language: 'hi', audience: 'citizen' });
    expect(hi.language).toBe('en');
    expect(hi.note).toMatch(/Translation needs/);
  });
});
