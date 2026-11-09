// The callsign tool's interactive part: search, filters and the grid.
import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  STATUS_INFO,
  UFS,
  UF_NAMES,
  blockCells,
  blockChoices,
  countStatuses,
  search,
  describeFreeFrom,
  freeFrom,
  type CallsignIndex,
  type Cell,
  type LicenseClass,
  type Status,
  type Uf,
} from '../../lib/callsigns/index.ts';
import { DetailPanel } from './DetailPanel.tsx';
import { LEGEND_ORDER, STATUS_MARK } from './statusStyle.ts';
import { useCallsignIndex } from './useCallsignIndex.ts';
import { VirtualGrid } from './VirtualGrid.tsx';
import './callsigns.css';

const fmt = (n: number) => n.toLocaleString('pt-BR');

type UfChoice = Uf | 'todos';

type Show = 'todos' | 'livres' | 'talvez';

/** What each "Mostrar" option keeps; undefined keeps everything. */
const SHOW_STATUSES: Record<Show, readonly Status[] | undefined> = {
  todos: undefined,
  livres: ['livre'],
  talvez: ['livre', 'quarentena-incerta', 'quarentena'],
};

const SHOW_LABELS: Record<Show, string> = { todos: 'Todos', livres: 'Livres', talvez: 'Livres ou em quarentena' };

interface Filters {
  licenseClass: LicenseClass;
  uf: UfChoice;
  length: 2 | 3;
  prefix?: string;
  show: Show;
}

function SearchBox({ query, setQuery }: { query: string; setQuery: (q: string) => void }) {
  return (
    <div class="cs-search">
      <label for="cs-query" class="cs-filters__label">
        Buscar
      </label>
      <input
        id="cs-query"
        class="field cs-search__input"
        type="search"
        value={query}
        placeholder="PY2RB, RBR, PY2?AB, *RB"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck={false}
        aria-describedby="cs-query-hint"
        onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
      />
      <button class="btn" type="button" disabled={!query} onClick={() => setQuery('')}>
        Limpar
      </button>
      <p id="cs-query-hint" class="cs-search__hint">
        Digite um indicativo, só o sufixo, ou use <kbd>?</kbd> para uma letra qualquer e <kbd>*</kbd> para várias.
      </p>
    </div>
  );
}

