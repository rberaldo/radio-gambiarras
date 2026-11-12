// The maintainer's vetting sheet (/repetidoras/conferir, not linked from the
// site): every repeater of a state as a row to fill in after checking it on
// the air, kept as a draft in this browser and exported as JSON for
// scripts/repeaters/apply-checks.ts.
import { useMemo, useRef, useState } from 'preact/hooks';
import { foldAccents, plural } from '../../lib/format.ts';
import type { Repeater } from '../../lib/repeaters/merge.ts';
import { validateChecks, vettingStatus, type ChecksFile, type VettingStatus } from '../../lib/repeaters/vetting.ts';
import { buildExport, checkToDraft, isEdited, type RowDraft } from '../../lib/repeaters/vettingDraft.ts';
import { Loading, LoadError } from '../../ui/LoadState.tsx';
import { useUrlState } from '../../ui/useUrlState.ts';
import { useRepeaters } from './useRepeaters.ts';
import { localToday, useVettingDraft } from './useVettingDraft.ts';
import { VettingRow } from './VettingRow.tsx';
import './repeaters.css';
import './vetting.css';

type Show = 'todas' | VettingStatus | 'anotadas';

const SHOW: Record<Show, string> = {
  todas: 'Todas',
  nunca: 'Nunca conferidas',
  'fora-do-ar': 'Fora do ar',
  recente: 'Conferidas',
  antiga: 'Conferidas há mais de 3 meses',
  anotadas: 'Anotadas neste rascunho',
};

interface SheetState {
  uf: string;
  municipio: string;
  show: Show;
  q: string;
}

const DEFAULTS: SheetState = { uf: 'RJ', municipio: '', show: 'todas', q: '' };

function readSheet(search: string): SheetState {
  const p = new URLSearchParams(search);
  const show = p.get('mostrar') as Show | null;
  return {
    uf: p.get('uf') ?? DEFAULTS.uf,
    municipio: p.get('municipio') ?? '',
    show: show && show in SHOW ? show : 'todas',
    q: p.get('q') ?? '',
  };
}

function writeSheet(s: SheetState): string {
  const p = new URLSearchParams();
  if (s.uf !== DEFAULTS.uf) p.set('uf', s.uf);
  if (s.municipio) p.set('municipio', s.municipio);
  if (s.show !== 'todas') p.set('mostrar', s.show);
  if (s.q) p.set('q', s.q);
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}

const byPlace = (a: Repeater, b: Repeater) => a.municipio.localeCompare(b.municipio, 'pt-BR') || a.output - b.output;
const NONE: Repeater[] = [];

