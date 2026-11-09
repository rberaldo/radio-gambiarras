import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, readState, writeState } from '../src/tools/indicativos/urlState.ts';

describe('URL state', () => {
  it('leaves defaults out', () => {
    expect(writeState(DEFAULT_STATE)).toBe('');
    expect(readState('')).toEqual(DEFAULT_STATE);
  });

  it('round-trips every field', () => {
    const state = {
      licenseClass: 'AB' as const,
      uf: 'RJ' as const,
      length: 3 as const,
      prefix: 'PY1',
      show: 'quarentena' as const,
      query: 'PY1RB',
      selected: 'PY1RBA',
    };
    const qs = writeState(state);
    expect(qs).toBe('?classe=ab&uf=RJ&sufixo=3&prefixo=PY1&mostrar=quarentena&q=PY1RB&ind=PY1RBA');
    expect(readState(qs)).toEqual(state);
  });

  it('handles all states', () => {
    expect(readState(writeState({ ...DEFAULT_STATE, uf: 'todos' })).uf).toBe('todos');
  });

  it('ignores junk and normalizes case', () => {
    const s = readState('?classe=x&uf=ZZ&sufixo=9&prefixo=<b>&mostrar=tudo&ind=nope&q=' + 'A'.repeat(50));
    expect(s).toEqual({ ...DEFAULT_STATE, query: 'A'.repeat(20) });
    expect(readState('?uf=rj&ind=py1rb').uf).toBe('RJ');
    expect(readState('?ind=py1rb').selected).toBe('PY1RB');
  });

  it('drops the suffix length for class C', () => {
    expect(writeState({ ...DEFAULT_STATE, length: 3 })).toBe('');
  });
});
