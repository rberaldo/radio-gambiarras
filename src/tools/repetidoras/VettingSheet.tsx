// The maintainer's vetting sheet (/repetidoras/conferir, not linked from the
// site): every repeater of a state as a row to fill in after checking it on
// the air, kept as a draft in this browser and exported as JSON for
// scripts/repeaters/apply-checks.ts. In the field, the quick mode ("perto de
// mim") lists the repeaters around you, nearest first, with one tap for the
// result. The planning page (/repetidoras/conferir/plano) links here with a
// stop as the starting point.
import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import { foldAccents, plural } from '../../lib/format.ts';
import { bearingDeg } from '../../lib/radio/horizon.ts';
import { formatKm } from '../../lib/repeaters/display.ts';
import { distanceKm } from '../../lib/repeaters/geo.ts';
import type { Repeater } from '../../lib/repeaters/merge.ts';
import { needsCheck } from '../../lib/repeaters/stops.ts';
import { validateChecks, vettingStatus, type CheckResult, type ChecksFile, type VettingStatus } from '../../lib/repeaters/vetting.ts';
import { buildExport, checkToDraft, fromText, isEdited, parsePosition, quickResult, type RowDraft } from '../../lib/repeaters/vettingDraft.ts';
import { download } from '../../ui/download.ts';
import { Loading, LoadError } from '../../ui/LoadState.tsx';
import { Segmented } from '../../ui/Segmented.tsx';
import { useUrlState } from '../../ui/useUrlState.ts';
import { QuickRow } from './QuickRow.tsx';
import { usePosition } from './usePosition.ts';
import { useRepeaters } from './useRepeaters.ts';
import { localToday, useVettingDraft } from './useVettingDraft.ts';
import { VettingRow } from './VettingRow.tsx';
import './repeaters.css';
import './vetting.css';

type Show = 'todas' | 'a-conferir' | VettingStatus | 'anotadas';
type Mode = 'planilha' | 'perto';

const SHOW: Record<Show, string> = {
  todas: 'Todas',
  'a-conferir': 'A conferir (nunca, antigas, que falharam, relatadas)',
  nunca: 'Nunca conferidas',
  'fora-do-ar': 'Fora do ar',
  relatada: 'Relatadas fora do ar, não confirmadas',
  recente: 'Conferidas',
  antiga: 'Conferidas há mais de 3 meses ou que falharam depois',
  anotadas: 'Anotadas neste rascunho',
};

const MODES = [
  { value: 'planilha' as const, label: 'Planilha' },
  { value: 'perto' as const, label: 'Perto de mim' },
];
const RADII = [10, 25, 50, 100];

interface SheetState {
  uf: string;
  municipio: string;
  show: Show;
  q: string;
  mode: Mode;
  /** Quick mode: start from this "lat,lon" (a stop from the plan) instead of the GPS. */
  point?: string;
  /** That point's name. */
  place?: string;
  radiusKm: number;
}

const DEFAULTS: SheetState = { uf: 'RJ', municipio: '', show: 'todas', q: '', mode: 'planilha', radiusKm: 50 };

function readSheet(search: string): SheetState {
  const p = new URLSearchParams(search);
  const show = p.get('mostrar') as Show | null;
  return {
    uf: p.get('uf') ?? DEFAULTS.uf,
    municipio: p.get('municipio') ?? '',
    show: show && show in SHOW ? show : 'todas',
    q: p.get('q') ?? '',
    mode: p.get('modo') === 'perto' ? 'perto' : 'planilha',
    point: p.get('ponto') ?? undefined,
    place: p.get('de') ?? undefined,
    radiusKm: RADII.includes(Number(p.get('raio'))) ? Number(p.get('raio')) : DEFAULTS.radiusKm,
  };
}

