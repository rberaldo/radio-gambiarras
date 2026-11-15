// The planning page's ranking: the stops in the order of what each adds to
// the outing so far, with how many repeaters it reaches and how open it is.
import { formatDecimal, formatNumber, plural } from '../../lib/format.ts';
import { openShare } from '../../lib/radio/horizon.ts';
import type { Ranked, Stop } from '../../lib/repeaters/stops.ts';

interface Props {
  ranked: readonly Ranked<Stop>[];
  outing: readonly string[];
  radiusKm: number;
  onOpen: (id: string) => void;
}

export function StopList({ ranked, outing, radiusKm, onOpen }: Props) {
  const planning = outing.length > 0;
  return (
    <section class="rp-results pl-list" aria-labelledby="pl-list-title">
      <h2 id="pl-list-title" class="pl-title">
        {planning ? 'Próxima parada' : 'Paradas'}
      </h2>
      <p class="rp-results__note">
        {planning
          ? 'Pelo que cada uma acrescenta ao roteiro: repetidoras que ele ainda não alcança, ou alcança pior.'
          : `Pelo que alcançam a até ${radiusKm} km: repetidoras a conferir, valendo mais as próximas e menos as que ficam atrás de um morro.`}{' '}
        Clique no mapa para avaliar outro lugar.
      </p>
      <ol class="pl-stops">
        {ranked.map(({ stop, covered, score, gain }) => {
          const open = covered.filter((c) => c.open).length;
          const value = planning ? gain : score;
          return (
            <li key={stop.id}>
              <button class={`pl-stop${outing.includes(stop.id) ? ' pl-stop--chosen' : ''}`} type="button" onClick={() => onOpen(stop.id)}>
                <span class="pl-stop__name">{stop.name}</span>
                <span class="pl-stop__score" title={planning ? 'Quanto acrescenta ao roteiro' : 'Pontuação'}>
                  {planning ? '+' : ''}
                  {formatDecimal(value, 1)}
                </span>
                <span class="vs-meta">
                  {plural(covered.length, 'a conferir', 'a conferir')} ({formatNumber(open)} sem morro na frente) · {formatNumber(stop.elevM)} m · horizonte{' '}
                  {Math.round(openShare(stop.horizon ?? []) * 100)}% aberto
                  {outing.includes(stop.id) && ' · no roteiro'}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
