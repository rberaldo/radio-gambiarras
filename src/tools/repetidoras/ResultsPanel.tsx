// The repeaters inside the circle, nearest first, with the downloads.
import { useEffect, useRef, useState } from 'preact/hooks';
import { correctionUrl, missingRepeater } from '../../lib/repeaters/correction.ts';
import { BAND_TEXT, formatKm, formatMHz, formatShift, toneText } from '../../lib/repeaters/display.ts';
import { chirpCsv, isFm, spreadsheetCsv } from '../../lib/repeaters/export.ts';
import type { Nearby, Point } from '../../lib/repeaters/geo.ts';
import { site } from '../../site.ts';
import { plural } from '../../lib/format.ts';
import { EmptyState } from '../../ui/EmptyState.tsx';

interface Props {
  nearby: readonly Nearby[];
  radiusKm: number;
  /** The circle's center, passed on when someone reports a missing repeater. */
  center: Point;
  /** Used in file names: where the circle is. */
  label: string;
  activeId?: string;
  /** Row to focus when the list comes back after closing a repeater. */
  focusId?: string;
  onSelect: (id: string) => void;
  onWiden?: () => void;
}

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ResultsPanel({ nearby, radiusKm, center, label, activeId, focusId, onSelect, onWiden }: Props) {
  const [firstChannel, setFirstChannel] = useState(1);
  const list = useRef<HTMLOListElement>(null);

  // Coming back from a repeater's details: keep the keyboard on its row.
  useEffect(() => {
    if (focusId) list.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(focusId)}"]`)?.focus();
  }, []);
  const fm = nearby.filter((n) => isFm(n.repeater)).length;
  const exact = nearby.filter((n) => n.repeater.position?.exact).length;

  if (nearby.length === 0) {
    return (
      <EmptyState action={onWiden ? { label: 'Aumentar o raio', onClick: onWiden } : undefined}>
        Nenhuma repetidora a até {radiusKm} km deste ponto. Conhece uma?{' '}
        <a href={correctionUrl(missingRepeater(site.repo, location.href, center))} target="_blank" rel="noopener">
          Avise
        </a>
        .
      </EmptyState>
    );
  }

  return (
    <section class="rp-results" aria-label="Repetidoras no raio">
      <p class="rp-results__head">
        <strong>{plural(nearby.length, 'repetidora', 'repetidoras')}</strong> a até {radiusKm} km
        {exact < nearby.length && <> · {exact === 0 ? 'todas com posição aproximada' : `${nearby.length - exact} com posição aproximada`}</>}
      </p>
      <div class="rp-results__downloads">
        <div class="rp-results__buttons">
          <button class="btn" type="button" onClick={() => download(`repetidoras-${label}.csv`, spreadsheetCsv(nearby))}>
            Baixar CSV
          </button>
          <button class="btn" type="button" disabled={fm === 0} onClick={() => download(`chirp-${label}.csv`, chirpCsv(nearby, firstChannel))}>
            Baixar para o CHIRP
          </button>
        </div>
        <label class="rp-results__channel">
          <span class="tool-filters__label">Canal inicial</span>
          <input
            class="field"
            type="number"
            min={0}
            max={999}
            value={firstChannel}
            onInput={(e) => setFirstChannel(Math.max(0, Number((e.currentTarget as HTMLInputElement).value) || 0))}
          />
        </label>
      </div>
      {fm < nearby.length && <p class="rp-results__note">O arquivo do CHIRP leva só as {fm} repetidoras FM.</p>}
      <ol ref={list} class="rp-list" role="list">
        {nearby.map(({ repeater: r, distanceKm }) => (
          <li key={r.id}>
            <button type="button" class="rp-row" data-id={r.id} aria-pressed={activeId === r.id} onClick={() => onSelect(r.id)}>
              <span class="rp-row__call">{r.callsign}</span>
              <span class="rp-row__freq">
                {formatMHz(r.output)} <small>{formatShift(r.shift)}</small>
              </span>
              <span class="rp-row__dist tabular">{formatKm(distanceKm)}</span>
              <span class="rp-row__meta">
                {BAND_TEXT[r.band]} · {r.municipio}/{r.uf} · subtom {toneText(r)}
                {r.position && !r.position.exact && ' · posição aproximada'}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p class="rp-results__note">
        Falta alguma?{' '}
        <a href={correctionUrl(missingRepeater(site.repo, location.href, center))} target="_blank" rel="noopener">
          Avise sobre uma repetidora nova
        </a>
        .
      </p>
    </section>
  );
}
