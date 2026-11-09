import { describe, expect, it } from 'vitest';
import { dotSeconds, morse, morseTimeline, morseUnits, phonetic } from '../src/lib/callsigns';

describe('phonetic', () => {
  it('spells letters in ICAO and digits in Portuguese', () => {
    expect(phonetic('PY2RB')).toEqual(['Papa', 'Yankee', 'Dois', 'Romeo', 'Bravo']);
    expect(phonetic('PU3ZX')).toEqual(['Papa', 'Uniform', 'Três', 'Zulu', 'X-ray']);
  });
});

describe('morse', () => {
  it('encodes each character', () => {
    expect(morse('PY2')).toEqual(['.--.', '-.--', '..---']);
  });

  it('counts dot units with standard gaps', () => {
    // E = 1; EE = 1 + 3 + 1
    expect(morseUnits('E')).toBe(1);
    expect(morseUnits('EE')).toBe(5);
    // T = 3; A = 1 + 1 + 3 = 5; TA = 3 + 3 + 5
    expect(morseUnits('TA')).toBe(11);
  });

  it('ranks shorter callsigns lower', () => {
    expect(morseUnits('PY2EE')).toBeLessThan(morseUnits('PY2QQ'));
  });

  it('builds a timeline that adds up to the unit count', () => {
    const t = morseTimeline('PY2RB');
    expect(t.reduce((sum, x) => sum + Math.abs(x), 0)).toBe(morseUnits('PY2RB'));
    expect(morseTimeline('TA')).toEqual([3, -3, 1, -1, 3]);
  });

  it('uses the PARIS timing', () => {
    expect(dotSeconds(20)).toBeCloseTo(0.06);
  });
});
