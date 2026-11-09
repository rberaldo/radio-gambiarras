// Properties of one callsign: status, when it frees up, phonetics, Morse,
// copy, how to request it, and near misses when it is not available.
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  STATUS_INFO,
  UF_NAMES,
  classify,
  describeFreeFrom,
  dotSeconds,
  freeFrom,
  morse,
  morseUnits,
  nearMisses,
  phonetic,
  statusOf,
  type CallsignIndex,
  type Cell,
} from '../../lib/callsigns/index.ts';
import { formatDecimal } from '../../lib/format.ts';
import { CopyButton } from '../../ui/CopyButton.tsx';
import { ToolPanel } from '../../ui/ToolPanel.tsx';
import { useMorsePlayer } from './morseAudio.ts';

export const REQUEST_URL =
  'https://www.gov.br/anatel/pt-br/regulado/outorga/radioamador-e-radio-cidadao/licenciamento-de-estacoes-do-radioamador';

const SPEEDS = [10, 15, 20, 25, 30];

/** "PY2" → "ponto traço traço ponto, …", for screen readers. */
const spokenMorse = (callsign: string) =>
  morse(callsign)
    .map((code) => [...code].map((sym) => (sym === '.' ? 'ponto' : 'traço')).join(' '))
    .join(', ');

interface Props {
  callsign: string;
  index: CallsignIndex;
  onClose: () => void;
  renderCell: (cell: Cell) => ComponentChildren;
}

export function DetailPanel({ callsign, index, onClose, renderCell }: Props) {
  const status = statusOf(callsign, index);
  const info = STATUS_INFO[status];
  const c = classify(callsign);
  const free = freeFrom(callsign, index);
  const similar = useMemo(() => (info.requestable ? [] : nearMisses(callsign, index)), [callsign, info.requestable, index]);
  const [wpm, setWpm] = useState(20);
  const player = useMorsePlayer();
  const units = morseUnits(callsign);

  useEffect(() => player.stop(), [callsign]);

  const where = c?.uf ? UF_NAMES[c.uf] : c?.island ? 'ilhas oceânicas' : undefined;
  const cls = c ? (c.licenseClass === 'AB' ? 'classes A e B' : 'classe C') : undefined;

  return (
    <ToolPanel
      label={`Propriedades de ${callsign}`}
      onClose={onClose}
      header={
        <>
          <span class={`cs-cell cs-cell--${status} cs-detail__call`}>{callsign}</span>
          <CopyButton text={callsign} label={`Copiar ${callsign}`} class="tool-panel__copy" />
        </>
      }
    >
      <p class="tool-panel__status">
        <strong>{info.label}</strong>
        {where && cls && (
          <>
            {' '}
            · {where}, {cls}
          </>
        )}
      </p>
      <p>{info.description}</p>
      {free && (
        <p>
          <strong>{describeFreeFrom(free)}</strong>
        </p>
      )}

      <dl class="tool-panel__facts">
        <dt>Fonética</dt>
        <dd>{phonetic(callsign).join(' ')}</dd>
        <dt>Morse</dt>
        <dd class="cs-detail__morse" aria-label={spokenMorse(callsign)}>
          {morse(callsign).map((code, i) => (
            <span key={i}>{code.replace(/\./g, '·').replace(/-/g, '−')}</span>
          ))}
        </dd>
        <dt>Duração</dt>
        <dd>
          {units} unidades, {formatDecimal(units * dotSeconds(wpm), 1)} s a {wpm} ppm
        </dd>
      </dl>

      <div class="tool-panel__actions">
        <button class="btn" type="button" onClick={() => (player.playing ? player.stop() : player.play(callsign, wpm))}>
          {player.playing ? '■ Parar' : '▶ Ouvir'}
        </button>
        <label class="tool-panel__speed">
          <span class="visually-hidden">Velocidade</span>
          <select class="field" value={wpm} onChange={(e) => setWpm(Number((e.currentTarget as HTMLSelectElement).value))}>
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s} ppm
              </option>
            ))}
          </select>
        </label>
      </div>

      {info.requestable && (
        <p>
          <a href={REQUEST_URL} target="_blank" rel="noopener">
            Como solicitar este indicativo na Anatel
          </a>
        </p>
      )}

      {similar.length > 0 && (
        <>
          <p>
            <strong>Parecidos e livres:</strong>
          </p>
          <ul class="cs-similar" role="list">
            {similar.map((cell) => (
              <li key={cell.callsign}>{renderCell(cell)}</li>
            ))}
          </ul>
        </>
      )}
    </ToolPanel>
  );
}
