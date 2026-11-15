// One repeater in the sheet's quick mode ("perto de mim"): what you need to
// key it up, how far and which way it is, and one tap for the result.
import { memo } from 'preact/compat';
import { compass } from '../../lib/repeaters/stops.ts';
import { formatKm, formatMHz, formatShift, toneText } from '../../lib/repeaters/display.ts';
import type { Repeater } from '../../lib/repeaters/merge.ts';
import type { CheckResult } from '../../lib/repeaters/vetting.ts';
import { isEdited, type RowDraft } from '../../lib/repeaters/vettingDraft.ts';
import { VettingBadge } from './VettingBadge.tsx';

interface Props {
  repeater: Repeater;
  draft: RowDraft | undefined;
  distanceKm: number;
  bearing: number;
  onResult: (id: string, result: CheckResult) => void;
  /** Open this repeater in the full sheet, for tone, position, modes and comments. */
  onMore: (r: Repeater) => void;
}

const BUTTONS: [CheckResult, string][] = [
  ['abriu', 'Abriu'],
  ['nao-abriu', 'Não abriu'],
];

export const QuickRow = memo(function QuickRow({ repeater: r, draft, distanceKm, bearing, onResult, onMore }: Props) {
  const name = `${r.callsign} ${formatMHz(r.output)}`;
  return (
    <li class={`vs-quick__row${isEdited(draft) ? ' vs-row--edited' : ''}`}>
      <div class="vs-quick__what">
        <span class="vs-call">{r.callsign}</span> <span class="vs-freq">{formatMHz(r.output)}</span> <span class="vs-freq">{formatShift(r.shift)}</span>
        <span class="vs-meta">
          subtom {toneText(r)} · <strong>{formatKm(distanceKm)} {compass(bearing)}</strong>
          {r.position?.exact ? '' : ` (sede de ${r.municipio})`}
        </span>
        <span class="vs-meta">
          <VettingBadge repeater={r} />
        </span>
      </div>
      <div class="vs-quick__actions">
        {BUTTONS.map(([result, text]) => (
          <button class="btn" type="button" key={result} aria-pressed={draft?.result === result} aria-label={`${text}: ${name}`} onClick={() => onResult(r.id, result)}>
            {text}
          </button>
        ))}
        <button class="btn vs-quick__more" type="button" aria-label={`Mais campos para ${name}`} title="Subtom, posição, modos e comentário" onClick={() => onMore(r)}>
          Mais…
        </button>
      </div>
    </li>
  );
});
