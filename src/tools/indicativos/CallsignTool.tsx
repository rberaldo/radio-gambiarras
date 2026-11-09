// The callsign tool's interactive part: loads the data, then search,
// filters, the grid and the detail panel.
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import {
  UF_NAMES,
  blockCells,
  blockChoices,
  countStatuses,
  search,
  type CallsignIndex,
  type Cell,
  type StatusCounts,
} from '../../lib/callsigns/index.ts';
import { formatNumber, plural } from '../../lib/format.ts';
import { Loading, LoadError } from '../../ui/LoadState.tsx';
import { SearchField } from '../../ui/SearchField.tsx';
import { useUrlState } from '../../ui/useUrlState.ts';
import { CellButton } from './CellButton.tsx';
import { DetailPanel } from './DetailPanel.tsx';
import { FilterBar } from './FilterBar.tsx';
import { applyShow } from './filters.ts';
import { HowItWorks } from './HowItWorks.tsx';
import { Legend } from './Legend.tsx';
import { StaleNotice } from './StaleNotice.tsx';
import { useCallsignIndex } from './useCallsignIndex.ts';
import { DEFAULT_STATE, readState, writeState } from './urlState.ts';
import { VirtualGrid } from './VirtualGrid.tsx';
import './callsigns.css';

/** "261 livres, 289 talvez em quarentena, 8.907 em uso" for a set of cells. */
function countsLine(counts: StatusCounts): ComponentChildren {
  const maybe = counts['quarentena-incerta'] + counts.quarentena;
  const taken = counts['em-uso'] + counts.vencida;
  return (
    <>
      <strong>{formatNumber(counts.livre)}</strong> livres, {formatNumber(maybe)} talvez em quarentena, {formatNumber(taken)}{' '}
      em uso
    </>
  );
}

function Browser({ index, dataDate }: { index: CallsignIndex; dataDate?: string }) {
  const [state, set] = useUrlState(readState, writeState, DEFAULT_STATE);
  const { query, selected } = state;
  const select = (callsign: string | undefined) => set({ selected: callsign });

  const uf = state.uf === 'todos' ? undefined : state.uf;
  const blocks = uf ? blockChoices(uf, state.licenseClass, state.licenseClass === 'AB' ? state.length : undefined) : [];
  const block = blocks.find((b) => b.prefix === state.prefix) ?? blocks[0];

  const searching = query.trim() !== '';
  const result = useMemo(
    () => (searching ? search(query, { licenseClass: state.licenseClass, uf }, index) : null),
    [searching, query, state.licenseClass, uf, index],
  );
  const baseCells = useMemo(
    () => (searching ? (result?.cells ?? []) : block ? blockCells(block, index) : []),
    [searching, result, block?.id, index],
  );
  const counts = useMemo(() => countStatuses(baseCells), [baseCells]);
  const cells = useMemo(() => applyShow(baseCells, state.show), [baseCells, state.show]);

  // Typing a complete callsign selects it, so its properties show up. On the
  // first render a selection that came in the URL (ind=) wins.
  const exact = result?.exact?.callsign;
  const lastExact = useRef(selected ? exact : undefined);
  useEffect(() => {
    if (exact && exact !== lastExact.current) select(exact);
    lastExact.current = exact;
  }, [exact]);

  const cellButton = (cell: Cell) => (
    <CellButton cell={cell} index={index} selected={selected === cell.callsign} onSelect={select} />
  );

  const where = uf ? UF_NAMES[uf] : 'todos os estados';
  let summary: ComponentChildren;
  if (searching && !result) summary = <>Busca inválida: use letras, números, <kbd>?</kbd> e <kbd>*</kbd>.</>;
  else if (searching) summary = <>{plural(baseCells.length, 'resultado', 'resultados')} em {where}: {countsLine(counts)}.</>;
  else if (block)
    summary = (
      <>
        <strong>{block.prefix}</strong> · {where}: {countsLine(counts)}, de {formatNumber(baseCells.length)}.
      </>
    );
  else summary = <>Escolha um estado para ver a grade, ou faça uma busca.</>;

  return (
    <div class="tool-root">
      <StaleNotice dataDate={dataDate} />
      <SearchField
        id="cs-query"
        value={query}
        onInput={(q) => set({ query: q })}
        placeholder="PY2RB, RBR, PY2?AB, *RB"
        autocapitalize="characters"
        hint={
          <>
            Digite um indicativo, só o sufixo, ou use <kbd>?</kbd> para uma letra qualquer e <kbd>*</kbd> para várias.
          </>
        }
      />
      <FilterBar state={state} set={set} prefixes={searching ? [] : blocks.map((b) => b.prefix)} />

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
            (searching || block) && (
              <p class="tool-empty">{baseCells.length > 0 ? 'Nenhum indicativo livre aqui.' : 'Nenhum indicativo encontrado.'}</p>
            )
          )}
        </div>
        {selected && <DetailPanel callsign={selected} index={index} onClose={() => select(undefined)} renderCell={cellButton} />}
      </div>

      <Legend />
      <HowItWorks />
    </div>
  );
}

export default function CallsignTool({ dataDate }: { dataDate?: string }) {
  const data = useCallsignIndex();
  if (data.state === 'loading') return <Loading message="Carregando a base de indicativos…" />;
  if (data.state === 'error') return <LoadError detail={data.message} onRetry={data.retry} />;
  return <Browser index={data.index} dataDate={dataDate} />;
}
