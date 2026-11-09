// The APRS tool's state in the query string. Defaults are left out.
// Example: /aprs?q=carro&tabela=primaria&simbolo=%2F%3E
import type { AprsTable } from '../../lib/aprs/symbols.ts';

export type TableChoice = 'todas' | 'primaria' | 'alternativa';

export interface AprsState {
  query: string;
  table: TableChoice;
  /** Code of the selected symbol, e.g. "/>". */
  selected?: string;
}

export const DEFAULT_STATE: AprsState = { query: '', table: 'todas' };

export const TABLE_OF: Record<TableChoice, AprsTable | undefined> = {
  todas: undefined,
  primaria: '/',
  alternativa: '\\',
};

export function readState(search: string): AprsState {
  const p = new URLSearchParams(search);
  const state: AprsState = { ...DEFAULT_STATE, query: (p.get('q') ?? '').slice(0, 40) };
  const tabela = p.get('tabela');
  if (tabela === 'primaria' || tabela === 'alternativa') state.table = tabela;
  const simbolo = p.get('simbolo');
  if (simbolo && /^[/\\][!-~]$/.test(simbolo)) state.selected = simbolo;
  return state;
}

export function writeState(state: AprsState): string {
  const p = new URLSearchParams();
  if (state.query.trim()) p.set('q', state.query.trim());
  if (state.table !== DEFAULT_STATE.table) p.set('tabela', state.table);
  if (state.selected) p.set('simbolo', state.selected);
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}