function FilterBar({ filters, set, prefixes }: { filters: Filters; set: (f: Partial<Filters>) => void; prefixes: string[] }) {
  return (
    <fieldset class="fieldset cs-filters">
      <legend>Filtros</legend>
      <div class="cs-filters__group" role="radiogroup" aria-label="Classe">
        <span class="cs-filters__label">Classe</span>
        {(['AB', 'C'] as const).map((c) => (
          <label class="check" key={c}>
            <input
              type="radio"
              name="cs-class"
              checked={filters.licenseClass === c}
              onChange={() => set({ licenseClass: c, prefix: undefined })}
            />
            {c === 'AB' ? 'A ou B' : 'C'}
          </label>
        ))}
      </div>

      <label class="cs-filters__group">
        <span class="cs-filters__label">Estado</span>
        <select
          class="field"
          value={filters.uf}
          onChange={(e) => set({ uf: (e.currentTarget as HTMLSelectElement).value as UfChoice, prefix: undefined })}
        >
          <option value="todos">Todos os estados</option>
          {UFS.map((uf) => (
            <option key={uf} value={uf}>
              {uf} – {UF_NAMES[uf]}
            </option>
          ))}
        </select>
      </label>

      {filters.licenseClass === 'AB' && (
        <div class="cs-filters__group" role="radiogroup" aria-label="Tamanho do sufixo">
          <span class="cs-filters__label">Sufixo</span>
          {([2, 3] as const).map((n) => (
            <label class="check" key={n}>
              <input type="radio" name="cs-length" checked={filters.length === n} onChange={() => set({ length: n })} />
              {n} letras
            </label>
          ))}
        </div>
      )}

      {prefixes.length > 1 && (
        <label class="cs-filters__group">
          <span class="cs-filters__label">Prefixo</span>
          <select
            class="field"
            value={filters.prefix ?? prefixes[0]}
            onChange={(e) => set({ prefix: (e.currentTarget as HTMLSelectElement).value })}
          >
            {prefixes.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      )}

      <div class="cs-filters__group" role="radiogroup" aria-label="Mostrar">
        <span class="cs-filters__label">Mostrar</span>
        {(Object.keys(SHOW_LABELS) as Show[]).map((s) => (
          <label class="check" key={s}>
            <input type="radio" name="cs-show" checked={filters.show === s} onChange={() => set({ show: s })} />
            {SHOW_LABELS[s]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Legend() {
  return (
    <ul class="cs-legend" aria-label="Legenda">
      {LEGEND_ORDER.map((s) => (
        <li key={s}>
          <span class={`cs-cell cs-cell--${s} cs-legend__swatch`} aria-hidden="true">
            {STATUS_MARK[s] || 'A'}
          </span>
          {STATUS_INFO[s].label}
        </li>
      ))}
    </ul>
  );
}

function CellButton({
  cell,
  index,
  selected,
  onSelect,
}: {
  cell: Cell;
  index: CallsignIndex;
  selected: boolean;
  onSelect: (cs: string) => void;
}) {
  const label = STATUS_INFO[cell.status].label;
  const free = cell.status === 'quarentena' || cell.status === 'quarentena-incerta' ? freeFrom(cell.callsign, index) : undefined;
  const hint = free ? `${label}. ${describeFreeFrom(free)}` : label;
  return (
    <button
      type="button"
      class={`cs-cell cs-cell--${cell.status}`}
      aria-pressed={selected}
      aria-label={`${cell.callsign}: ${hint}`}
      title={hint}
      onClick={() => onSelect(cell.callsign)}
    >
      {cell.callsign}
      {STATUS_MARK[cell.status] && <span class="cs-cell__mark">{STATUS_MARK[cell.status]}</span>}
    </button>
  );
}

function Browser({ index }: { index: CallsignIndex }) {
  const [filters, setFilters] = useState<Filters>({ licenseClass: 'C', uf: 'SP', length: 2, show: 'todos' });
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string>();
  const set = (f: Partial<Filters>) => setFilters((old) => ({ ...old, ...f }));

  const uf = filters.uf === 'todos' ? undefined : filters.uf;
  const blocks = uf ? blockChoices(uf, filters.licenseClass, filters.licenseClass === 'AB' ? filters.length : undefined) : [];
  const block = blocks.find((b) => b.prefix === filters.prefix) ?? blocks[0];

  const searching = query.trim() !== '';
  const result = useMemo(
    () => (searching ? search(query, { licenseClass: filters.licenseClass, uf }, index) : null),
    [searching, query, filters.licenseClass, uf, index],
  );
  const baseCells = useMemo(
    () => (searching ? (result?.cells ?? []) : block ? blockCells(block, index) : []),
    [searching, result, block?.id, index],
  );
  const counts = useMemo(() => countStatuses(baseCells), [baseCells]);
  const cells = useMemo(
    () => {
      const keep = SHOW_STATUSES[filters.show];
      return keep ? baseCells.filter((c) => keep.includes(c.status)) : baseCells;
    },
    [baseCells, filters.show],
  );

  const where = uf ? UF_NAMES[uf] : 'todos os estados';
  const taken = counts['em-uso'] + counts.vencida;
  const maybe = counts['quarentena-incerta'] + counts.quarentena;

  // Typing a complete callsign selects it, so its properties show up.
  const exact = result?.exact?.callsign;
  useEffect(() => {
    if (exact) setSelected(exact);
  }, [exact]);

  const cellButton = (cell: Cell) => (
    <CellButton cell={cell} index={index} selected={selected === cell.callsign} onSelect={setSelected} />
  );

  let summary;
  if (searching && !result) summary = <>Busca inválida: use letras, números, <kbd>?</kbd> e <kbd>*</kbd>.</>;
  else if (searching)
    summary = (
      <>
        {fmt(baseCells.length)} {baseCells.length === 1 ? 'resultado' : 'resultados'} em {where}: <strong>{fmt(counts.livre)}</strong> livres, {fmt(maybe)} talvez em
        quarentena, {fmt(taken)} em uso.
      </>
    );
  else if (block)
    summary = (
      <>
        <strong>{block.prefix}</strong> · {where}: <strong>{fmt(counts.livre)}</strong> livres, {fmt(maybe)} talvez em quarentena,{' '}
        {fmt(taken)} em uso, de {fmt(baseCells.length)}.
      </>
    );
  else summary = <>Escolha um estado para ver a grade, ou faça uma busca.</>;

  return (
    <div class="cs-browser">
      <SearchBox query={query} setQuery={setQuery} />
      <FilterBar filters={filters} set={set} prefixes={searching ? [] : blocks.map((b) => b.prefix)} />

      <p class="cs-summary" aria-live="polite">
        {summary}
      </p>

      <div class={selected ? 'cs-main cs-main--detail' : 'cs-main'}>
        <div class="cs-main__grid">
          {cells.length > 0 ? (
            <VirtualGrid
              count={cells.length}
              minCellWidth={84}
              rowHeight={34}
              label={searching ? 'Resultados da busca' : `Indicativos ${block?.prefix ?? ''}`}
              renderCell={(i) => cellButton(cells[i]!)}
            />
          ) : (
            (searching || block) && <p class="cs-empty">{baseCells.length > 0 ? 'Nenhum indicativo livre aqui.' : 'Nenhum indicativo encontrado.'}</p>
          )}
        </div>
        {selected && (
          <DetailPanel callsign={selected} index={index} onClose={() => setSelected(undefined)} renderCell={cellButton} />
        )}
      </div>

      <Legend />
    </div>
  );
}

export default function CallsignTool() {
  const data = useCallsignIndex();

  if (data.state === 'loading') {
    return (
      <div class="cs-loading" role="status">
        <p>Carregando a base de indicativos…</p>
        <div class="cs-progress" aria-hidden="true">
          <span />
        </div>
      </div>
    );
  }

  if (data.state === 'error') {
    return (
      <div class="cs-error" role="alert">
        <p>
          <strong>Não foi possível carregar os dados.</strong>
        </p>
        <p>
          Verifique sua conexão e tente de novo. <small>({data.message})</small>
        </p>
        <button class="btn" type="button" onClick={data.retry}>
          Tentar de novo
        </button>
      </div>
    );
  }

  return <Browser index={data.index} />;
}
