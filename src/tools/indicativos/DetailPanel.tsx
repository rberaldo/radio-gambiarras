// Properties of one callsign: status, when it frees up, phonetics, Morse,
// copy, how to request it, and near misses when it is not available.
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
import { useMorsePlayer } from './morseAudio.ts';

export const REQUEST_URL =
  'https://www.gov.br/anatel/pt-br/regulado/outorga/radioamador-e-radio-cidadao/licenciamento-de-estacoes-do-radioamador';

const SPEEDS = [10, 15, 20, 25, 30];

interface Props {
  callsign: string;
  index: CallsignIndex;
  onClose: () => void;
  renderCell: (cell: Cell) => preact.ComponentChildren;
}

export function DetailPanel({ callsign, index, onClose, renderCell }: Props) {
  const status = statusOf(callsign, index);
  const info = STATUS_INFO[status];
  const c = classify(callsign);
  const free = freeFrom(callsign, index);
  const similar = useMemo(() => (info.requestable ? [] : nearMisses(callsign, index)), [callsign, info.requestable, index]);
  const [wpm, setWpm] = useState(20);
  const [copied, setCopied] = useState(false);
  const player = useMorsePlayer();
  const units = morseUnits(callsign);

  useEffect(() => {
    setCopied(false);
    player.stop();
  }, [callsign]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(callsign);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const where = c?.uf ? UF_NAMES[c.uf] : c?.island ? 'ilhas oceânicas' : undefined;
  const cls = c ? (c.licenseClass === 'AB' ? 'classes A e B' : 'classe C') : undefined;

  return (
    <aside class="cs-detail panel-raised" aria-label={`Propriedades de ${callsign}`}>
      <header class="cs-detail__head">
        <span class={`cs-cell cs-cell--${status} cs-detail__call`}>{callsign}</span>
        <button class="cs-detail__close" type="button" onClick={onClose} aria-label="Fechar propriedades" title="Fechar">
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <p class="cs-detail__status">
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

      <dl class="cs-detail__facts">
        <dt>Fonética</dt>
        <dd>{phonetic(callsign).join(' ')}</dd>
        <dt>Morse</dt>
        <dd class="cs-detail__morse" aria-label={morse(callsign).join(' ').replace(/\./g, 'ponto ').replace(/-/g, 'traço ')}>
          {morse(callsign).map((code, i) => (
            <span key={i}>{code.replace(/\./g, '·').replace(/-/g, '−')}</span>
          ))}
        </dd>
        <dt>Duração</dt>
        <dd>
          {units} unidades, {(units * dotSeconds(wpm)).toFixed(1).replace('.', ',')} s a {wpm} ppm
        </dd>
      </dl>

      <div class="cs-detail__actions">
        <button class="btn" type="button" onClick={() => (player.playing ? player.stop() : player.play(callsign, wpm))}>
          {player.playing ? '■ Parar' : '▶ Ouvir'}
        </button>
        <label class="cs-detail__speed">
          <span class="visually-hidden">Velocidade</span>
          <select class="field" value={wpm} onChange={(e) => setWpm(Number((e.currentTarget as HTMLSelectElement).value))}>
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s} ppm
              </option>
            ))}
          </select>
        </label>
        <button class="btn" type="button" onClick={copy}>
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
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
    </aside>
  );
}
