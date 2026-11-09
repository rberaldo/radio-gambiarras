// "Visada" in the detail panel: whether the repeater's antenna can be seen
// from where the person is, with a terrain profile drawn like a 1995 chart.
import { formatDecimal, formatNumber } from '../../lib/format.ts';
import type { Point } from '../../lib/repeaters/geo.ts';
import type { Repeater } from '../../lib/repeaters/merge.ts';
import { bulgeM, fresnelM, lineM, type LosResult, type ProfilePoint } from '../../lib/radio/los.ts';
import { REPEATER_HEIGHT_M, YOU_HEIGHT_M, antennaSite, useProfile } from './useLineOfSight.ts';

const km = (n: number) => `${formatDecimal(n, n < 10 ? 1 : 0)} km`;

export const VERDICT_TEXT: Record<LosResult['verdict'], string> = {
  livre: 'visada livre',
  limite: 'no limite',
  bloqueada: 'bloqueada',
};

function explain(r: LosResult): string {
  if (r.verdict === 'livre') return 'Nada no caminho entre você e a antena, com folga.';
  // The data counts roofs and treetops, so the obstacle may be a hill, a building or a forest.
  const where = `a ${km(r.worst.km)} de você, num ponto a ${formatNumber(Math.round(r.worst.elevM))} m de altitude`;
  if (r.verdict === 'limite') return `O caminho fica apertado ${where}: o sinal pode chegar fraco ou falhar.`;
  return `Relevo, prédios ou mata cortam a linha ${where}. Em VHF e UHF o sinal ainda pode contornar o obstáculo, mas chega fraco, se chegar.`;
}

const W = 300;
const H = 120;
const PAD = { left: 4, right: 4, top: 10, bottom: 14 };

/** The profile as SVG: ground (with the Earth's bulge), the line between antennas and 60% of the Fresnel zone. */
function Chart({ profile, result, freqMHz }: { profile: ProfilePoint[]; result: LosResult; freqMHz: number }) {
  const L = result.lengthKm || 1;
  const ground = profile.map((p) => p.elevM + bulgeM(p.km, L));
  const line = (k: number) => lineM(profile, k, YOU_HEIGHT_M, REPEATER_HEIGHT_M);
  const zone = (k: number) => line(k) - 0.6 * fresnelM(k, L, freqMHz);
  const lo = Math.min(...ground, ...profile.map((p) => zone(p.km)));
  const hi = Math.max(...ground, line(0), line(L));
  const span = hi - lo || 1;
  const x = (k: number) => PAD.left + (k / L) * (W - PAD.left - PAD.right);
  const y = (m: number) => PAD.top + (1 - (m - lo) / span) * (H - PAD.top - PAD.bottom);
  const groundPath = `M${x(0)},${H - PAD.bottom} ${profile.map((p, i) => `L${x(p.km).toFixed(1)},${y(ground[i]!).toFixed(1)}`).join(' ')} L${x(L)},${H - PAD.bottom} Z`;
  const zonePath = profile.map((p, i) => `${i ? 'L' : 'M'}${x(p.km).toFixed(1)},${y(zone(p.km)).toFixed(1)}`).join(' ');
  const worst = result.verdict !== 'livre' ? result.worst : undefined;
  return (
    <svg class="rp-los__chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Perfil do relevo: ${VERDICT_TEXT[result.verdict]}`}>
      <path class="rp-los__ground" d={groundPath} />
      <path class="rp-los__zone" d={zonePath} />
      <line class={`rp-los__line rp-los__line--${result.verdict}`} x1={x(0)} y1={y(line(0))} x2={x(L)} y2={y(line(L))} />
      {worst && <rect class="rp-los__worst" x={x(worst.km) - 3} y={y(worst.elevM + bulgeM(worst.km, L)) - 3} width="6" height="6" />}
      <text class="rp-los__label" x={PAD.left} y={H - 3}>
        você
      </text>
      <text class="rp-los__label" x={W - PAD.right} y={H - 3} text-anchor="end">
        {km(L)}
      </text>
    </svg>
  );
}

export function LineOfSight({ repeater: r, from }: { repeater: Repeater; from?: Point }) {
  const site = antennaSite(r);
  const state = useProfile(r, from);
  if (!site) {
    return (
      <p class="rp-los__note">
        Sem o local da antena (a posição é a sede do município), não dá para calcular a visada. Sabe onde ela fica? Use “Sugerir
        correção”.
      </p>
    );
  }
  if (!from) return <p class="rp-los__note">Escolha um ponto no mapa (ou abra uma trilha) para ver se a antena fica à vista.</p>;
  if (state.status === 'error') return <p class="rp-los__note">Não foi possível carregar o relevo agora.</p>;
  if (state.status === 'loading') return <p class="rp-los__note">Calculando a visada…</p>;
  const { profile, result } = state.value;
  return (
    <div class="rp-los">
      <p class={`rp-los__verdict rp-los__verdict--${result.verdict}`}>
        <strong>{VERDICT_TEXT[result.verdict][0]!.toUpperCase() + VERDICT_TEXT[result.verdict].slice(1)}</strong>
      </p>
      <Chart profile={profile} result={result} freqMHz={r.output} />
      <p class="rp-los__note">
        {explain(result)} Supõe você a {formatDecimal(YOU_HEIGHT_M, 1)} m do chão e a antena a {REPEATER_HEIGHT_M} m
        {r.position?.probable && ', no local provável'}; relevo de satélite, com uns 30 m de detalhe, contando prédios e árvores, menos os que estão a até 250 m de cada ponta. É uma estimativa.
      </p>
    </div>
  );
}
