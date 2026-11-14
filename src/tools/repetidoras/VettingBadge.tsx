// A repeater's vetting status: a small colored square, with the words next
// to it or, when `compact`, as its accessible name and tooltip.
import type { Repeater } from '../../lib/repeaters/merge.ts';
import { VETTING_TEXT, vettingStatus } from '../../lib/repeaters/vetting.ts';
import { formatDate } from '../../lib/format.ts';

type Vetted = Pick<Repeater, 'onAir' | 'onAirDate' | 'checked' | 'checkedHow' | 'failed' | 'failedHow'>;

/** "conferida em 11/11/2026 (teste no ar)", "conferida em 15/03/2023, há mais de 3 meses"; `short` leaves out how. */
export function vettingLabel(r: Vetted, short = false): string {
  const status = vettingStatus(r);
  if (status === 'nunca') return VETTING_TEXT.nunca;
  const when = status === 'fora-do-ar' ? r.onAirDate : status === 'nao-abriu' ? r.failed : r.checked;
  const how =
    status === 'nao-abriu' ? r.failedHow : status !== 'fora-do-ar' || r.checked === r.onAirDate ? r.checkedHow : undefined;
  const what = status === 'antiga' ? VETTING_TEXT.recente : VETTING_TEXT[status];
  const age = status === 'antiga' ? ', há mais de 3 meses' : '';
  return `${what}${when ? ` em ${formatDate(when)}` : ''}${age}${how && !short ? ` (${how})` : ''}`;
}

export function VettingBadge({ repeater, compact = false }: { repeater: Repeater; compact?: boolean }) {
  const status = vettingStatus(repeater);
  const label = vettingLabel(repeater);
  return compact ? (
    <span class={`rp-vet rp-vet--${status}`} role="img" aria-label={label} title={label} />
  ) : (
    <span class="rp-vet-text">
      <span class={`rp-vet rp-vet--${status}`} aria-hidden="true" />
      {label}
    </span>
  );
}
