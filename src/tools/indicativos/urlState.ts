// The tool's state in the query string, so searches can be shared and
// survive a reload. Defaults are left out to keep links short.
// Example: /indicativos?classe=ab&uf=RJ&sufixo=3&q=PY1RB&ind=PY1RBA
import { UFS, normalize, parse, type LicenseClass, type Uf } from '../../lib/callsigns/index.ts';

export type UfChoice = Uf | 'todos';
export type Show = 'todos' | 'livres' | 'quarentena';

export interface ToolState {
  licenseClass: LicenseClass;
  uf: UfChoice;
  length: 2 | 3;
  prefix?: string;
  show: Show;
  query: string;
  selected?: string;
}

export const DEFAULT_STATE: ToolState = { licenseClass: 'C', uf: 'SP', length: 2, show: 'todos', query: '' };

const SHOWS: readonly Show[] = ['todos', 'livres', 'quarentena'];

export function readState(search: string): ToolState {
  const p = new URLSearchParams(search);
  const state: ToolState = { ...DEFAULT_STATE };

  const classe = p.get('classe')?.toLowerCase();
  if (classe === 'ab' || classe === 'c') state.licenseClass = classe === 'ab' ? 'AB' : 'C';

  const uf = p.get('uf')?.toUpperCase();
  if (uf === 'TODOS') state.uf = 'todos';
  else if (uf && (UFS as string[]).includes(uf)) state.uf = uf as Uf;

  const sufixo = p.get('sufixo');
  if (sufixo === '2' || sufixo === '3') state.length = Number(sufixo) as 2 | 3;

  const prefixo = p.get('prefixo')?.toUpperCase();
  if (prefixo && /^[A-Z]{2}\d$/.test(prefixo)) state.prefix = prefixo;

  const mostrar = p.get('mostrar') as Show | null;
  if (mostrar && SHOWS.includes(mostrar)) state.show = mostrar;

  state.query = (p.get('q') ?? '').slice(0, 20);

  const ind = parse(normalize(p.get('ind') ?? ''));
  if (ind) state.selected = ind.callsign;

  return state;
}

export function writeState(state: ToolState): string {
  const p = new URLSearchParams();
  if (state.licenseClass !== DEFAULT_STATE.licenseClass) p.set('classe', state.licenseClass.toLowerCase());
  if (state.uf !== DEFAULT_STATE.uf) p.set('uf', state.uf === 'todos' ? 'todos' : state.uf);
  if (state.licenseClass === 'AB' && state.length !== DEFAULT_STATE.length) p.set('sufixo', String(state.length));
  if (state.prefix) p.set('prefixo', state.prefix);
  if (state.show !== DEFAULT_STATE.show) p.set('mostrar', state.show);
  if (state.query.trim()) p.set('q', state.query.trim());
  if (state.selected) p.set('ind', state.selected);
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}
