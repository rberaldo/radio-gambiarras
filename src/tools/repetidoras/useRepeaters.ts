// Loads Anatel's repeaters (fetched separately, so the map code loads first)
// and merges the overlay corrections.
import { useCallback, useEffect, useState } from 'preact/hooks';
import anatelUrl from '../../../data/repeaters/anatel.json?url';
import overlay from '../../../data/repeaters/overlay.json';
import { mergeRepeaters, type Repeater } from '../../lib/repeaters/merge.ts';
import type { OverlayFile } from '../../lib/repeaters/overlay.ts';
import type { AnatelRepeatersFile } from '../../lib/repeaters/types.ts';

export type RepeatersState =
  | { state: 'loading' }
  | { state: 'ready'; repeaters: Repeater[] }
  | { state: 'error'; message: string };

export function useRepeaters(): RepeatersState & { retry: () => void } {
  const [result, setResult] = useState<RepeatersState>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setResult({ state: 'loading' });
    fetch(anatelUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<AnatelRepeatersFile>;
      })
      .then((file) => {
        const repeaters = mergeRepeaters(file.repeaters, overlay as OverlayFile);
        if (alive) setResult({ state: 'ready', repeaters });
      })
      .catch((err: unknown) => alive && setResult({ state: 'error', message: err instanceof Error ? err.message : String(err) }));
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...result, retry };
}
