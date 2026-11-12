// One repeater in the vetting sheet: what the site shows today, and the
// cells the maintainer fills in after checking it.
import { memo } from 'preact/compat';
import { useState } from 'preact/hooks';
import { formatMHz, formatShift, toneText } from '../../lib/repeaters/display.ts';
import type { Repeater } from '../../lib/repeaters/merge.ts';
import { CTCSS_TONES } from '../../lib/repeaters/overlay.ts';
import { CHECK_HOWS, CHECK_RESULTS, type CheckHow, type CheckResult } from '../../lib/repeaters/vetting.ts';
import { draftToCheck, isEdited, type RowDraft } from '../../lib/repeaters/vettingDraft.ts';
import { ModesPicker } from './ModesPicker.tsx';
import { VettingBadge } from './VettingBadge.tsx';

interface Props {
  repeater: Repeater;
  draft: RowDraft | undefined;
  today: string;
  onChange: (id: string, changes: Partial<RowDraft>) => void;
  onClear: (id: string) => void;
}

const value = (e: Event) => (e.currentTarget as HTMLInputElement | HTMLSelectElement).value;

function positionText(r: Repeater): string {
  if (!r.position) return 'posição desconhecida';
  if (!r.position.exact) return 'posição: sede do município';
  return `posição ${r.position.probable ? 'provável' : 'exata'}`;
}

function mapLink(r: Repeater): string {
  const p = new URLSearchParams({ rep: r.id });
  if (r.position) {
    p.set('lat', r.position.lat.toFixed(4));
    p.set('lon', r.position.lon.toFixed(4));
  }
  return `/repetidoras?${p}`;
}

export const VettingRow = memo(function VettingRow({ repeater: r, draft, today, onChange, onClear }: Props) {
  const d = draft ?? { date: today };
  const edited = isEdited(draft);
  const problems = edited ? draftToCheck(d).problems : [];
  const name = `${r.callsign} ${formatMHz(r.output)}`;
  const set = (changes: Partial<RowDraft>) => onChange(r.id, changes);
  const [locating, setLocating] = useState(false);

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        set({ position: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}` });
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 20_000 },
    );
  };

  return (
    <tr class={`vs-row${edited ? ' vs-row--edited' : ''}${problems.length ? ' vs-row--problem' : ''}`}>
      <th scope="row" class="vs-cell vs-cell--repeater">
        <span class="vs-call">{r.callsign}</span> <span class="vs-freq">{formatMHz(r.output)}</span>
        <span class="vs-meta">
          {r.municipio} · {formatShift(r.shift)} ·{' '}
          <a href={mapLink(r)} target="_blank" rel="noopener">
            mapa
          </a>
        </span>
        <span class="vs-now">
          <VettingBadge repeater={r} />
          <span class="vs-meta">
            subtom {toneText(r)} · {positionText(r)}
            {r.modes.length > 0 && ` · ${r.modes.join(', ')}`}
          </span>
        </span>
      </th>
      <td class="vs-cell vs-cell--result" data-label="Resultado e data">
        <select class="field" aria-label={`Resultado de ${name}`} value={d.result ?? ''} onChange={(e) => set({ result: (value(e) || undefined) as CheckResult | undefined })}>
          <option value="">—</option>
          {Object.entries(CHECK_RESULTS).map(([v, text]) => (
            <option value={v} key={v}>
              {text}
            </option>
          ))}
        </select>
        <input class="field" type="date" max={today} aria-label={`Data da conferência de ${name}`} value={d.date} onInput={(e) => set({ date: value(e) || today })} />
      </td>
      <td class="vs-cell vs-cell--how" data-label="Como">
        <select class="field" aria-label={`Como conferiu ${name}`} value={d.how ?? 'teste'} onChange={(e) => set({ how: value(e) as CheckHow })}>
          {Object.entries(CHECK_HOWS).map(([v, text]) => (
            <option value={v} key={v}>
              {text}
            </option>
          ))}
        </select>
        {d.how === 'relato' && (
          <input class="field" type="text" placeholder="quem? (indicativo)" aria-label={`Quem relatou ${name}`} value={d.reporter ?? ''} onInput={(e) => set({ reporter: value(e) })} />
        )}
      </td>
      <td class="vs-cell vs-cell--tone" data-label="Subtom">
        <select class="field" aria-label={`Subtom de ${name}`} value={d.tone ?? ''} onChange={(e) => set({ tone: value(e) || undefined })}>
          <option value="">{r.tone === undefined && !r.dcs ? 'não sei' : `manter (${toneText(r)})`}</option>
          <option value="none">nenhum</option>
          <option value="dcs">DCS…</option>
          {CTCSS_TONES.map((hz) => (
            <option value={String(hz)} key={hz}>
              {hz.toFixed(1).replace('.', ',')} Hz
            </option>
          ))}
        </select>
        {d.tone === 'dcs' && (
          <input class="field vs-dcs" type="text" inputMode="numeric" maxLength={3} placeholder="023" aria-label={`Código DCS de ${name}`} value={d.dcs ?? ''} onInput={(e) => set({ dcs: value(e) })} />
        )}
      </td>
      <td class="vs-cell vs-cell--position" data-label="Posição">
        <span class="vs-inline">
          <input class="field" type="text" placeholder="lat, lon" aria-label={`Posição de ${name} (latitude, longitude)`} value={d.position ?? ''} onInput={(e) => set({ position: value(e) })} />
          <button class="btn" type="button" onClick={locate} disabled={locating} aria-label={`Usar minha posição para ${name}`} title="Usar minha posição">
            {locating ? '…' : 'GPS'}
          </button>
        </span>
      </td>
      <td class="vs-cell" data-label="Modos">
        <ModesPicker current={r.modes} value={d.modes} label={`Modos de ${name}`} onChange={(modes) => set({ modes })} />
      </td>
      <td class="vs-cell vs-cell--comment" data-label="Comentário">
        <textarea class="field" rows={1} aria-label={`Comentário sobre ${name}`} value={d.comment ?? ''} onInput={(e) => set({ comment: value(e) })} />
        {problems.length > 0 && (
          <p class="vs-problem" role="status">
            {problems.join('; ')}
          </p>
        )}
      </td>
      <td class="vs-cell vs-cell--clear">
        {draft && (
          <button class="btn" type="button" onClick={() => onClear(r.id)} aria-label={`Desfazer as anotações de ${name}`} title="Desfazer as anotações desta linha">
            ×
          </button>
        )}
      </td>
    </tr>
  );
});
