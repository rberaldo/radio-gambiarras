import { describe, expect, it } from 'vitest';
import type { Stop } from '../src/lib/repeaters/stops.ts';
import { DEFAULT_PLAN, pointKey, quickLink, readPlan, resolvePlace, writePlan } from '../src/tools/repetidoras/planState.ts';

const stops: Stop[] = [{ id: 'pico-da-tijuca', name: 'Pico da Tijuca', lat: -22.94373, lon: -43.28656, elevM: 1004 }];

describe('planning page URL', () => {
  it('round-trips an outing with stops and picked points, readable in the address bar', () => {
    const state = { open: 'pico-da-tijuca', outing: ['pico-da-tijuca', '-22.970,-43.250'], radiusKm: 25 };
    const qs = writePlan(state);
    expect(qs).toBe('?parada=pico-da-tijuca&roteiro=pico-da-tijuca;-22.970,-43.250&raio=25');
    expect(readPlan(qs)).toEqual(state);
  });

  it('falls back to the defaults', () => {
    expect(writePlan(DEFAULT_PLAN)).toBe('');
    expect(readPlan('?raio=7&roteiro=;;')).toEqual(DEFAULT_PLAN);
  });

  it('resolves stops and picked points, and ignores the rest', () => {
    expect(resolvePlace('pico-da-tijuca', stops)?.name).toBe('Pico da Tijuca');
    expect(resolvePlace(pointKey({ lat: -22.97012, lon: -43.25049 }), stops)).toEqual({ id: '-22.970,-43.250', name: 'Ponto -22.970, -43.250', lat: -22.97, lon: -43.25, picked: true });
    expect(resolvePlace('pedra-inexistente', stops)).toBeUndefined();
  });

  it('opens the quick mode at a stop, named only when it has a name', () => {
    expect(quickLink(stops[0]!, 50)).toBe('/repetidoras/conferir?modo=perto&ponto=-22.94373%2C-43.28656&mostrar=a-conferir&raio=50&de=Pico+da+Tijuca');
    expect(quickLink({ name: 'Ponto', lat: -22.97, lon: -43.25, picked: true }, 25)).not.toContain('de=');
  });
});
