// The APRS symbol tool: search, table filter, a grid of symbols and a panel
// that shows one symbol large and how to type it.
import { useEffect, useMemo, useState } from 'preact/hooks';
import data from '../../../data/aprs/symbols.json';
import {
  TABLE_NAMES,
  cellOf,
  searchSymbols,
  symbolsFrom,
  type AprsSymbol,
  type AprsSymbolsFile,
} from '../../lib/aprs/symbols.ts';
import { DEFAULT_STATE, TABLE_OF, readState, writeState, type AprsState, type TableChoice } from './urlState.ts';
import './aprs.css';

const SYMBOLS = symbolsFrom(data as AprsSymbolsFile);
const BY_CODE = new Map(SYMBOLS.map((s) => [s.code, s]));

const TABLE_LABELS: Record<TableChoice, string> = { todas: 'Todas', primaria: 'Primária /', alternativa: 'Alternativa \\' };

/** A symbol drawn from hessu's sprite sheet for its table. */
function SymbolIcon({ symbol, size }: { symbol: AprsSymbol; size: number }) {
  const { column, row } = cellOf(symbol.char);
  return (
    <span
      class={symbol.table === '/' ? 'aprs-icon' : 'aprs-icon aprs-icon--alt'}
      style={{ '--size': `${size}px`, '--col': column, '--row': row }}
      aria-hidden="true"
    />
  );
}

function Panel({ symbol, onClose }: { symbol: AprsSymbol; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [symbol.code]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(symbol.code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <aside
      class="tool-panel panel-raised"
      aria-label={`Símbolo ${symbol.code}: ${symbol.description}`}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <header class="tool-panel__head">
        <SymbolIcon symbol={symbol} size={64} />
        <p class="aprs-panel__title">{symbol.description}</p>
        <button class="tool-panel__close" type="button" onClick={onClose} aria-label="Fechar" title="Fechar">
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <h3 class="aprs-panel__heading">Como digitar</h3>
      <dl class="tool-panel__facts">
        <dt>Tabela</dt>
        <dd>
          {TABLE_NAMES[symbol.table]} <code class="aprs-char">{symbol.table}</code>
        </dd>
        <dt>Símbolo</dt>
        <dd>
          <code class="aprs-char">{symbol.char}</code>
        </dd>
        <dt>Código</dt>
        <dd class="aprs-panel__code">
          <code>{symbol.code}</code>
          <button class="btn tool-panel__copy" type="button" onClick={copy} aria-label={`Copiar o código ${symbol.code}`}>
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </dd>
      </dl>

      <p>
        O código tem dois caracteres: o da tabela e o do símbolo. Num relatório de posição, o da tabela vai entre a latitude
        e a longitude, e o do símbolo logo depois da longitude:
      </p>
      <p class="aprs-example">
        <code>
          !2254.12S<mark>{symbol.table}</mark>04312.34W<mark>{symbol.char}</mark>
        </code>
      </p>
    </aside>
  );
}

export default function AprsTool() {
  const [state, setState] = useState<AprsState>(() =>
    typeof location === 'undefined' ? DEFAULT_STATE : readState(location.search),
  );
  const set = (s: Partial<AprsState>) => setState((old) => ({ ...old, ...s }));

  useEffect(() => {
    const qs = writeState(state);
    if (qs !== location.search) history.replaceState(null, '', `${location.pathname}${qs}${location.hash}`);
  }, [state]);

  const results = useMemo(() => searchSymbols(SYMBOLS, state.query, TABLE_OF[state.table]), [state.query, state.table]);
  const selected = state.selected ? BY_CODE.get(state.selected) : undefined;
  const searching = state.query.trim() !== '';

  return (
    <div class="tool-root">
      <div class="tool-search">
        <label for="aprs-query" class="tool-filters__label">
          Buscar
        </label>
        <input
          id="aprs-query"
          class="field tool-search__input"
          type="search"
          value={state.query}
          placeholder="carro, casa, />, >"
          autocomplete="off"
          spellcheck={false}
          aria-describedby="aprs-query-hint"
          onInput={(e) => set({ query: (e.currentTarget as HTMLInputElement).value })}
        />
        <button class="btn" type="button" disabled={!state.query} onClick={() => set({ query: '' })}>
          Limpar
        </button>
        <p id="aprs-query-hint" class="tool-search__hint">
          Busque pela descrição (“carro”, “estação meteorológica”) ou pelo código (<code>/&gt;</code> ou só <code>&gt;</code>).
        </p>
      </div>

      <fieldset class="fieldset tool-filters">
        <legend>Filtros</legend>
        <div class="tool-filters__group" role="radiogroup" aria-label="Tabela">
          <span class="tool-filters__label">Tabela</span>
          {(Object.keys(TABLE_LABELS) as TableChoice[]).map((t) => (
            <label class="check" key={t}>
              <input type="radio" name="aprs-table" checked={state.table === t} onChange={() => set({ table: t })} />
              {TABLE_LABELS[t]}
            </label>
          ))}
        </div>
      </fieldset>

      <p class="tool-summary" aria-live="polite">
        {searching
          ? `${results.length} ${results.length === 1 ? 'símbolo encontrado' : 'símbolos encontrados'}`
          : `${results.length} símbolos`}
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
        {selected && <Panel symbol={selected} onClose={() => set({ selected: undefined })} />}
      </div>
    </div>
  );
}
