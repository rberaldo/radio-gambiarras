// A tool's state kept in the query string: read once on load, written back
// with replaceState (no history entry per keystroke) whenever it changes.
import { useCallback, useEffect, useState } from 'preact/hooks';

export function useUrlState<T extends object>(
  read: (search: string) => T,
  write: (state: T) => string,
  defaults: T,
): [T, (changes: Partial<T>) => void] {
  const [state, setState] = useState<T>(() => (typeof location === 'undefined' ? defaults : read(location.search)));

  useEffect(() => {
    const qs = write(state);
    if (qs !== location.search) history.replaceState(history.state, '', `${location.pathname}${qs}${location.hash}`);
  }, [state]);

  const update = useCallback((changes: Partial<T>) => setState((old) => ({ ...old, ...changes })), []);
  return [state, update];
}
