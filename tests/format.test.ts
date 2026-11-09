import { describe, expect, it } from 'vitest';
import { daysSince, formatDate, formatDecimal, formatNumber, plural } from '../src/lib/format.ts';

describe('format', () => {
  it('formats numbers the Brazilian way', () => {
    expect(formatNumber(46661)).toBe('46.661');
    expect(formatNumber(7)).toBe('7');
  });

  it('formats decimals with a comma', () => {
    expect(formatDecimal(4.86, 1)).toBe('4,9');
    expect(formatDecimal(4, 1)).toBe('4,0');
  });

  it('formats ISO dates as dd/mm/yyyy', () => {
    expect(formatDate('2026-10-23')).toBe('23/10/2026');
    expect(formatDate('nope')).toBe('nope');
  });

  it('counts days between dates', () => {
    expect(daysSince('2026-10-23', new Date('2026-11-09T15:00:00Z'))).toBe(17);
    expect(daysSince('2026-11-09', new Date('2026-11-09T23:59:00Z'))).toBe(0);
  });

  it('picks singular or plural', () => {
    expect(plural(1, 'resultado', 'resultados')).toBe('1 resultado');
    expect(plural(1234, 'resultado', 'resultados')).toBe('1.234 resultados');
  });
});
