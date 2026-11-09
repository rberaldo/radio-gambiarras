// The callsign tool's interactive part: filters and the grid of a block.
import { useMemo, useRef, useState } from 'preact/hooks';
import {
  STATUS_INFO,
  UFS,
  UF_NAMES,
  blockCells,
  blockChoices,
  countStatuses,
  letterOffsets,
  type CallsignIndex,
  type LicenseClass,
  type Uf,
} from '../../lib/callsigns/index.ts';
import { LEGEND_ORDER, STATUS_MARK } from './statusStyle.ts';
import { useCallsignIndex } from './useCallsignIndex.ts';
import { VirtualGrid, type VirtualGridHandle } from './VirtualGrid.tsx';
import './callsigns.css';

const fmt = (n: number) => n.toLocaleString('pt-BR');

interface Filters {
  licenseClass: LicenseClass;
  uf: Uf;
  length: 2 | 3;
  prefix?: string;
  onlyFree: boolean;
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
          onChange={(e) => set({ uf: (e.currentTarget as HTMLSelectElement).value as Uf, prefix: undefined })}
        >
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

function Browser({ index }: { index: CallsignIndex }) {
  const [filters, setFilters] = useState<Filters>({ licenseClass: 'C', uf: 'SP', length: 2, onlyFree: false });
  const [selected, setSelected] = useState<string>();
  const grid = useRef<VirtualGridHandle>(null);
  const set = (f: Partial<Filters>) => setFilters((old) => ({ ...old, ...f }));

  const blocks = blockChoices(filters.uf, filters.licenseClass, filters.licenseClass === 'AB' ? filters.length : undefined);
  const block = blocks.find((b) => b.prefix === filters.prefix) ?? blocks[0]!;

  const allCells = useMemo(() => blockCells(block, index), [block.id, index]);
  const counts = useMemo(() => countStatuses(allCells), [allCells]);
  const cells = useMemo(
    () => (filters.onlyFree ? allCells.filter((c) => STATUS_INFO[c.status].requestable) : allCells),
    [allCells, filters.onlyFree],
  );
  const offsets = useMemo(() => letterOffsets(cells), [cells]);
  const taken = counts['em-uso'] + counts.vencida;

  return (
    <div class="cs-browser">
      <FilterBar filters={filters} set={set} prefixes={blocks.map((b) => b.prefix)} />

      <p class="cs-summary" aria-live="polite">
        <strong>{block.prefix}</strong> · {UF_NAMES[filters.uf]}: <strong>{fmt(counts.livre)}</strong> livres,{' '}
        {fmt(counts['quarentena-incerta'] + counts.quarentena)} talvez em quarentena, {fmt(taken)} em uso, de{' '}
        {fmt(allCells.length)}.
      </p>

      <nav class="cs-letters" aria-label="Ir para a letra">
        {[...offsets.keys()].map((letter) => (
          <button key={letter} type="button" class="cs-letters__btn" onClick={() => grid.current?.scrollToItem(offsets.get(letter)!)}>
            {letter}
          </button>
        ))}
      </nav>

      {cells.length === 0 ? (
        <p class="cs-empty">Nenhum indicativo livre neste bloco.</p>
      ) : (
        <VirtualGrid
          ref={grid}
          count={cells.length}
          minCellWidth={84}
          rowHeight={34}
          label={`Indicativos ${block.prefix}`}
          renderCell={(i) => {
            const cell = cells[i]!;
            return (
              <button
                type="button"
                class={`cs-cell cs-cell--${cell.status}`}
                aria-pressed={selected === cell.callsign}
                aria-label={`${cell.callsign}: ${STATUS_INFO[cell.status].label}`}
                onClick={() => setSelected(cell.callsign)}
              >
                {cell.callsign}
                {STATUS_MARK[cell.status] && <span class="cs-cell__mark">{STATUS_MARK[cell.status]}</span>}
              </button>
            );
          }}
        />
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
