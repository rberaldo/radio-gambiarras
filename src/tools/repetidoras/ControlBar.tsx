// Where to look and how far: a place box (a town with repeaters or
// coordinates), "minha localização", the radius and the band.
import { useState } from 'preact/hooks';
import { parseCoordinates } from '../../lib/repeaters/coordinates.ts';
import type { Point } from '../../lib/repeaters/geo.ts';
import { Segmented, type SegmentedOption } from '../../ui/Segmented.tsx';
import { RADIUS, type BandChoice } from './urlState.ts';

const BAND_OPTIONS: readonly SegmentedOption<BandChoice>[] = [
  { value: 'todas', label: 'Todas' },
  { value: '2m', label: '2 m' },
  { value: '70cm', label: '70 cm' },
];

interface Props {
  /** "Município/UF" → its seat, for the place box suggestions. */
  places: ReadonlyMap<string, Point>;
  radiusKm: number;
  band: BandChoice;
  onGo: (point: Point) => void;
  onRadius: (km: number) => void;
  onBand: (band: BandChoice) => void;
}

export function ControlBar({ places, radiusKm, band, onGo, onRadius, onBand }: Props) {
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string>();
  const [locating, setLocating] = useState(false);

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

  const locate = () => {
    if (!navigator.geolocation) return setProblem('Este navegador não informa a localização.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setProblem(undefined);
        onGo({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        setProblem('Não foi possível obter a sua localização (permissão negada ou sinal fraco).');
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
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
        <button class="btn" type="button" onClick={locate} disabled={locating}>
          {locating ? 'Localizando…' : 'Minha localização'}
        </button>
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
      </div>
    </div>
  );
}

/** Case- and accent-insensitive match on the place name, with or without "/UF". */
function findPlace(places: ReadonlyMap<string, Point>, typed: string): Point | undefined {
  const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
  const t = fold(typed);
  for (const [name, point] of places) if (fold(name) === t || fold(name.split('/')[0]!) === t) return point;
  return undefined;
}
