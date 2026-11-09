// The callsign tool's interactive part: search, filters and the grid.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
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
  type Status,
} from '../../lib/callsigns/index.ts';
import { DetailPanel } from './DetailPanel.tsx';
import { LEGEND_ORDER, STATUS_MARK } from './statusStyle.ts';
import { useCallsignIndex } from './useCallsignIndex.ts';
import { DEFAULT_STATE, readState, writeState, type Show, type ToolState, type UfChoice } from './urlState.ts';
import { VirtualGrid } from './VirtualGrid.tsx';
import './callsigns.css';

const fmt = (n: number) => n.toLocaleString('pt-BR');

/** What each "Mostrar" option keeps; undefined keeps everything. */
const SHOW_STATUSES: Record<Show, readonly Status[] | undefined> = {
  todos: undefined,
  livres: ['livre'],
  quarentena: ['livre', 'quarentena-incerta', 'quarentena'],
};

const SHOW_LABELS: Record<Show, string> = { todos: 'Todos', livres: 'Livres', quarentena: 'Livres ou em quarentena' };

function SearchBox({ query, setQuery }: { query: string; setQuery: (q: string) => void }) {
  return (
    <div class="tool-search">
      <label for="cs-query" class="tool-filters__label">
        Buscar
      </label>
      <input
        id="cs-query"
        class="field tool-search__input"
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
      <p id="cs-query-hint" class="tool-search__hint">
        Digite um indicativo, só o sufixo, ou use <kbd>?</kbd> para uma letra qualquer e <kbd>*</kbd> para várias.
      </p>
    </div>
  );
}

function FilterBar({ filters, set, prefixes }: { filters: ToolState; set: (f: Partial<ToolState>) => void; prefixes: string[] }) {
  return (
    <fieldset class="fieldset tool-filters">
      <legend>Filtros</legend>
      <div class="tool-filters__group" role="radiogroup" aria-label="Classe">
        <span class="tool-filters__label">Classe</span>
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

      <label class="tool-filters__group">
        <span class="tool-filters__label">Estado</span>
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
        <div class="tool-filters__group" role="radiogroup" aria-label="Tamanho do sufixo">
          <span class="tool-filters__label">Sufixo</span>
          {([2, 3] as const).map((n) => (
            <label class="check" key={n}>
              <input type="radio" name="cs-length" checked={filters.length === n} onChange={() => set({ length: n })} />
              {n} letras
            </label>
          ))}
        </div>
      )}

      {prefixes.length > 1 && (
        <label class="tool-filters__group">
          <span class="tool-filters__label">Prefixo</span>
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

      <div class="tool-filters__group" role="radiogroup" aria-label="Mostrar">
        <span class="tool-filters__label">Mostrar</span>
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

/** Days after which the data date gets a visible warning. */
const STALE_DAYS = 14;

function StaleNotice({ dataDate }: { dataDate?: string }) {
  if (!dataDate) return null;
  const days = Math.floor((Date.now() - Date.parse(`${dataDate}T12:00:00Z`)) / 86_400_000);
  if (days <= STALE_DAYS) return null;
  const [y, m, d] = dataDate.split('-');
  return (
    <p class="cs-stale" role="note">
      <span class="cs-stale__icon" aria-hidden="true">
        !
      </span>
      <span>
        A Anatel não atualiza estes dados desde <strong>{`${d}/${m}/${y}`}</strong> ({days} dias). Indicativos atribuídos
        depois disso aparecem como livres.
      </span>
    </p>
  );
}

function About() {
  return (
    <details class="cs-about">
      <summary>Como isto funciona?</summary>
      <ul>
        <li>
          A lista de indicativos em uso vem dos dados abertos da Anatel e é atualizada uma vez por dia. Nomes e documentos
          dos titulares não são publicados aqui.
        </li>
        <li>
          Os indicativos possíveis seguem as regras do Ato Anatel nº 3.448/2026: prefixo do estado, classe e sufixos
          proibidos (como SOS e a série QAA–QZZ).
        </li>
        <li>
          Um indicativo cancelado fica reservado por um ano. Quando um indicativo some da base, marcamos como “em
          quarentena”. Os que estavam em uso em abril de 2025 e sumiram depois aparecem como “pode estar em quarentena”,
          porque não sabemos quando saíram.
        </li>
        <li>
          “Livre” quer dizer apenas que não encontramos o indicativo na base. Quem decide é a Anatel, no pedido de
          licenciamento.
        </li>
      </ul>
    </details>
  );
}

function Browser({ index, dataDate }: { index: CallsignIndex; dataDate?: string }) {
  const [filters, setFilters] = useState<ToolState>(() =>
    typeof location === 'undefined' ? DEFAULT_STATE : readState(location.search),
  );
  const set = (f: Partial<ToolState>) => setFilters((old) => ({ ...old, ...f }));
  const { query, selected } = filters;
  const setQuery = (q: string) => set({ query: q });
  const setSelected = (cs: string | undefined) => set({ selected: cs });

  // Keep the URL in step without adding history entries for every keystroke.
  useEffect(() => {
    const qs = writeState(filters);
    if (qs !== location.search) history.replaceState(null, '', `${location.pathname}${qs}${location.hash}`);
  }, [filters]);

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

  // Typing a complete callsign selects it, so its properties show up. On the
  // first render a selection that came in the URL (ind=) wins.
  const exact = result?.exact?.callsign;
  const lastExact = useRef(selected ? exact : undefined);
  useEffect(() => {
    if (exact && exact !== lastExact.current) setSelected(exact);
    lastExact.current = exact;
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
    <div class="tool-root">
      <StaleNotice dataDate={dataDate} />
      <SearchBox query={query} setQuery={setQuery} />
      <FilterBar filters={filters} set={set} prefixes={searching ? [] : blocks.map((b) => b.prefix)} />

      <p class="tool-summary" aria-live="polite">
        {summary}
      </p>

      <div class={selected ? 'tool-main tool-main--detail' : 'tool-main'}>
        <div class="tool-main__grid">
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
      <About />
    </div>
  );
}

export default function CallsignTool({ dataDate }: { dataDate?: string }) {
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

  return <Browser index={data.index} dataDate={dataDate} />;
}
