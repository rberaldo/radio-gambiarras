// The repeater map tool: pick a point (click or place box), see the
// repeaters within the radius, open one, download the list. Or open a GPX
// trail (button or drop) and see the repeaters along it.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { slug } from '../../lib/format.ts';
import { filterRepeaters, offAirLast, placesOf } from '../../lib/repeaters/filter.ts';
import { alongTrack, withinRadius, type Point } from '../../lib/repeaters/geo.ts';
import type { Repeater } from '../../lib/repeaters/merge.ts';
import { writeTrackHash } from '../../lib/tracks/link.ts';
import { TrackError } from '../../lib/tracks/read.ts';
import { trackBounds } from '../../lib/tracks/track.ts';
import { Loading, LoadError } from '../../ui/LoadState.tsx';
import { useUrlState } from '../../ui/useUrlState.ts';
import { ControlBar } from './ControlBar.tsx';
import { RepeaterDetail } from './RepeaterDetail.tsx';
import { RepeaterIntro } from './RepeaterIntro.tsx';
import { RepeaterMap, type Focus } from './RepeaterMap.tsx';
import { ResultsPanel } from './ResultsPanel.tsx';
import { TrackDrop } from './TrackDrop.tsx';
import { useRepeaters } from './useRepeaters.ts';
import { BROKEN_LINK, useTrack } from './useTrack.ts';
import { losFrom, useListLineOfSight } from './useLineOfSight.ts';
import { DEFAULT_STATE, RADIUS, readState, trailLink, writeState } from './urlState.ts';
import './repeaters.css';

const NONE: Repeater[] = [];

export default function RepeaterTool() {
  // The map starts loading at once; the repeaters fill it when their file arrives.
  const data = useRepeaters();
  const repeaters = data.state === 'ready' ? data.repeaters : NONE;

  const [state, set] = useUrlState(readState, writeState, DEFAULT_STATE);
  const center = state.lat !== undefined && state.lon !== undefined ? { lat: state.lat, lon: state.lon } : undefined;
  const { track, brokenLink, loadFile, clearTrack } = useTrack();
  const [trackProblem, setTrackProblem] = useState<string>();
  // The map moves only when asked (place box, location, a link, a trail), not on every click.
  const [focus, setFocus] = useState<Focus | undefined>(() =>
    track ? { bounds: trackBounds(track.shown) } : center ? { center, radiusKm: state.radiusKm } : undefined,
  );

  // A trail replaces the point (a dropped file, a link, a pasted link), and the map frames it.
  const firstTrack = useRef(track);
  useEffect(() => {
    if (!track) return;
    if (center) set({ lat: undefined, lon: undefined });
    if (track !== firstTrack.current) setFocus({ bounds: trackBounds(track.shown) });
  }, [track]);

  const shown = useMemo(() => filterRepeaters(repeaters, state.band, state.mode), [repeaters, state.band, state.mode]);
  const places = useMemo(() => placesOf(repeaters), [repeaters]);
  // Along a trail, in walking order; or around the point, nearest first. Off the air last.
  const nearby = useMemo(
    () => offAirLast(track ? alongTrack(shown, track.shared.lines, state.radiusKm) : center ? withinRadius(shown, center, state.radiusKm) : []),
    [shown, track, center?.lat, center?.lon, state.radiusKm],
  );
  const inside = useMemo(() => new Set(nearby.map((n) => n.repeater.id)), [nearby]);
  const active = state.selected ? shown.find((r) => r.id === state.selected) : undefined;
  const activeNearby = active && nearby.find((n) => n.repeater.id === active.id);
  const activeDistance = activeNearby?.distanceKm;
  // Line of sight for the rows whose antenna site is known, worked out in the background.
  const sight = useListLineOfSight(nearby, center);

  // A repeater hidden by a filter, or unknown (an old link), closes.
  useEffect(() => {
    if (data.state === 'ready' && state.selected && !active) set({ selected: undefined });
  }, [data.state, state.selected, active]);

  // The repeater just closed, so the list can put focus back on its row once.
  const [lastClosed, setLastClosed] = useState<string>();
  const closeDetail = () => {
    setLastClosed(state.selected);
    set({ selected: undefined });
  };

  // With a trail on the map, a click only opens repeaters; the search, location, right click or "Limpar" leave it.
  const pick = (point: Point) => {
    if (track) return;
    if (brokenLink) clearTrack();
    setTrackProblem(undefined);
    set({ lat: point.lat, lon: point.lon });
  };
  const go = (point: Point) => {
    clearTrack();
    setTrackProblem(undefined);
    set({ lat: point.lat, lon: point.lon });
    setFocus({ center: point, radiusKm: state.radiusKm });
  };
  const clear = () => {
    clearTrack();
    setTrackProblem(undefined);
    set({ lat: undefined, lon: undefined, selected: undefined });
  };
  const dropTrack = async (file: File) => {
    try {
      if (!(await loadFile(file))) return;
      setTrackProblem(undefined);
      set({ selected: undefined });
    } catch (err) {
      setTrackProblem(err instanceof TrackError ? err.message : 'Não consegui ler este arquivo.');
    }
  };

  // File names: "repetidoras-trilha-pico-parana_20km.csv", "repetidoras-ponto_-22.913_-43.200_10km.csv".
  const label = track
    ? `trilha-${slug(track.shown.name ?? 'sem-nome')}_${state.radiusKm}km`
    : center
      ? `ponto_${center.lat.toFixed(3)}_${center.lon.toFixed(3)}_${state.radiusKm}km`
      : 'brasil';
  const trail = track && {
    name: track.shown.name,
    lengthKm: track.lengthKm,
    link: trailLink(`${location.origin}${location.pathname}`, state, writeTrackHash(track.shared)),
  };

  const side =
    data.state === 'loading' ? (
      <Loading message="Carregando as repetidoras…" />
    ) : data.state === 'error' ? (
      <LoadError detail={data.message} onRetry={data.retry} />
    ) : active ? (
      <RepeaterDetail repeater={active} distanceKm={activeDistance} losFrom={losFrom(activeNearby, center)} picked={center} onClose={closeDetail} />
    ) : center || trail ? (
      <ResultsPanel
        nearby={nearby}
        sight={sight}
        radiusKm={state.radiusKm}
        mode={state.mode}
        center={center}
        trail={trail}
        label={label}
        activeId={state.selected}
        focusId={lastClosed}
        onFocused={() => setLastClosed(undefined)}
        onSelect={(selected) => set({ selected })}
        onClear={clear}
        onWiden={state.radiusKm < RADIUS.max ? () => set({ radiusKm: Math.min(RADIUS.max, state.radiusKm * 2) }) : undefined}
      />
    ) : (
      <RepeaterIntro count={shown.length} band={state.band} mode={state.mode} />
    );

  return (
    <div class="tool-root">
      <ControlBar
        places={places}
        radiusKm={state.radiusKm}
        band={state.band}
        mode={state.mode}
        onGo={go}
        onTrailFile={dropTrack}
        onRadius={(radiusKm) => set({ radiusKm })}
        onBand={(band) => set({ band })}
        onMode={(mode) => set({ mode })}
      />
      {(trackProblem || brokenLink) && (
        <p class="rp-controls__problem" role="alert">
          {trackProblem ?? BROKEN_LINK}
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
            activeId={active?.id}
            focus={focus}
            onPick={pick}
            onClear={clear}
            onSelect={(selected) => set({ selected })}
          />
          <div class="rp-side">{side}</div>
        </div>
      </TrackDrop>
    </div>
  );
}
