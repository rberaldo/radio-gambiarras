// The APRS symbol tool: search, table filter, a grid of symbols and a panel
// that shows one symbol large and how to type it.
import { useMemo } from 'preact/hooks';
import data from '../../../data/aprs/symbols.json';
import { searchSymbols, symbolsFrom, type AprsSymbolsFile } from '../../lib/aprs/symbols.ts';
import { plural } from '../../lib/format.ts';
import { SearchField } from '../../ui/SearchField.tsx';
import { Segmented, type SegmentedOption } from '../../ui/Segmented.tsx';
import { useUrlState } from '../../ui/useUrlState.ts';
import { SymbolIcon } from './SymbolIcon.tsx';
import { SymbolPanel } from './SymbolPanel.tsx';
import { DEFAULT_STATE, TABLE_OF, readState, writeState, type TableChoice } from './urlState.ts';
import './aprs.css';

const SYMBOLS = symbolsFrom(data as AprsSymbolsFile);
const BY_CODE = new Map(SYMBOLS.map((s) => [s.code, s]));

const TABLE_OPTIONS: readonly SegmentedOption<TableChoice>[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'primaria', label: 'Primária /' },
  { value: 'alternativa', label: 'Alternativa \\' },
];

export default function AprsTool() {
  const [state, set] = useUrlState(readState, writeState, DEFAULT_STATE);
  const results = useMemo(() => searchSymbols(SYMBOLS, state.query, TABLE_OF[state.table]), [state.query, state.table]);
  const selected = state.selected ? BY_CODE.get(state.selected) : undefined;
  const searching = state.query.trim() !== '';

  return (
    <div class="tool-root">
      <SearchField
        id="aprs-query"
        value={state.query}
        onInput={(query) => set({ query })}
        placeholder="carro, casa, />, >"
        hint={
          <>
            Busque pela descrição (“carro”, “estação meteorológica”) ou pelo código (<code>/&gt;</code> ou só <code>&gt;</code>).
          </>
        }
      />

      <fieldset class="fieldset tool-filters">
        <legend>Filtros</legend>
        <Segmented label="Tabela" name="aprs-table" options={TABLE_OPTIONS} value={state.table} onChange={(table) => set({ table })} />
      </fieldset>

      <p class="tool-summary" aria-live="polite">
        {searching ? plural(results.length, 'símbolo encontrado', 'símbolos encontrados') : plural(results.length, 'símbolo', 'símbolos')}
      </p>

      <div class={selected ? 'tool-main tool-main--detail' : 'tool-main'}>
        <div class="tool-main__grid">
          {results.length > 0 ? (
            <ul class="aprs-grid tool-scroll" role="list" aria-label="Símbolos APRS">
              {results.map((s) => (
                <li key={s.code}>
                  <button
                    type="button"
                    class="aprs-tile"
                    aria-pressed={selected?.code === s.code}
                    aria-label={`${s.description}, código ${s.code}`}
                    onClick={() => set({ selected: s.code })}
                  >
                    <SymbolIcon symbol={s} size={48} />
                    <code class="aprs-tile__code">{s.code}</code>
                    <span class="aprs-tile__desc">{s.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p class="tool-empty">Nenhum símbolo encontrado.</p>
          )}
        </div>
        {selected && <SymbolPanel symbol={selected} onClose={() => set({ selected: undefined })} />}
      </div>
    </div>
  );
}
