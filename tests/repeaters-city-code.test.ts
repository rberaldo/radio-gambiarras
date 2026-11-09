import { describe, expect, it } from 'vitest';
import { cityCode } from '../src/lib/repeaters/cityCode.ts';
import { chirpName } from '../src/lib/repeaters/export.ts';
import type { Repeater } from '../src/lib/repeaters/merge.ts';

describe('cityCode', () => {
  it('uses the tags people know', () => {
    expect(cityCode('Rio de Janeiro', 'RJ')).toBe('RIO');
    expect(cityCode('Porto Alegre', 'RS')).toBe('POA');
    expect(cityCode('Belo Horizonte', 'MG')).toBe('BH');
    expect(cityCode('Brasília', 'DF')).toBe('BSB');
  });

  it('takes initials of longer names, skipping connectors', () => {
    expect(cityCode('São José dos Pinhais', 'PR')).toBe('SJP');
    expect(cityCode('São João del Rei', 'MG')).toBe('SJR');
    expect(cityCode('Nova Friburgo', 'RJ')).toBe('NF');
    expect(cityCode('Olho d\'Água das Flores', 'AL')).toBe('OAF');
    expect(cityCode('Santa Rita do Passa Quatro', 'SP')).toBe('SRP');
  });

  it('takes the first three letters of one-word names, without accents', () => {
    expect(cityCode('Petrópolis', 'RJ')).toBe('PET');
    expect(cityCode('Itaúna', 'MG')).toBe('ITA');
    expect(cityCode('Óbidos', 'PA')).toBe('OBI');
  });

  it('is never longer than three letters', () => {
    for (const name of ['Rio de Janeiro', 'Santa Maria de Jetibá', 'X', 'Embu-Guaçu', 'Itapecerica da Serra']) {
      expect(cityCode(name, 'SP')).toMatch(/^[A-Z]{1,3}$/);
    }
  });
});

describe('chirpName', () => {
  it('puts the city tag before the callsign without its prefix', () => {
    expect(chirpName({ municipio: 'Porto Alegre', uf: 'RS', callsign: 'PY3ZZZ' } as Repeater)).toBe('POA 3ZZZ');
    expect(chirpName({ municipio: 'Rio de Janeiro', uf: 'RJ', callsign: 'PP1ZZ' } as Repeater)).toBe('RIO 1ZZ');
  });

  it('fits in 8 characters for every repeater in the data', async () => {
    const { readFileSync } = await import('node:fs');
    const file = JSON.parse(readFileSync('data/repeaters/anatel.json', 'utf8')) as { repeaters: Repeater[] };
    const longest = Math.max(...file.repeaters.map((r) => chirpName(r).length));
    expect(longest).toBeLessThanOrEqual(8);
  });
});
