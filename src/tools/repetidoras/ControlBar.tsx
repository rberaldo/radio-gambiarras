// Where to look and how far: a place box (a town with repeaters or
// coordinates), a button to open a GPX trail, the radius, the band and the mode.
import { useRef, useState } from 'preact/hooks';
import { iconSvg } from '../../lib/icons.ts';
import { foldAccents } from '../../lib/format.ts';
import { parseCoordinates } from '../../lib/repeaters/coordinates.ts';
import type { Point } from '../../lib/repeaters/geo.ts';
import { Segmented, type SegmentedOption } from '../../ui/Segmented.tsx';
import { RADIUS, type BandChoice, type ModeChoice } from './urlState.ts';

const BAND_OPTIONS: readonly SegmentedOption<BandChoice>[] = [
  { value: 'todas', label: 'Todas' },
  { value: '2m', label: '2 m' },
  { value: '70cm', label: '70 cm' },
];

const MODE_OPTIONS: readonly SegmentedOption<ModeChoice>[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'fm', label: 'FM' },
  { value: 'digital', label: 'Digital' },
];

interface Props {
  /** "Município/UF" → its seat, for the place box suggestions. */
  places: ReadonlyMap<string, Point>;
  radiusKm: number;
  band: BandChoice;
  mode: ModeChoice;
  onGo: (point: Point) => void;
  /** A trail file picked with the button (the same as dropping it on the map). */
  onTrailFile: (file: File) => void;
  onRadius: (km: number) => void;
  onBand: (band: BandChoice) => void;
  onMode: (mode: ModeChoice) => void;
}

export function ControlBar({ places, radiusKm, band, mode, onGo, onTrailFile, onRadius, onBand, onMode }: Props) {
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);

  const go = (e: Event) => {
    e.preventDefault();
    const typed = text.trim();
    if (!typed) return;
    const point = parseCoordinates(typed) ?? places.get(typed) ?? findPlace(places, typed);
    if (point) {
      setProblem(undefined);
      onGo(point);
    } else setProblem('Não encontrei este lugar. Escolha uma cidade da lista ou digite coordenadas (-22,95 -43,28).');
  };

  return (
    <div class="rp-controls">
      <form class="rp-controls__place" onSubmit={go} role="search">
        <label for="rp-place" class="tool-filters__label">
          Lugar
        </label>
        <input
          id="rp-place"
          class="field"
          list="rp-places"
          value={text}
          placeholder="Cidade, ou coordenadas: -22,95 -43,28"
          autocomplete="off"
          enterkeyhint="go"
          aria-describedby={problem ? 'rp-place-problem' : undefined}
          onInput={(e) => setText((e.currentTarget as HTMLInputElement).value)}
        />
        <datalist id="rp-places">
          {[...places.keys()].map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <button class="btn" type="submit">
          Ir
        </button>
        <button
          class="btn rp-controls__trail"
          type="button"
          title="Abrir trilha (GPX)"
          aria-label="Abrir trilha (arquivo GPX)"
          onClick={() => fileInput.current?.click()}
          dangerouslySetInnerHTML={{ __html: iconSvg('trilha', 'width="32" height="32" aria-hidden="true" focusable="false" class="icon"') }}
        />
        <input
          ref={fileInput}
          type="file"
          accept=".gpx,application/gpx+xml"
          hidden
          onChange={(e) => {
            const input = e.currentTarget as HTMLInputElement;
            const file = input.files?.[0];
            // Cleared, so picking the same file again still counts.
            input.value = '';
            if (file) onTrailFile(file);
          }}
        />
      </form>
      {problem && (
        <p id="rp-place-problem" class="rp-controls__problem" role="alert">
          {problem}
        </p>
      )}
      <div class="rp-controls__row">
        <label class="tool-filters__group rp-controls__radius">
          <span class="tool-filters__label">Raio</span>
          <input
            type="range"
            min={RADIUS.min}
            max={RADIUS.max}
            step={RADIUS.step}
            value={radiusKm}
            onInput={(e) => onRadius(Number((e.currentTarget as HTMLInputElement).value))}
          />
          <output class="tabular">{radiusKm} km</output>
        </label>
        <Segmented label="Faixa" name="rp-band" options={BAND_OPTIONS} value={band} onChange={onBand} />
        <Segmented label="Modo" name="rp-mode" options={MODE_OPTIONS} value={mode} onChange={onMode} />
      </div>
    </div>
  );
}

/** Case- and accent-insensitive match on the place name, with or without "/UF". */
function findPlace(places: ReadonlyMap<string, Point>, typed: string): Point | undefined {
  const fold = (s: string) => foldAccents(s).trim();
  const t = fold(typed);
  for (const [name, point] of places) if (fold(name) === t || fold(name.split('/')[0]!) === t) return point;
  return undefined;
}
