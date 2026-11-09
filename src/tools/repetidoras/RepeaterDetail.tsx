// Everything known about one repeater, with the accuracy of each piece made clear.
import { correctionUrl, repeaterCorrection } from '../../lib/repeaters/correction.ts';
import { BAND_TEXT, LICENSE_TEXT, formatKm, formatMHz, formatShift, modeBadge, onAirText, toneText } from '../../lib/repeaters/display.ts';
import type { Point } from '../../lib/repeaters/geo.ts';
import type { Repeater } from '../../lib/repeaters/merge.ts';
import { site } from '../../site.ts';
import { formatDate } from '../../lib/format.ts';
import { CopyButton } from '../../ui/CopyButton.tsx';
import { ToolPanel } from '../../ui/ToolPanel.tsx';
import { LineOfSight } from './LineOfSight.tsx';

interface Props {
  repeater: Repeater;
  distanceKm?: number;
  /** Where a line of sight starts: the picked point or the trail's nearest spot. */
  losFrom?: Point;
  /** The point the circle is around, passed on to a correction. */
  picked?: Point;
  onClose: () => void;
}

export function RepeaterDetail({ repeater: r, distanceKm, losFrom, picked, onClose }: Props) {
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
            {modeBadge(r) && <span class="rp-badge">{modeBadge(r)}</span>}
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
        <dd>{formatMHz(r.output)} MHz</dd>
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
              ? `${r.position.probable ? 'provável' : 'exata'}: ${r.position.lat.toFixed(5)}, ${r.position.lon.toFixed(5)}`
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
            <dd class={r.onAir ? undefined : 'rp-unknown'}>{onAirText(r)}</dd>
          </>
        )}
      </dl>
      {r.notes && <p>{r.notes}</p>}
      <h3 class="rp-detail__section">Visada</h3>
      <LineOfSight repeater={r} from={losFrom} />
      {r.correction ? (
        <p class="rp-detail__source">
          Correção de {r.correction.source}, em {formatDate(r.correction.date)}.
        </p>
      ) : (
        <p class="rp-detail__source">
          Dados da Anatel.
          {r.position && !r.position.exact && ' A posição é a sede do município, não o local da antena.'}
          {r.tone === undefined && !r.dcs && ' O subtom é desconhecido até alguém informar.'}
        </p>
      )}
      <div class="rp-suggest">
        <p>
          <strong>Sabe algo desta repetidora?</strong> Subtom, local da antena, modos digitais, se está no ar: conte pelo
          GitHub (precisa de uma conta).
        </p>
        <a class="btn" href={correctionUrl(repeaterCorrection(site.repo, r, location.href, picked))} target="_blank" rel="noopener">
          Sugerir correção
        </a>
      </div>
    </ToolPanel>
  );
}
