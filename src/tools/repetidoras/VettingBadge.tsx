// A repeater's vetting status: a small colored square, with the words next
// to it or, when `compact`, as its accessible name and tooltip.
import type { Repeater } from '../../lib/repeaters/merge.ts';
import { RECENT_DAYS, VETTING_TEXT, failedSince, vettingStatus } from '../../lib/repeaters/vetting.ts';
import { daysSince, formatDate } from '../../lib/format.ts';

type Vetted = Pick<Repeater, 'onAir' | 'onAirDate' | 'offAirUnconfirmed' | 'checked' | 'checkedHow' | 'failed' | 'failedHow'>;

const on = (date: string | undefined) => (date ? ` em ${formatDate(date)}` : '');

/**
 * "conferida em 11/11/2026 (teste no ar)", "conferida em 15/03/2023, há mais
 * de 3 meses", "nunca conferida; não abriu em 14/11/2026 (teste no ar, de
 * Alto da Boa Vista)". `short` leaves out how, and "nunca conferida" before
 * a failed test.
 */
export function vettingLabel(r: Vetted, short = false): string {
  const status = vettingStatus(r);
  const how = (text: string | undefined) => (text && !short ? ` (${text})` : '');
  if (status === 'fora-do-ar') return `${VETTING_TEXT['fora-do-ar']}${on(r.onAirDate)}${how(r.checked === r.onAirDate ? r.checkedHow : undefined)}`;
  if (status === 'relatada') return `relatada fora do ar${on(r.onAirDate)}, não confirmada`;
  const failed = failedSince(r) ? `não abriu${on(r.failed)}${how(r.failedHow)}` : undefined;
  if (status === 'nunca') return failed ? (short ? failed : `${VETTING_TEXT.nunca}; ${failed}`) : VETTING_TEXT.nunca;
  const old = r.checked && daysSince(r.checked, new Date()) > RECENT_DAYS ? ', há mais de 3 meses' : '';
  const checked = `${VETTING_TEXT.recente}${on(r.checked)}${old}${how(r.checkedHow)}`;
  return failed ? `${checked}; ${failed}` : checked;
}

/** Whether a list row should spell the status out: everything but a plain "nunca conferida". */
export const hasVettingNews = (r: Vetted) => vettingStatus(r) !== 'nunca' || failedSince(r);

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
