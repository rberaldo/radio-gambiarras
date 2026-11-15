// The planning page (/repetidoras/conferir/plano, hidden like the sheet):
// where to go to test the repeaters that still need a check. The listed
// stops are ranked by what they reach (src/lib/repeaters/stops.ts); any
// point clicked on the map is scored the same way, its horizon worked out on
// the spot. Stops go into an outing, which suggests the next one, downloads
// a CHIRP file for the day and opens the sheet's quick mode at each stop.
import { useMemo, useState } from 'preact/hooks';
import stopsFile from '../../../data/repeaters/stops.json';
import type { Point } from '../../lib/repeaters/geo.ts';
import type { Repeater } from '../../lib/repeaters/merge.ts';
import { coverage, needsCheck, outingRepeaters, rankStops, type StopsFile } from '../../lib/repeaters/stops.ts';
import { Loading, LoadError } from '../../ui/LoadState.tsx';
import { useUrlState } from '../../ui/useUrlState.ts';
import { OutingPanel } from './OutingPanel.tsx';
import { DEFAULT_PLAN, PLAN_RADII, pointKey, readPlan, resolvePlace, writePlan, type Place } from './planState.ts';
import { RepeaterMap, type Focus, type Mark } from './RepeaterMap.tsx';
import { StopDetail } from './StopDetail.tsx';
import { StopList } from './StopList.tsx';
import { useHorizon } from './useHorizon.ts';
import { useRepeaters } from './useRepeaters.ts';
import './repeaters.css';
import './vetting.css';
import './plan.css';

const { stops } = stopsFile as StopsFile;
const NONE: Repeater[] = [];
const RIO: Focus = { center: { lat: -22.75, lon: -43.1 }, radiusKm: 90 };

export default function StopPlanner() {
  const data = useRepeaters();
  const repeaters = data.state === 'ready' ? data.repeaters : NONE;
  const [state, set] = useUrlState(readPlan, writePlan, DEFAULT_PLAN);
  const [activeId, setActiveId] = useState<string>();
  const [focus] = useState<Focus>(() => {
    const open = state.open ? resolvePlace(state.open, stops) : undefined;
    return open ? { center: open, radiusKm: state.radiusKm } : RIO;
  });

  const pending = useMemo(() => repeaters.filter((r) => needsCheck(r)), [repeaters]);
  const open = state.open ? resolvePlace(state.open, stops) : undefined;
  // A picked point gets its horizon here; a listed stop already has one.
  const horizon = useHorizon(open?.picked ? open : undefined);
  const withHorizon = (p: Place): Place => (p.picked && p.id === open?.id && horizon.status === 'ready' ? { ...p, horizon: horizon.horizon, elevM: horizon.elevM } : p);

  const outing = useMemo(() => state.outing.map((k) => resolvePlace(k, stops)).filter((p): p is Place => !!p).map(withHorizon), [state.outing, horizon]);
  const ranked = useMemo(() => rankStops(stops, outing, pending, state.radiusKm), [outing, pending, state.radiusKm]);
  const reached = useMemo(() => outingRepeaters(outing, pending, state.radiusKm), [outing, pending, state.radiusKm]);
  const shownOpen = open && withHorizon(open);
  const covered = useMemo(() => (shownOpen ? coverage(shownOpen, pending, state.radiusKm) : []), [shownOpen?.id, shownOpen?.horizon, pending, state.radiusKm]);
  const inside = useMemo(() => new Set(covered.map((c) => c.repeater.id)), [covered]);

  const marks = useMemo<Mark[]>(() => {
    const listed = stops.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, chosen: state.outing.includes(s.id) }));
    const picked = [...state.outing, state.open].filter((k): k is string => !!k && !stops.some((s) => s.id === k));
    const extra = [...new Set(picked)].map((k) => resolvePlace(k, stops)).filter((p): p is Place => !!p);
    return [...listed, ...extra.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lon: p.lon, chosen: state.outing.includes(p.id) }))];
  }, [state.outing, state.open]);

  const openPlace = (id: string) => {
    setActiveId(undefined);
    set({ open: id });
  };
  const toggle = (id: string) => set({ outing: state.outing.includes(id) ? state.outing.filter((k) => k !== id) : [...state.outing, id] });

  if (data.state === 'error') return <LoadError detail={data.message} onRetry={data.retry} />;

  return (
    <div class="pl">
      <fieldset class="fieldset tool-filters">
        <legend>Plano</legend>
        <label class="tool-filters__group">
          <span class="tool-filters__label">Alcance</span>
          <select class="field" value={state.radiusKm} onChange={(e) => set({ radiusKm: Number((e.currentTarget as HTMLSelectElement).value) })}>
            {PLAN_RADII.map((km) => (
              <option value={km} key={km}>
                {km} km
              </option>
            ))}
          </select>
        </label>
        <p class="pl-summary">
          {data.state === 'loading' ? 'Carregando as repetidoras…' : `${pending.length} repetidoras a conferir no país; ${stops.length} paradas listadas, no RJ.`}
        </p>
      </fieldset>

      <div class="rp-layout">
        <RepeaterMap
          repeaters={pending}
          inside={inside}
          center={shownOpen}
          radiusKm={state.radiusKm}
          activeId={activeId}
          focus={focus}
          marks={marks}
          activeMark={open?.id}
          label="Mapa das paradas e das repetidoras a conferir"
          onPick={(p: Point) => openPlace(pointKey(p))}
          onClear={() => set({ open: undefined })}
          onSelect={setActiveId}
          onMark={openPlace}
        />
        <div class="rp-side">
          {data.state === 'loading' ? (
            <Loading message="Carregando as repetidoras…" />
          ) : shownOpen ? (
            <StopDetail
              key={shownOpen.id}
              place={shownOpen}
              covered={covered}
              horizon={horizon}
              inOuting={state.outing.includes(shownOpen.id)}
              radiusKm={state.radiusKm}
              activeId={activeId}
              onToggle={() => toggle(shownOpen.id)}
              onClose={() => set({ open: undefined })}
            />
          ) : (
            <>
              {outing.length > 0 && <OutingPanel places={outing} reached={reached} radiusKm={state.radiusKm} onOpen={openPlace} onRemove={toggle} />}
              <StopList ranked={ranked} outing={state.outing} radiusKm={state.radiusKm} onOpen={openPlace} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
