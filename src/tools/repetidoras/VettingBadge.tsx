// A repeater's vetting status: a small colored square, with the words next
// to it or, when `compact`, as its accessible name and tooltip.
import type { Repeater } from '../../lib/repeaters/merge.ts';
import { VETTING_TEXT, vettingStatus } from '../../lib/repeaters/vetting.ts';
import { formatDate } from '../../lib/format.ts';

export function vettingLabel(r: Pick<Repeater, 'onAir' | 'onAirDate' | 'checked' | 'checkedHow'>): string {
  const status = vettingStatus(r);
  if (status === 'nunca') return VETTING_TEXT.nunca;
  const when = status === 'fora-do-ar' ? r.onAirDate : r.checked;
  const how = status !== 'fora-do-ar' || r.checked === r.onAirDate ? r.checkedHow : undefined;
  return `${VETTING_TEXT[status]}${when ? ` em ${formatDate(when)}` : ''}${how ? ` (${how})` : ''}`;
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
