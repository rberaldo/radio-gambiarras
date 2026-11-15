// One place on the planning page: a listed stop or a point picked on the
// map. What it reaches, nearest first, which way each repeater is and whether
// the terrain next to the stop stands in the way; and the way into the outing
// and into the sheet's quick mode.
import { formatNumber, plural } from '../../lib/format.ts';
import { openShare } from '../../lib/radio/horizon.ts';
import { formatKm, formatMHz } from '../../lib/repeaters/display.ts';
import { compass, type Covered } from '../../lib/repeaters/stops.ts';
import { ToolPanel } from '../../ui/ToolPanel.tsx';
import { quickLink, type Place } from './planState.ts';
import type { HorizonState } from './useHorizon.ts';
import { VettingBadge } from './VettingBadge.tsx';

interface Props {
  place: Place;
  covered: readonly Covered[];
  /** For a picked point: its horizon as it is worked out. */
  horizon: HorizonState;
  inOuting: boolean;
  radiusKm: number;
  /** The repeater picked on the map, marked in the list. */
  activeId?: string;
  onToggle: () => void;
  onClose: () => void;
}

function horizonText(place: Place, horizon: HorizonState): string {
  const h = place.horizon ?? (horizon.status === 'ready' ? horizon.horizon : undefined);
  if (h) return `horizonte ${Math.round(openShare(h) * 100)}% aberto`;
  if (horizon.status === 'loading') return 'calculando o horizonte…';
  return 'horizonte desconhecido (conta tudo como aberto)';
}

export function StopDetail({ place, covered, horizon, inOuting, radiusKm, activeId, onToggle, onClose }: Props) {
  const elevM = place.elevM ?? (horizon.status === 'ready' ? horizon.elevM : undefined);
  const open = covered.filter((c) => c.open).length;
  return (
    <ToolPanel label={place.name} header={<h2 class="pl-title">{place.name}</h2>} onClose={onClose} autoFocus>
      <p class="vs-meta">
        {elevM !== undefined && `${formatNumber(elevM)} m · `}
        {horizonText(place, horizon)}
      </p>
      {place.note && <p>{place.note}</p>}
      <p>
        <strong>{plural(covered.length, 'repetidora a conferir', 'repetidoras a conferir')}</strong> a até {radiusKm} km
        {covered.length > 0 && `, ${formatNumber(open)} sem morro na frente`}.
      </p>
      <div class="tool-panel__actions">
        <button class="btn" type="button" onClick={onToggle}>
          {inOuting ? 'Tirar do roteiro' : 'Pôr no roteiro'}
        </button>
        <a class="btn" href={quickLink(place, radiusKm)}>
          Conferir daqui
        </a>
      </div>
      {covered.length > 0 && (
        <ul class="pl-covered">
          {covered.map((c) => (
            <li key={c.repeater.id} class={c.repeater.id === activeId ? 'pl-covered--active' : undefined} aria-current={c.repeater.id === activeId || undefined}>
              <span class="vs-call">{c.repeater.callsign}</span> <span class="vs-freq">{formatMHz(c.repeater.output)}</span>
              <span class="vs-meta">
                {formatKm(c.distanceKm)} {compass(c.bearing)}
                {c.open ? '' : ' · atrás de um morro'}
                {c.repeater.position?.exact ? '' : ` · sede de ${c.repeater.municipio}`}
              </span>
              <span class="vs-meta">
                <VettingBadge repeater={c.repeater} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </ToolPanel>
  );
}
