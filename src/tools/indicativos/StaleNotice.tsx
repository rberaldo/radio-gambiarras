// Warns when Anatel's data is old, computed in the browser so it stays true
// even if nothing has been deployed for a while.
import { daysSince, formatDate } from '../../lib/format.ts';

/** Days after which the data date gets a visible warning. */
export const STALE_DAYS = 14;

export function StaleNotice({ dataDate }: { dataDate?: string }) {
  if (!dataDate) return null;
  const days = daysSince(dataDate);
  if (days <= STALE_DAYS) return null;
  return (
    <p class="cs-stale" role="note">
      <span class="cs-stale__icon" aria-hidden="true">
        !
      </span>
      <span>
        A Anatel não atualiza estes dados desde <strong>{formatDate(dataDate)}</strong> ({days} dias). Indicativos atribuídos
        depois disso aparecerão livres.
      </span>
    </p>
  );
}
