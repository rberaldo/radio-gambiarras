// What the side panel shows before a point or trail is chosen: how many
// repeaters, how to use the map, and how to read its markers.
import { plural } from '../../lib/format.ts';
import type { BandChoice, ModeChoice, StatusChoice } from '../../lib/repeaters/filter.ts';
import { MissingRepeaterLink } from './MissingRepeaterLink.tsx';

export function RepeaterIntro({ count, band, mode, status }: { count: number; band: BandChoice; mode: ModeChoice; status: StatusChoice }) {
  const digital = mode === 'digital';
  return (
    <div class="rp-intro">
      <p>
        <strong>{plural(count, digital ? 'repetidora digital' : 'repetidora', digital ? 'repetidoras digitais' : 'repetidoras')}</strong>{' '}
        {digital ? 'conhecidas' : 'licenciadas na Anatel'}
        {band !== 'todas' && ' nesta faixa'}
        {status === 'conferidas' && ', já conferidas no ar'}
        {status === 'sem-fora' && ', sem as relatadas fora do ar'}.
      </p>
      <p class="rp-intro__note">
        Lista de repetidoras com licença na Anatel. Elas podem não estar no ar e algumas podem nem ter sido instaladas.
      </p>
      <p>
        Clique num lugar do mapa (um pico, uma cidade) ou use a busca acima para ver as repetidoras ao redor. O botão direito
        apaga a área de busca.
      </p>
      <p>
        Vai fazer uma trilha? Abra o arquivo GPX no botão do mapa ao lado de “Ir” (ou solte o arquivo no mapa) e veja as repetidoras
        ao longo do caminho, na ordem da caminhada.
      </p>
      <p class="rp-intro__note">
        Marcadores cheios indicam a localização da antena; vazios indicam a sede do município. Verde é dentro do raio;
        cinza, relatada fora do ar. Números agrupam várias repetidoras: clique para aproximar ou abrir o grupo.
      </p>
      <p class="rp-intro__note">
        Na lista, o quadradinho ao lado do indicativo é a situação: verde, conferida no ar nos últimos 3 meses; amarelo,
        conferida há mais tempo; contorno vermelho, não abriu no último teste (pode estar só fora do alcance); vermelho,
        fora do ar; cinza, nunca conferida.
      </p>
      <p class="rp-intro__note">
        Losangos são repetidoras digitais (DMR, D-STAR, Fusion); um losango pequeno no canto de um grupo avisa que há
        digitais nele. A Anatel não informa o modo, então só aparecem como digitais as que alguém já informou; as demais
        contam como FM.
      </p>
      <p class="rp-intro__note">
        Falta uma repetidora, ou sabe o subtom e o local de alguma? Abra uma no mapa e use “Sugerir correção”, ou{' '}
        <MissingRepeaterLink>avise sobre uma repetidora nova</MissingRepeaterLink>.
      </p>
    </div>
  );
}
