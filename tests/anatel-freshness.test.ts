import { describe, expect, it } from 'vitest';
import type { MetaFile } from '../scripts/anatel/callsigns.ts';
import { daysBetween, freshnessWarning } from '../scripts/anatel/freshness.ts';

const meta = (newestLicensing?: string): MetaFile => ({
  source: 's',
  sourceUrl: 'u',
  updatedAt: '2026-11-09',
  newestLicensing,
  counts: { rows: 1, callsigns: 1, active: 1, expired: 0, rejected: 0 },
});

describe('freshness', () => {
  it('counts days across months', () => {
    expect(daysBetween('2026-10-23', '2026-11-09')).toBe(17);
  });

  it('is quiet within the threshold', () => {
    expect(freshnessWarning(meta('2026-11-01'), '2026-11-09')).toBeUndefined();
    expect(freshnessWarning(meta('2026-10-26'), '2026-11-09')).toBeUndefined();
  });

  it('warns when the data is older than the threshold', () => {
    expect(freshnessWarning(meta('2026-10-23'), '2026-11-09')).toMatch(/17 days ago/);
  });

  it('warns when there are no dates at all', () => {
    expect(freshnessWarning(meta(undefined), '2026-11-09')).toMatch(/no licensing dates/);
  });
});
