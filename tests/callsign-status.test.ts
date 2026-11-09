import { describe, expect, it } from 'vitest';
import { STATUS_INFO, buildIndex, statusOf, type Status } from '../src/lib/callsigns';

const index = buildIndex(
  {
    format: 1,
    active: { PY2: 'AA SOS', PU2: 'KAA' },
    expired: { PY2: 'AB' },
  },
  {
    format: 1,
    released: { PY2AC: '2026-11-01' },
    seeded: { source: 's', snapshotDate: '2025-04-09', until: '2027-10-23', callsigns: 'PY2AD PY2AA' },
  },
);

describe('statusOf', () => {
  it.each<[string, Status]>([
    ['PY2AA', 'em-uso'],
    ['PU2KAA', 'em-uso'],
    ['PY2AB', 'vencida'],
    ['PY2AC', 'quarentena'],
    ['PY2AD', 'quarentena-incerta'],
    ['PY2QRZ', 'reservado'],
    ['PY2ZAB', 'reservado'],
    ['PY2AE', 'livre'],
    ['PU2KAB', 'livre'],
    ['PX2AB', 'invalido'],
    ['PU2JAA', 'livre'],
  ])('%s is %s', (cs, status) => {
    expect(statusOf(cs, index)).toBe(status);
  });

  it('lets Anatel data win over the rules', () => {
    expect(statusOf('PY2SOS', index)).toBe('em-uso');
  });

  it('lets a callsign in use win over an outdated seed entry', () => {
    expect(statusOf('PY2AA', index)).toBe('em-uso');
  });

  it('accepts a known kind to skip classification', () => {
    expect(statusOf('PY2AE', index, 'regular')).toBe('livre');
    expect(statusOf('PY2QRZ', index, 'forbidden')).toBe('reservado');
  });

  it('describes every status', () => {
    for (const info of Object.values(STATUS_INFO)) {
      expect(info.label).not.toBe('');
      expect(info.description).not.toBe('');
    }
  });
});
