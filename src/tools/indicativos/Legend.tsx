// What each cell style means.
import { STATUS_INFO } from '../../lib/callsigns/index.ts';
import { LEGEND_ORDER, STATUS_MARK } from './statusStyle.ts';

export function Legend() {
  return (
    <ul class="cs-legend" aria-label="Legenda">
      {LEGEND_ORDER.map((s) => (
        <li key={s}>
          <span class={`cs-cell cs-cell--${s} cs-legend__swatch`} aria-hidden="true">
            {STATUS_MARK[s] || 'A'}
          </span>
          {STATUS_INFO[s].label}
        </li>
      ))}
    </ul>
  );
}