export default function VettingSheet() {
  const data = useRepeaters();
  const repeaters = data.state === 'ready' ? data.repeaters : NONE;
  const [state, set] = useUrlState(readSheet, writeSheet, DEFAULTS);
  const { drafts, saved, setRow, clearRow, mergeIn, clearAll } = useVettingDraft();
  const [message, setMessage] = useState<{ text: string; problem?: boolean }>();
  const fileInput = useRef<HTMLInputElement>(null);
  const today = localToday();

  const ufs = useMemo(() => [...new Set(repeaters.map((r) => r.uf))].sort(), [repeaters]);
  const inState = useMemo(() => repeaters.filter((r) => r.uf === state.uf).sort(byPlace), [repeaters, state.uf]);
  const towns = useMemo(() => [...new Set(inState.map((r) => r.municipio))], [inState]);
  const rows = useMemo(() => {
    const q = foldAccents(state.q.trim());
    return inState.filter(
      (r) =>
        (!state.municipio || r.municipio === state.municipio) &&
        (!q || foldAccents(`${r.callsign} ${r.output.toFixed(3)} ${r.municipio}`).includes(q)) &&
        (state.show === 'todas' || (state.show === 'anotadas' ? isEdited(drafts[r.id]) : vettingStatus(r) === state.show)),
    );
  }, [inState, state.municipio, state.q, state.show, drafts]);

  const edited = Object.values(drafts).filter(isEdited).length;

  function exportFile(): ChecksFile | undefined {
    const { file, problems } = buildExport(drafts, new Date());
    const bad = Object.keys(problems);
    if (bad.length) {
      setMessage({ text: `Corrija antes de exportar: ${bad.join(', ')}.`, problem: true });
      return undefined;
    }
    if (!Object.keys(file.checks).length) {
      setMessage({ text: 'Nada anotado ainda.', problem: true });
      return undefined;
    }
    return file;
  }

  function download() {
    const file = exportFile();
    if (!file) return;
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(file, null, 1)}\n`], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `conferencias-${today}.json` });
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ text: `${plural(Object.keys(file.checks).length, 'conferência exportada', 'conferências exportadas')}.` });
  }

  async function copy() {
    const file = exportFile();
    if (!file) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(file, null, 1));
      setMessage({ text: `${plural(Object.keys(file.checks).length, 'conferência copiada', 'conferências copiadas')} como JSON.` });
    } catch {
      setMessage({ text: 'Não consegui copiar; use Exportar.', problem: true });
    }
  }

  async function importFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as ChecksFile;
      const problems = validateChecks(parsed);
      if (problems.length) throw new Error(problems.slice(0, 3).join('; '));
      const rows: Record<string, RowDraft> = {};
      for (const [id, c] of Object.entries(parsed.checks)) rows[id] = checkToDraft(c);
      mergeIn(rows);
      setMessage({ text: `${plural(Object.keys(rows).length, 'conferência importada', 'conferências importadas')} de ${file.name}.` });
    } catch (err) {
      setMessage({ text: `Não consegui ler ${file.name}: ${err instanceof Error ? err.message : String(err)}`, problem: true });
    }
  }

  function discard() {
    if (edited && !confirm(`Apagar ${plural(edited, 'linha anotada', 'linhas anotadas')} deste rascunho? Exporte antes se quiser guardar.`)) return;
    clearAll();
    setMessage({ text: 'Rascunho apagado.' });
  }

  if (data.state === 'loading') return <Loading message="Carregando as repetidoras…" />;
  if (data.state === 'error') return <LoadError detail={data.message} onRetry={data.retry} />;

  return (
    <div class="vs">
      <fieldset class="fieldset tool-filters">
        <legend>Filtros</legend>
        <label class="tool-filters__group">
          <span class="tool-filters__label">Estado</span>
          <select class="field" value={state.uf} onChange={(e) => set({ uf: (e.currentTarget as HTMLSelectElement).value, municipio: '' })}>
            {ufs.map((uf) => (
              <option key={uf}>{uf}</option>
            ))}
          </select>
        </label>
        <label class="tool-filters__group">
          <span class="tool-filters__label">Município</span>
          <select class="field" value={state.municipio} onChange={(e) => set({ municipio: (e.currentTarget as HTMLSelectElement).value })}>
            <option value="">Todos ({towns.length})</option>
            {towns.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label class="tool-filters__group">
          <span class="tool-filters__label">Mostrar</span>
          <select class="field" value={state.show} onChange={(e) => set({ show: (e.currentTarget as HTMLSelectElement).value as Show })}>
            {Object.entries(SHOW).map(([v, text]) => (
              <option value={v} key={v}>
                {text}
              </option>
            ))}
          </select>
        </label>
        <label class="tool-filters__group vs-search">
          <span class="tool-filters__label">Buscar</span>
          <input class="field" type="search" placeholder="indicativo, frequência, cidade" value={state.q} onInput={(e) => set({ q: (e.currentTarget as HTMLInputElement).value })} />
        </label>
      </fieldset>

      <div class="vs-toolbar">
        <p class="tool-summary">
          <strong>{plural(rows.length, 'repetidora', 'repetidoras')}</strong> · {plural(edited, 'anotada', 'anotadas')} no rascunho
          {!saved && ' · o navegador não está guardando o rascunho: exporte antes de sair'}
        </p>
        <div class="vs-toolbar__actions">
          <button class="btn" type="button" onClick={download}>
            Exportar JSON
          </button>
          <button class="btn" type="button" onClick={copy}>
            Copiar JSON
          </button>
          <button class="btn" type="button" onClick={() => fileInput.current?.click()}>
            Importar…
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" class="visually-hidden" tabIndex={-1} aria-hidden="true" onChange={importFile} />
          <button class="btn" type="button" onClick={discard} disabled={!Object.keys(drafts).length}>
            Apagar rascunho
          </button>
        </div>
        {message && (
          <p class={`vs-message${message.problem ? ' vs-message--problem' : ''}`} role="status">
            {message.text}
          </p>
        )}
      </div>

      {rows.length ? (
        <table class="vs-table">
          <thead>
            <tr>
              <th scope="col">Repetidora e hoje no site</th>
              <th scope="col">Resultado e data</th>
              <th scope="col">Como</th>
              <th scope="col">Subtom</th>
              <th scope="col">Posição</th>
              <th scope="col">Modos</th>
              <th scope="col">Comentário</th>
              <th scope="col">
                <span class="visually-hidden">Desfazer</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <VettingRow key={r.id} repeater={r} draft={drafts[r.id]} today={today} onChange={setRow} onClear={clearRow} />
            ))}
          </tbody>
        </table>
      ) : (
        <p class="vs-empty">Nenhuma repetidora com esses filtros.</p>
      )}
    </div>
  );
}
