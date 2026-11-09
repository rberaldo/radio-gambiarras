import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, readState, writeState } from '../src/tools/aprs/urlState.ts';

describe('APRS URL state', () => {
  it('leaves defaults out', () => {
    expect(writeState(DEFAULT_STATE)).toBe('');
    expect(readState('')).toEqual(DEFAULT_STATE);
  });

  it('round-trips, including codes with slashes and backslashes', () => {
    for (const selected of ['/>', '\\v', '/#']) {
      const state = { query: 'carro', table: 'alternativa' as const, selected };
      expect(readState(writeState(state))).toEqual(state);
    }
  });

  it('ignores junk', () => {
    expect(readState('?tabela=x&simbolo=abc')).toEqual(DEFAULT_STATE);
    expect(readState('?simbolo=%2F%20').selected).toBeUndefined();
  });
});
