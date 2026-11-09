// The repeater map tool: pick a point (click, place box or location), see
// the repeaters within the radius, open one, download the list. Or drop a
// trail file (hidden for now) and see the repeaters along it.
import { useMemo, useState } from 'preact/hooks';
import { alongTrack, withinRadius, type Point } from '../../lib/repeaters/geo.ts';
import type { Repeater } from '../../lib/repeaters/merge.ts';
import { plural } from '../../lib/format.ts';
import { Loading, LoadError } from '../../ui/LoadState.tsx';
import { useUrlState } from '../../ui/useUrlState.ts';
import { ControlBar } from './ControlBar.tsx';
import { RepeaterDetail } from './RepeaterDetail.tsx';
import { RepeaterMap, type Focus } from './RepeaterMap.tsx';
import { ResultsPanel } from './ResultsPanel.tsx';
import { useRepeaters } from './useRepeaters.ts';
import { DEFAULT_STATE, RADIUS, readState, writeState, type BandChoice, type ModeChoice } from './urlState.ts';
import { isDigital } from '../../lib/repeaters/display.ts';
import { isFm } from '../../lib/repeaters/export.ts';
import { correctionUrl, missingRepeater } from '../../lib/repeaters/correction.ts';
import { site } from '../../site.ts';
import { writeTrackHash } from '../../lib/tracks/link.ts';
import { TrackError } from '../../lib/tracks/read.ts';
import { trackBounds } from '../../lib/tracks/track.ts';
import { TrackDrop } from './TrackDrop.tsx';
import { useTrack } from './useTrack.ts';
import './repeaters.css';

/** "Município/UF" → seat, from the repeaters' approximate positions. */
function placesOf(repeaters: readonly Repeater[]): Map<string, Point> {
  const places = new Map<string, Point>();
  for (const r of repeaters) {
    if (r.position && !r.position.exact) places.set(`${r.municipio}/${r.uf}`, { lat: r.position.lat, lon: r.position.lon });
  }
  return new Map([...places].sort(([a], [b]) => a.localeCompare(b, 'pt-BR')));
}

/** "Travessia Petrópolis–Teresópolis" → "travessia-petropolis-teresopolis", for file names. */
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'trilha';

const MODE_TEST: Record<ModeChoice, (r: Repeater) => boolean> = { todos: () => true, fm: isFm, digital: isDigital };

function filterRepeaters(repeaters: readonly Repeater[], band: BandChoice, mode: ModeChoice): Repeater[] {
  return repeaters.filter((r) => (band === 'todas' || r.band === band) && MODE_TEST[mode](r));
}

