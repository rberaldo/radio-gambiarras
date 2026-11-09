// The repeaters inside the circle, nearest first, or along a trail, in
// walking order; with the downloads.
import { useEffect, useRef } from 'preact/hooks';
import { BAND_TEXT, formatKm, formatMHz, formatShift, modeBadge, onAirText, toneText } from '../../lib/repeaters/display.ts';
import { chirpCsv, isChirpable, isFm, spreadsheetCsv } from '../../lib/repeaters/export.ts';
import type { Nearby, Point } from '../../lib/repeaters/geo.ts';
import { formatNumber, plural } from '../../lib/format.ts';
import { CopyButton } from '../../ui/CopyButton.tsx';
import { EmptyState } from '../../ui/EmptyState.tsx';
import type { LosResult } from '../../lib/radio/los.ts';
import { VERDICT_TEXT } from './LineOfSight.tsx';
import { MissingRepeaterLink } from './MissingRepeaterLink.tsx';
import type { ModeChoice } from './urlState.ts';

interface Props {
  nearby: readonly Nearby[];
  /** Line of sight verdicts, for repeaters whose antenna site is known. */
  sight: ReadonlyMap<string, LosResult>;
  radiusKm: number;
  mode: ModeChoice;
  /** The circle's center, passed on when someone reports a missing repeater. */
  center?: Point;
  /** A trail instead of a circle: its name, length and a link to share it. */
  trail?: { name?: string; lengthKm: number; link: string };
  /** Used in file names: where the circle is. */
  label: string;
  activeId?: string;
  /** Row to focus when the list comes back after closing a repeater; onFocused says it was used. */
  focusId?: string;
  onFocused: () => void;
  onSelect: (id: string) => void;
  /** Forget the point or trail (also a right click on the map, which phones do not have). */
  onClear: () => void;
  onWiden?: () => void;
}

/** Why the CHIRP file has fewer repeaters than the list: "O arquivo do CHIRP leva 18: só FM, e sem as 2 relatadas fora do ar." */
function chirpNote(chirpable: number, notFm: number, offAir: number): string {
  if (chirpable === 0) return 'O CHIRP só leva repetidoras FM no ar: nenhuma aqui.';
  const why = [notFm && 'só FM', offAir && `sem ${offAir === 1 ? 'a relatada' : `as ${offAir} relatadas`} fora do ar`].filter(Boolean).join(', e ');
  return `O arquivo do CHIRP leva ${chirpable}: ${why}.`;
}

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ResultsPanel({ nearby, sight, radiusKm, mode, center, trail, label, activeId, focusId, onFocused, onSelect, onClear, onWiden }: Props) {
  const list = useRef<HTMLOListElement>(null);

  // Coming back from a repeater's details: keep the keyboard on its row, once.
  useEffect(() => {
    if (!focusId) return;
    list.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(focusId)}"]`)?.focus();
    onFocused();
  }, []);
  const chirpable = nearby.filter((n) => isChirpable(n.repeater)).length;
  const offAir = nearby.filter((n) => isFm(n.repeater) && !isChirpable(n.repeater)).length;
  const notFm = nearby.length - chirpable - offAir;
  const exact = nearby.filter((n) => n.repeater.position?.exact).length;

  const where = trail ? 'da trilha' : 'deste ponto';
  const clearButton = (
    <button class="btn" type="button" onClick={onClear}>
      Limpar
    </button>
  );
  const trailHead = trail && (
    <div class="rp-top rp-trail">
      <p>
        <strong>{trail.name ?? 'Trilha sem nome'}</strong> · {formatNumber(Math.round(trail.lengthKm))} km
        {nearby.length > 1 && ' · em ordem de caminhada'}
      </p>
      <CopyButton text={trail.link} label="Copiar o link desta trilha" />
      {clearButton}
    </div>
  );

  if (nearby.length === 0) {
    return (
      <>
        {trailHead}
        <EmptyState action={onWiden ? { label: 'Aumentar o raio', onClick: onWiden } : undefined}>
          {mode === 'digital' ? 'Nenhuma repetidora digital conhecida' : 'Nenhuma repetidora'} a até {radiusKm} km {where}. Conhece
          uma?{' '}
          <MissingRepeaterLink picked={center}>Avise</MissingRepeaterLink>.
        </EmptyState>
      </>
    );
  }

  return (
    <section class="rp-results" aria-label={trail ? 'Repetidoras ao longo da trilha' : 'Repetidoras no raio'}>
      {trailHead}
      <div class="rp-top">
        <p class="rp-results__head">
          <strong>{plural(nearby.length, 'repetidora', 'repetidoras')}</strong> a até {radiusKm} km{trail && ' da trilha'}
          {exact < nearby.length && <> · {exact === 0 ? 'todas com posição aproximada' : `${nearby.length - exact} com posição aproximada`}</>}
        </p>
        {!trail && clearButton}
      </div>
      <div class="rp-results__buttons">
        <button class="btn" type="button" onClick={() => download(`repetidoras-${label}.csv`, spreadsheetCsv(nearby))}>
          Baixar CSV
        </button>
        <button class="btn" type="button" disabled={chirpable === 0} onClick={() => download(`chirp-${label}.csv`, chirpCsv(nearby))}>
          Baixar para o CHIRP
        </button>
      </div>
      {chirpable < nearby.length && <p class="rp-results__note">{chirpNote(chirpable, notFm, offAir)}</p>}
      <ol ref={list} class="rp-list" role="list">
        {nearby.map(({ repeater: r, distanceKm, alongKm }) => (
          <li key={r.id}>
            <button type="button" class={r.onAir === false ? 'rp-row rp-row--off' : 'rp-row'} data-id={r.id} aria-pressed={activeId === r.id} onClick={() => onSelect(r.id)}>
              <span class="rp-row__call">{r.callsign}</span>
              <span class="rp-row__freq">
                {formatMHz(r.output)} <small>{formatShift(r.shift)}</small>
                {modeBadge(r) && <span class="rp-badge">{modeBadge(r)}</span>}
              </span>
              <span class="rp-row__dist tabular">{alongKm === undefined ? formatKm(distanceKm) : `km ${formatNumber(Math.round(alongKm))}`}</span>
              <span class="rp-row__meta">
                {alongKm !== undefined && <>a {formatKm(distanceKm)} da trilha · </>}
                {BAND_TEXT[r.band]} · {r.municipio}/{r.uf} · subtom {toneText(r)}
                {r.position && !r.position.exact && ' · posição aproximada'}
                {r.onAir === false && <> · {onAirText(r)}</>}
                {sight.get(r.id) && <span class={`rp-sight rp-sight--${sight.get(r.id)!.verdict}`}> · {VERDICT_TEXT[sight.get(r.id)!.verdict]}</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p class="rp-results__note">
        Falta alguma? <MissingRepeaterLink picked={center}>Avise sobre uma repetidora nova</MissingRepeaterLink>.
      </p>
    </section>
  );
}
