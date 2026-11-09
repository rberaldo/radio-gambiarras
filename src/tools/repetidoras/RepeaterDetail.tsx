// Everything known about one repeater, with the accuracy of each piece made clear.
import { correctionUrl, repeaterCorrection } from '../../lib/repeaters/correction.ts';
import { BAND_TEXT, LICENSE_TEXT, formatKm, formatMHz, formatShift, toneText } from '../../lib/repeaters/display.ts';
import type { Point } from '../../lib/repeaters/geo.ts';
import type { Repeater } from '../../lib/repeaters/merge.ts';
import { site } from '../../site.ts';
import { formatDate } from '../../lib/format.ts';
import { CopyButton } from '../../ui/CopyButton.tsx';
import { ToolPanel } from '../../ui/ToolPanel.tsx';

interface Props {
  repeater: Repeater;
  distanceKm?: number;
  /** The point the circle is around, passed on to a correction. */
  picked?: Point;
  onClose: () => void;
}

export function RepeaterDetail({ repeater: r, distanceKm, picked, onClose }: Props) {
  return (
    <ToolPanel
      label={`Repetidora ${r.callsign} em ${formatMHz(r.output)} MHz`}
      onClose={onClose}
      autoFocus
      header={
        <>
          <p class="rp-detail__title">
            <strong>{r.callsign}</strong>
            <span class="rp-detail__freq">{formatMHz(r.output)} MHz</span>
          </p>
          <CopyButton text={formatMHz(r.output).replace(',', '.')} label={`Copiar a frequência ${formatMHz(r.output)}`} class="tool-panel__copy" />
        </>
      }
    >
      <p>
        {r.municipio}/{r.uf} · {BAND_TEXT[r.band]}
        {distanceKm !== undefined && <> · {formatKm(distanceKm)} do ponto</>}
      </p>
      <dl class="tool-panel__facts">
        <dt>Saída</dt>
        <dd>{formatMHz(r.output)} MHz (o que você escuta)</dd>
        <dt>Entrada</dt>
        <dd>
          {formatMHz(r.input)} MHz ({formatShift(r.shift)})
        </dd>
        <dt>Subtom</dt>
        <dd class={r.tone === undefined && !r.dcs ? 'rp-unknown' : undefined}>{toneText(r)}</dd>
        {r.modes.length > 0 && (
          <>
            <dt>Modos</dt>
            <dd>{r.modes.join(', ')}</dd>
          </>
        )}
        <dt>Posição</dt>
        <dd>
          {r.position
            ? r.position.exact
              ? `exata: ${r.position.lat.toFixed(5)}, ${r.position.lon.toFixed(5)}`
              : `aproximada: sede de ${r.municipio}`
            : 'desconhecida'}
        </dd>
        <dt>Licença</dt>
        <dd>
          {LICENSE_TEXT[r.license]}
          {r.validUntil && ` até ${formatDate(r.validUntil)}`}
        </dd>
        {r.onAir !== undefined && (
          <>
            <dt>No ar</dt>
            <dd>{r.onAir ? 'confirmada no ar' : 'relatada fora do ar'}</dd>
          </>
        )}
      </dl>
      {r.notes && <p>{r.notes}</p>}
      {r.correction ? (
        <p class="rp-detail__source">
          Correção de {r.correction.source}, em {formatDate(r.correction.date)}.
        </p>
      ) : (
        <p class="rp-detail__source">
          Dados da Anatel. A posição é a sede do município e o subtom é desconhecido até alguém informar.
        </p>
      )}
      <div class="rp-suggest">
        <p>
          <strong>Sabe algo desta repetidora?</strong> Subtom, local da antena, modos digitais, se está no ar: conte pelo
          GitHub (precisa de uma conta). Alguém confere e o mapa se atualiza.
        </p>
        <a class="btn" href={correctionUrl(repeaterCorrection(site.repo, r, location.href, picked))} target="_blank" rel="noopener">
          Sugerir correção
        </a>
      </div>
    </ToolPanel>
  );
}
