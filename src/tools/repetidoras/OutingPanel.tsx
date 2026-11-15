// The outing being planned: its places in order, what they reach together,
// and the CHIRP file for the day (channels in the order of the stops).
import { plural } from '../../lib/format.ts';
import { chirpCsv, isChirpable } from '../../lib/repeaters/export.ts';
import type { Nearby } from '../../lib/repeaters/geo.ts';
import { download } from '../../ui/download.ts';
import { quickLink, type Place } from './planState.ts';

interface Props {
  places: readonly Place[];
  reached: readonly Nearby[];
  radiusKm: number;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}

export function OutingPanel({ places, reached, radiusKm, onOpen, onRemove }: Props) {
  const chirpable = reached.filter((n) => isChirpable(n.repeater)).length;
  return (
    <section class="rp-results pl-outing" aria-labelledby="pl-outing-title">
      <h2 id="pl-outing-title" class="pl-title">
        Roteiro
      </h2>
      <ol class="pl-outing__places">
        {places.map((p) => (
          <li key={p.id}>
            <button class="pl-link pl-link--name" type="button" onClick={() => onOpen(p.id)}>
              {p.name}
            </button>
            <a class="pl-link" href={quickLink(p, radiusKm)}>
              conferir daqui
            </a>
            <button class="pl-remove" type="button" onClick={() => onRemove(p.id)} aria-label={`Tirar ${p.name} do roteiro`} title="Tirar do roteiro">
              <span aria-hidden="true">×</span>
            </button>
          </li>
        ))}
      </ol>
      <p>
        Juntas alcançam <strong>{plural(reached.length, 'repetidora a conferir', 'repetidoras a conferir')}</strong>.
      </p>
      <button class="btn" type="button" disabled={chirpable === 0} onClick={() => download('chirp-roteiro.csv', chirpCsv(reached))}>
        Baixar para o CHIRP
      </button>
      {chirpable < reached.length && <p class="rp-results__note">O arquivo do CHIRP leva {chirpable}: só FM.</p>}
    </section>
  );
}
