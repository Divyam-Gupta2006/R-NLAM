import { compareNames, jaroWinkler, normaliseName, phoneticKey } from './names';
import { detectScript, toLatin } from './transliterate';

describe('toLatin (Brahmic → Latin, with schwa deletion)', () => {
  it.each([
    ['राम', 'ram'],
    ['रामकुमार', 'ramkumar'],
    ['राम कुमार', 'ram kumar'],
    ['वानखेडे', 'vankhede'],
    ['भाऊराव', 'bhaurav'],
    ['सुनीता', 'sunita'],
    ['पाटील', 'patil'],
    ['देशमुख', 'deshmukh'],
    ['कृष्णा', 'krishna'],
    ['रमेश', 'ramesh'], // Devanagari
    ['રમેશ પટેલ', 'ramesh patel'], // Gujarati
    ['ಸುರೇಶ್', 'suresh'], // Kannada (explicit virama)
    ['Ram Kumar', 'Ram Kumar'], // Latin passes through
  ])('%s → %s', (input, expected) => {
    expect(toLatin(input)).toBe(expected);
  });

  it('detects the dominant script', () => {
    expect(detectScript('रामकुमार वानखेडे')).toBe('Deva');
    expect(detectScript('રમેશ')).toBe('Gujr');
    expect(detectScript('ಸುರೇಶ್')).toBe('Knda');
    expect(detectScript('Ramkumar')).toBe('Latn');
  });
});

describe('normaliseName', () => {
  it.each([
    ['Shri Ramkumar B. Wankhede', ['ramkumar', 'b', 'vankhede']],
    ['श्री रामकुमार वानखेडे', ['ramkumar', 'vankhede']],
    ['Bhaurao', ['bhaurav']],
    ['Smt. Sunita  Bhoyar', ['sunita', 'bhoyar']],
    ['PHULE', ['fule']],
  ])('%s → %j', (input, expected) => {
    expect(normaliseName(input)).toEqual(expected);
  });
});

describe('jaroWinkler (reference values)', () => {
  it.each([
    ['martha', 'marhta', 0.961],
    ['dwayne', 'duane', 0.84],
    ['dixon', 'dicksonx', 0.813],
    ['abc', 'abc', 1],
    ['abc', 'xyz', 0],
  ])('JW(%s, %s) ≈ %s', (a, b, expected) => {
    expect(jaroWinkler(a, b)).toBeCloseTo(expected, 3);
  });
});

describe('phoneticKey', () => {
  it.each([
    ['vankhede', 'vnkd'],
    ['wankhede', 'wnkd'], // before normalisation w stays; normaliseName folds w → v
    ['bhoyar', 'br'],
    ['bhoiar', 'br'],
    ['deshmukh', 'dsmk'],
  ])('%s → %s', (t, k) => {
    expect(phoneticKey(t)).toBe(k);
  });
});

describe('compareNames across scripts and spellings', () => {
  it.each([
    // [A, B, minimum score, why]
    ['राम कुमार वानखेडे', 'Ram Kumar Wankhede', 0.97, 'same name, Devanagari vs Latin'],
    ['राम कुमार वानखेडे', 'Ramkumar Wankhede', 0.95, 'split vs joined given name'],
    ['रामकुमार भाऊराव वानखेडे', 'Ramkumar B. Wankhede', 0.9, 'father’s name as an initial'],
    ['Sunita Maroti Bhoyar', 'Sunita Bhoiar', 0.85, 'spelling variant, middle name missing'],
    ['રમેશ પટેલ', 'Ramesh Patel', 0.97, 'Gujarati vs Latin'],
  ])('%s ~ %s ≥ %s (%s)', (a, b, min) => {
    expect(compareNames(a, b).score).toBeGreaterThanOrEqual(min as number);
  });

  it.each([
    ['Ramesh Patil', 'Suresh Patil', 0.85],
    ['Ramkumar Wankhede', 'Ganesh Kolhe', 0.6],
  ])('%s vs %s stays below %s', (a, b, max) => {
    expect(compareNames(a, b).score).toBeLessThan(max);
  });

  it('reports a phonetic match for the Wankhede pair', () => {
    expect(compareNames('रामकुमार वानखेडे', 'Ramkumar Wankhede').phoneticMatch).toBe(true);
  });
});
