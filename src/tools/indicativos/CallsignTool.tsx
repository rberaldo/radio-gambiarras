// The callsign tool's interactive part: search, filters and the grid.
import { useMemo, useState } from 'preact/hooks';
import {
  STATUS_INFO,
  UFS,
  UF_NAMES,
  blockCells,
  blockChoices,
  countStatuses,
  nearMisses,
  search,
  type CallsignIndex,
  type Cell,
  type LicenseClass,
  type Uf,
} from '../../lib/callsigns/index.ts';
import { LEGEND_ORDER, STATUS_MARK } from './statusStyle.ts';
import { useCallsignIndex } from './useCallsignIndex.ts';
import { VirtualGrid } from './VirtualGrid.tsx';
import './callsigns.css';

const fmt = (n: number) => n.toLocaleString('pt-BR');

type UfChoice = Uf | 'todos';

interface Filters {
  licenseClass: LicenseClass;
  uf: UfChoice;
  length: 2 | 3;
  prefix?: string;
  onlyFree: boolean;
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

      <label class="check cs-filters__group">
        <input type="checkbox" checked={filters.onlyFree} onChange={(e) => set({ onlyFree: (e.currentTarget as HTMLInputElement).checked })} />
        Mostrar só livres
      </label>
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

function CellButton({ cell, selected, onSelect }: { cell: Cell; selected: boolean; onSelect: (cs: string) => void }) {
  return (
    <button
      type="button"
      class={`cs-cell cs-cell--${cell.status}`}
      aria-pressed={selected}
      aria-label={`${cell.callsign}: ${STATUS_INFO[cell.status].label}`}
      onClick={() => onSelect(cell.callsign)}
    >
      {cell.callsign}
      {STATUS_MARK[cell.status] && <span class="cs-cell__mark">{STATUS_MARK[cell.status]}</span>}
    </button>
  );
}

function ExactResult({ cell, index, onPick }: { cell: Cell; index: CallsignIndex; onPick: (cs: string) => void }) {
  const info = STATUS_INFO[cell.status];
  const similar = useMemo(() => (info.requestable ? [] : nearMisses(cell.callsign, index)), [cell.callsign, info.requestable, index]);
  return (
    <section class="cs-exact panel-raised" aria-live="polite">
      <p class="cs-exact__head">
        <span class={`cs-cell cs-cell--${cell.status} cs-exact__call`}>{cell.callsign}</span>
        <strong>{info.label}</strong>
      </p>
      <p>{info.description}</p>
      {similar.length > 0 && (
        <>
          <p>
            <strong>Parecidos e livres:</strong>
          </p>
          <ul class="cs-similar" role="list">
            {similar.map((c) => (
              <li key={c.callsign}>
                <CellButton cell={c} selected={false} onSelect={onPick} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Browser({ index }: { index: CallsignIndex }) {
  const [filters, setFilters] = useState<Filters>({ licenseClass: 'C', uf: 'SP', length: 2, onlyFree: false });
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
    () => (filters.onlyFree ? baseCells.filter((c) => STATUS_INFO[c.status].requestable) : baseCells),
    [baseCells, filters.onlyFree],
  );

  const where = uf ? UF_NAMES[uf] : 'todos os estados';
  const taken = counts['em-uso'] + counts.vencida;
  const maybe = counts['quarentena-incerta'] + counts.quarentena;
  const pick = (cs: string) => {
    setSelected(cs);
    setQuery(cs);
  };

  let summary;
  if (searching && !result) summary = <>Busca inválida: use letras, números, <kbd>?</kbd> e <kbd>*</kbd>.</>;
  else if (searching)
    summary = (
      <>
        {fmt(baseCells.length)} resultados em {where}: <strong>{fmt(counts.livre)}</strong> livres, {fmt(maybe)} talvez em
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

      {result?.exact && <ExactResult cell={result.exact} index={index} onPick={pick} />}

      <p class="cs-summary" aria-live="polite">
        {summary}
      </p>

      {cells.length > 0 ? (
        <VirtualGrid
          count={cells.length}
          minCellWidth={84}
          rowHeight={34}
          label={searching ? 'Resultados da busca' : `Indicativos ${block?.prefix ?? ''}`}
          renderCell={(i) => <CellButton cell={cells[i]!} selected={selected === cells[i]!.callsign} onSelect={setSelected} />}
        />
      ) : (
        (searching || block) && <p class="cs-empty">{filters.onlyFree ? 'Nenhum indicativo livre aqui.' : 'Nenhum indicativo encontrado.'}</p>
      )}

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