function writeSheet(s: SheetState): string {
  const p = new URLSearchParams();
  if (s.uf !== DEFAULTS.uf) p.set('uf', s.uf);
  if (s.municipio) p.set('municipio', s.municipio);
  if (s.show !== 'todas') p.set('mostrar', s.show);
  if (s.q) p.set('q', s.q);
  if (s.mode !== DEFAULTS.mode) p.set('modo', s.mode);
  if (s.point) p.set('ponto', s.point);
  if (s.place) p.set('de', s.place);
  if (s.radiusKm !== DEFAULTS.radiusKm) p.set('raio', String(s.radiusKm));
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
  /** Search and "Mostrar", shared by both modes. */
  const shows = useMemo(() => {
    const q = foldAccents(state.q.trim());
    return (r: Repeater) =>
      (!q || foldAccents(`${r.callsign} ${r.output.toFixed(3)} ${r.municipio}`).includes(q)) &&
      (state.show === 'todas' ||
        (state.show === 'anotadas' ? isEdited(drafts[r.id]) : state.show === 'a-conferir' ? needsCheck(r) : vettingStatus(r) === state.show));
  }, [state.q, state.show, drafts]);
  const rows = useMemo(() => inState.filter((r) => (!state.municipio || r.municipio === state.municipio) && shows(r)), [inState, state.municipio, shows]);

  // Quick mode: around the plan's stop, or around you, across state lines.
  const quick = state.mode === 'perto';
  const position = usePosition(quick);
  const fixed = state.point ? parsePosition(state.point) : undefined;
  const stop = fixed === 'invalid' ? undefined : fixed;
  const origin = stop ?? (position.status === 'ready' ? position.point : undefined);
  const near = useMemo(() => {
    if (!quick || !origin) return [];
    return repeaters
      .filter((r) => r.position && shows(r))
      .map((r) => ({ r, km: distanceKm(origin, r.position!), bearing: bearingDeg(origin, r.position!) }))
      .filter((n) => n.km <= state.radiusKm)
      .sort((a, b) => a.km - b.km || a.r.id.localeCompare(b.r.id));
  }, [quick, origin?.lat, origin?.lon, repeaters, shows, state.radiusKm]);
  // Where a quick result was made from: where you are, or else the stop.
  const here = position.status === 'ready' ? fromText(position.point) : (state.place ?? (stop && fromText(stop)));
  const onResult = useCallback((id: string, result: CheckResult) => setRow(id, quickResult(drafts[id], result, today, here)), [drafts, today, here]);
  const onMore = useCallback((r: Repeater) => set({ mode: 'planilha', uf: r.uf, municipio: '', show: 'todas', q: r.callsign }), []);

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

  function exportDownload() {
    const file = exportFile();
    if (!file) return;
    download(`conferencias-${today}.json`, `${JSON.stringify(file, null, 1)}\n`, 'application/json');
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
        {/* Back in the field after "Mais…", which searched for one repeater: show them all again. */}
        <Segmented label="Modo" name="vs-mode" options={MODES} value={state.mode} onChange={(mode) => set(mode === 'perto' ? { mode, q: '' } : { mode })} />
        {quick ? (
          <label class="tool-filters__group">
            <span class="tool-filters__label">Raio</span>
            <select class="field" value={state.radiusKm} onChange={(e) => set({ radiusKm: Number((e.currentTarget as HTMLSelectElement).value) })}>
              {RADII.map((km) => (
                <option value={km} key={km}>
                  {km} km
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
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
          </>
        )}
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

      {quick && (
        <p class="vs-where" role="status">
          <span>
            {stop ? (
              <>
                Perto de <strong>{state.place ?? state.point}</strong>.
                {position.status === 'ready' && ` Você está a ${formatKm(distanceKm(stop, position.point))} dali.`}
              </>
            ) : position.status === 'ready' ? (
              `Perto de você (precisão de ${Math.round(position.accuracyM)} m).`
            ) : position.status === 'error' ? (
              `Sem sua posição: ${position.message}.`
            ) : (
              'Procurando sua posição…'
            )}
          </span>
          {stop && (
            <button class="btn" type="button" onClick={() => set({ point: undefined, place: undefined })}>
              Usar minha posição
            </button>
          )}
        </p>
      )}

      <div class="vs-toolbar">
        <p class="tool-summary">
          <strong>{plural(quick ? near.length : rows.length, 'repetidora', 'repetidoras')}</strong> · {plural(edited, 'anotada', 'anotadas')} no rascunho
          {!saved && ' · o navegador não está guardando o rascunho: exporte antes de sair'}
        </p>
        <div class="vs-toolbar__actions">
          <button class="btn" type="button" onClick={exportDownload}>
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

      {quick ? (
        near.length ? (
          <ul class="vs-quick">
            {near.map((n) => (
              <QuickRow key={n.r.id} repeater={n.r} draft={drafts[n.r.id]} distanceKm={n.km} bearing={n.bearing} onResult={onResult} onMore={onMore} />
            ))}
          </ul>
        ) : (
          origin && <p class="vs-empty">Nenhuma repetidora com esses filtros a até {state.radiusKm} km.</p>
        )
      ) : rows.length ? (
        <table class="vs-table">
          <thead>
            <tr>
              <th scope="col">Repetidora e hoje no site</th>
              <th scope="col">Resultado e data</th>
              <th scope="col">De onde</th>
              <th scope="col">Subtom</th>
              <th scope="col">Posição da antena</th>
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