function Tool({ repeaters }: { repeaters: Repeater[] }) {
  const [state, set] = useUrlState(readState, writeState, DEFAULT_STATE);
  const center = state.lat !== undefined && state.lon !== undefined ? { lat: state.lat, lon: state.lon } : undefined;
  const { track, loadFile, clearTrack } = useTrack();
  const [trackProblem, setTrackProblem] = useState<string>();
  // The map moves only when asked (place box, location, opening a link, a trail), not on every click.
  const [focus, setFocus] = useState<Focus | undefined>(() =>
    track ? { bounds: trackBounds(track.shown) } : center ? { center, radiusKm: state.radiusKm } : undefined,
  );

  const shown = useMemo(() => filterRepeaters(repeaters, state.band, state.mode), [repeaters, state.band, state.mode]);
  const places = useMemo(() => placesOf(repeaters), [repeaters]);
  // A trail replaces the point: repeaters along it, in walking order.
  const nearby = useMemo(
    () => (track ? alongTrack(shown, track.shared.lines, state.radiusKm) : center ? withinRadius(shown, center, state.radiusKm) : []),
    [shown, track, center?.lat, center?.lon, state.radiusKm],
  );
  const inside = useMemo(() => new Set(nearby.map((n) => n.repeater.id)), [nearby]);
  const active = state.selected ? repeaters.find((r) => r.id === state.selected) : undefined;
  const activeDistance = active ? nearby.find((n) => n.repeater.id === active.id)?.distanceKm : undefined;

  // The repeater just closed, so the list can put focus back on its row.
  const [lastClosed, setLastClosed] = useState<string>();
  const closeDetail = () => {
    setLastClosed(state.selected);
    set({ selected: undefined });
  };

  // With a trail on the map, a click only opens repeaters; the search, location or a right click leave the trail.
  const pick = (point: Point) => !track && set({ lat: point.lat, lon: point.lon });
  const go = (point: Point) => {
    clearTrack();
    set({ lat: point.lat, lon: point.lon });
    setFocus({ center: point, radiusKm: state.radiusKm });
  };
  const clear = () => {
    clearTrack();
    setTrackProblem(undefined);
    set({ lat: undefined, lon: undefined });
  };
  const dropTrack = async (file: File) => {
    try {
      const loaded = await loadFile(file);
      setTrackProblem(undefined);
      set({ lat: undefined, lon: undefined, selected: undefined });
      setFocus({ bounds: trackBounds(loaded.shown) });
    } catch (err) {
      setTrackProblem(err instanceof TrackError ? err.message : 'Não consegui ler este arquivo.');
    }
  };
  const label = track
    ? `trilha-${slug(track.shown.name ?? 'sem-nome')}_${state.radiusKm}km`
    : center
      ? `${center.lat.toFixed(3)}_${center.lon.toFixed(3)}_${state.radiusKm}km`
      : 'brasil';
  const trail = track && {
    name: track.shown.name,
    lengthKm: track.lengthKm,
    link: `${location.origin}${location.pathname}${writeState({ ...state, lat: undefined, lon: undefined, selected: undefined })}${writeTrackHash(track.shared)}`,
  };

  return (
    <div class="tool-root">
      <ControlBar
        places={places}
        radiusKm={state.radiusKm}
        band={state.band}
        mode={state.mode}
        onGo={go}
        onRadius={(radiusKm) => set({ radiusKm })}
        onBand={(band) => set({ band })}
        onMode={(mode) => set({ mode })}
      />
      {trackProblem && (
        <p class="rp-controls__problem" role="alert">
          {trackProblem}
        </p>
      )}
      <TrackDrop onFile={dropTrack}>
      <div class="rp-layout">
        <RepeaterMap
          repeaters={shown}
          track={track?.shown}
          inside={inside}
          center={center}
          radiusKm={state.radiusKm}
          activeId={state.selected}
          focus={focus}
          onPick={pick}
          onClear={clear}
          onSelect={(selected) => set({ selected })}
        />
        <div class="rp-side">
          {active ? (
            <RepeaterDetail repeater={active} distanceKm={activeDistance} picked={center} onClose={closeDetail} />
          ) : center || trail ? (
            <ResultsPanel
              nearby={nearby}
              radiusKm={state.radiusKm}
              mode={state.mode}
              center={center}
              trail={trail}
              label={label}
              activeId={state.selected}
              focusId={lastClosed}
              onSelect={(selected) => set({ selected })}
              onWiden={state.radiusKm < RADIUS.max ? () => set({ radiusKm: Math.min(RADIUS.max, state.radiusKm * 2) }) : undefined}
            />
          ) : (
            <div class="rp-intro">
              <p>
                <strong>{plural(shown.length, state.mode === 'digital' ? 'repetidora digital' : 'repetidora', state.mode === 'digital' ? 'repetidoras digitais' : 'repetidoras')}</strong>{' '}
                {state.mode === 'digital' ? 'conhecidas' : 'licenciadas na Anatel'}
                {state.band !== 'todas' && ' nesta faixa'}.
              </p>
              <p class="rp-intro__note">
                São repetidoras com licença na Anatel: nem todas estão no ar, e algumas nem chegaram a ser instaladas.
              </p>
              <p>
                Clique num lugar do mapa (um pico, uma cidade) ou use a busca acima para ver as repetidoras ao redor. O botão direito
                apaga a área.
              </p>
              <p class="rp-intro__note">
                Marcadores cheios estão no local da antena; vazios, na sede do município. Verde é dentro do raio. Números agrupam
                várias repetidoras: clique para aproximar ou abrir o grupo.
              </p>
              <p class="rp-intro__note">
                Losangos são repetidoras digitais (DMR, D-STAR, Fusion), e um grupo só de digitais também; um losango pequeno no canto
                de um grupo avisa que há digitais nele. A Anatel não informa o modo, então só aparecem como digitais as que alguém já
                informou; as demais contam como FM.
              </p>
              <p class="rp-intro__note">
                Falta uma repetidora, ou sabe o subtom e o local de alguma? Abra uma no mapa e use “Sugerir correção”, ou{' '}
                <a href={correctionUrl(missingRepeater(site.repo, location.href))} target="_blank" rel="noopener">
                  avise sobre uma repetidora nova
                </a>
                .
              </p>
            </div>
          )}
        </div>
      </div>
      </TrackDrop>
    </div>
  );
}

export default function RepeaterTool() {
  const data = useRepeaters();
  if (data.state === 'loading') return <Loading message="Carregando as repetidoras…" />;
  if (data.state === 'error') return <LoadError detail={data.message} onRetry={data.retry} />;
  return <Tool repeaters={data.repeaters} />;
}
