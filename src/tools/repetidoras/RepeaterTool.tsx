// The repeater map tool: pick a point (click, place box or location), see
// the repeaters within the radius, open one, download the list.
import { useMemo, useState } from 'preact/hooks';
import { withinRadius, type Point } from '../../lib/repeaters/geo.ts';
import type { Repeater } from '../../lib/repeaters/merge.ts';
import { plural } from '../../lib/format.ts';
import { Loading, LoadError } from '../../ui/LoadState.tsx';
import { useUrlState } from '../../ui/useUrlState.ts';
import { ControlBar } from './ControlBar.tsx';
import { RepeaterDetail } from './RepeaterDetail.tsx';
import { RepeaterMap, type Focus } from './RepeaterMap.tsx';
import { ResultsPanel } from './ResultsPanel.tsx';
import { useRepeaters } from './useRepeaters.ts';
import { DEFAULT_STATE, RADIUS, readState, writeState } from './urlState.ts';
import './repeaters.css';

/** "Município/UF" → seat, from the repeaters' approximate positions. */
function placesOf(repeaters: readonly Repeater[]): Map<string, Point> {
  const places = new Map<string, Point>();
  for (const r of repeaters) {
    if (r.position && !r.position.exact) places.set(`${r.municipio}/${r.uf}`, { lat: r.position.lat, lon: r.position.lon });
  }
  return new Map([...places].sort(([a], [b]) => a.localeCompare(b, 'pt-BR')));
}

function Tool({ repeaters }: { repeaters: Repeater[] }) {
  const [state, set] = useUrlState(readState, writeState, DEFAULT_STATE);
  const center = state.lat !== undefined && state.lon !== undefined ? { lat: state.lat, lon: state.lon } : undefined;
  // The map moves only when asked (place box, location, opening a link), not on every click.
  const [focus, setFocus] = useState<Focus | undefined>(() => (center ? { center, radiusKm: state.radiusKm } : undefined));

  const shown = useMemo(() => (state.band === 'todas' ? repeaters : repeaters.filter((r) => r.band === state.band)), [repeaters, state.band]);
  const places = useMemo(() => placesOf(repeaters), [repeaters]);
  const nearby = useMemo(() => (center ? withinRadius(shown, center, state.radiusKm) : []), [shown, center?.lat, center?.lon, state.radiusKm]);
  const inside = useMemo(() => new Set(nearby.map((n) => n.repeater.id)), [nearby]);
  const active = state.selected ? repeaters.find((r) => r.id === state.selected) : undefined;
  const activeDistance = active ? nearby.find((n) => n.repeater.id === active.id)?.distanceKm : undefined;

  // The repeater just closed, so the list can put focus back on its row.
  const [lastClosed, setLastClosed] = useState<string>();
  const closeDetail = () => {
    setLastClosed(state.selected);
    set({ selected: undefined });
  };

  const pick = (point: Point) => set({ lat: point.lat, lon: point.lon });
  const go = (point: Point) => {
    pick(point);
    setFocus({ center: point, radiusKm: state.radiusKm });
  };
  const label = center ? `${center.lat.toFixed(3)}_${center.lon.toFixed(3)}_${state.radiusKm}km` : 'brasil';

  return (
    <div class="tool-root">
      <ControlBar
        places={places}
        radiusKm={state.radiusKm}
        band={state.band}
        onGo={go}
        onRadius={(radiusKm) => set({ radiusKm })}
        onBand={(band) => set({ band })}
      />
      <div class="rp-layout">
        <RepeaterMap
          repeaters={shown}
          inside={inside}
          center={center}
          radiusKm={state.radiusKm}
          activeId={state.selected}
          focus={focus}
          onPick={pick}
          onSelect={(selected) => set({ selected })}
        />
        <div class="rp-side">
          {active ? (
            <RepeaterDetail repeater={active} distanceKm={activeDistance} onClose={closeDetail} />
          ) : center ? (
            <ResultsPanel
              nearby={nearby}
              radiusKm={state.radiusKm}
              label={label}
              activeId={state.selected}
              focusId={lastClosed}
              onSelect={(selected) => set({ selected })}
              onWiden={state.radiusKm < RADIUS.max ? () => set({ radiusKm: Math.min(RADIUS.max, state.radiusKm * 2) }) : undefined}
            />
          ) : (
            <div class="rp-intro">
              <p>
                <strong>{plural(shown.length, 'repetidora', 'repetidoras')}</strong> licenciadas na Anatel
                {state.band !== 'todas' && ' nesta faixa'}.
              </p>
              <p>Clique num lugar do mapa (um pico, uma cidade) ou use a busca acima para ver as repetidoras ao redor.</p>
              <p class="rp-intro__note">
                Marcadores vazios estão na sede do município, não no local real da repetidora. Números agrupam várias
                repetidoras: clique para aproximar.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RepeaterTool() {
  const data = useRepeaters();
  if (data.state === 'loading') return <Loading message="Carregando as repetidoras…" />;
  if (data.state === 'error') return <LoadError detail={data.message} onRetry={data.retry} />;
  return <Tool repeaters={data.repeaters} />;
}
