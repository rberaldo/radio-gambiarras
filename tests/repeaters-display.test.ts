import { describe, expect, it } from 'vitest';
import { formatKm, formatMHz, formatShift, toneText } from '../src/lib/repeaters/display.ts';

describe('repeater display', () => {
  it('formats frequencies and shifts', () => {
    expect(formatMHz(146.61)).toBe('146,610');
    expect(formatShift(-0.6)).toBe('−0,600');
    expect(formatShift(5)).toBe('+5,000');
    expect(formatShift(0)).toBe('simplex');
  });

  it('describes tones', () => {
    expect(toneText({ tone: 88.5 })).toBe('88,5 Hz');
    expect(toneText({ dcs: '023' })).toBe('DCS 023');
    expect(toneText({ tone: 'none' })).toBe('nenhum');
    expect(toneText({})).toBe('desconhecido');
  });

  it('formats distances', () => {
    expect(formatKm(12.345)).toBe('12,3 km');
  });
});
