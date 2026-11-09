// What the side panel shows before a point or trail is chosen: how many
// repeaters, how to use the map, and how to read its markers.
import { plural } from '../../lib/format.ts';
import type { BandChoice, ModeChoice } from '../../lib/repeaters/filter.ts';
import { MissingRepeaterLink } from './MissingRepeaterLink.tsx';

export function RepeaterIntro({ count, band, mode }: { count: number; band: BandChoice; mode: ModeChoice }) {
  const digital = mode === 'digital';
  return (
    <div class="rp-intro">
      <p>
        <strong>{plural(count, digital ? 'repetidora digital' : 'repetidora', digital ? 'repetidoras digitais' : 'repetidoras')}</strong>{' '}
        {digital ? 'conhecidas' : 'licenciadas na Anatel'}
        {band !== 'todas' && ' nesta faixa'}.
      </p>
      <p class="rp-intro__note">São repetidoras com licença na Anatel: nem todas estão no ar, e algumas nem chegaram a ser instaladas.</p>
      <p>
        Clique num lugar do mapa (um pico, uma cidade) ou use a busca acima para ver as repetidoras ao redor. O botão direito apaga a
        área.
      </p>
      <p class="rp-intro__note">
        Marcadores cheios estão no local da antena; vazios, na sede do município. Verde é dentro do raio; cinza, relatada fora do
        ar. Números agrupam várias repetidoras: clique para aproximar ou abrir o grupo.
      </p>
      <p class="rp-intro__note">
        Losangos são repetidoras digitais (DMR, D-STAR, Fusion), e um grupo só de digitais também; um losango pequeno no canto de um
        grupo avisa que há digitais nele. A Anatel não informa o modo, então só aparecem como digitais as que alguém já informou; as
        demais contam como FM.
      </p>
      <p class="rp-intro__note">
        Falta uma repetidora, ou sabe o subtom e o local de alguma? Abra uma no mapa e use “Sugerir correção”, ou{' '}
        <MissingRepeaterLink>avise sobre uma repetidora nova</MissingRepeaterLink>.
      </p>
    </div>
  );
}
