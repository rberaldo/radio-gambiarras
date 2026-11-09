import { describe, expect, it } from 'vitest';
import { formatKm, formatMHz, formatShift, isDigital, modeBadge, onAirText, toneText } from '../src/lib/repeaters/display.ts';

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

  it('marks digital repeaters with a badge, FM first', () => {
    expect(modeBadge({ modes: [] })).toBeUndefined();
    expect(modeBadge({ modes: ['FM'] })).toBeUndefined();
    expect(modeBadge({ modes: ['DMR'] })).toBe('DMR');
    expect(modeBadge({ modes: ['DMR', 'FM'] })).toBe('FM+DMR');
    expect(isDigital({ modes: ['FM', 'Fusion'] })).toBe(true);
    expect(isDigital({ modes: [] })).toBe(false);
  });

  it('says when someone reported a repeater on or off the air', () => {
    expect(onAirText({})).toBeUndefined();
    expect(onAirText({ onAir: false, onAirDate: '2026-10-05' })).toBe('relatada fora do ar em 05/10/2026');
    expect(onAirText({ onAir: true })).toBe('confirmada no ar');
  });
});
