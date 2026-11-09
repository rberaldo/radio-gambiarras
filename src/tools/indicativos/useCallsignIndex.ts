// Loads the callsign data once, lazily, and indexes it. The files are
// imported with ?url so the build fingerprints them: browsers can cache them
// until the data changes.
import { useCallback, useEffect, useState } from 'preact/hooks';
import takenUrl from '../../../data/callsigns/taken.json?url';
import releasedUrl from '../../../data/callsigns/released.json?url';
import { buildIndex, type CallsignIndex, type ReleasedFile, type TakenFile } from '../../lib/callsigns/index.ts';

export type LoadState =
  | { state: 'loading' }
  | { state: 'ready'; index: CallsignIndex }
  | { state: 'error'; message: string };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ao baixar ${url}`);
  return (await res.json()) as T;
}

let cached: Promise<CallsignIndex> | undefined;

function load(): Promise<CallsignIndex> {
  cached ??= Promise.all([getJson<TakenFile>(takenUrl), getJson<ReleasedFile>(releasedUrl)])
    .then(([taken, released]) => buildIndex(taken, released))
    .catch((err: unknown) => {
      cached = undefined;
      throw err;
    });
  return cached;
}

export function useCallsignIndex(): LoadState & { retry: () => void } {
  const [result, setResult] = useState<LoadState>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setResult({ state: 'loading' });
    load().then(
      (index) => alive && setResult({ state: 'ready', index }),
      (err: unknown) => alive && setResult({ state: 'error', message: err instanceof Error ? err.message : String(err) }),
    );
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...result, retry };
}
