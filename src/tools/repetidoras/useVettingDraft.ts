// The vetting sheet's unsent draft, kept in this browser. Exporting it is
// what makes it durable; storage may be missing or cleared at any time.
import { useCallback, useEffect, useState } from 'preact/hooks';
import type { RowDraft } from '../../lib/repeaters/vettingDraft.ts';

const KEY = 'conferir-rascunho-v1';

function load(): Record<string, RowDraft> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, RowDraft>) : {};
  } catch {
    return {};
  }
}

/** Today in the browser's time zone, ISO. */
export const localToday = () => new Date().toLocaleDateString('sv-SE');

export function useVettingDraft() {
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>(load);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(drafts));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [drafts]);

  const setRow = useCallback(
    (id: string, changes: Partial<RowDraft>) =>
      setDrafts((all) => ({ ...all, [id]: { ...(all[id] ?? { date: localToday() }), ...changes } })),
    [],
  );
  const clearRow = useCallback(
    (id: string) =>
      setDrafts((all) => {
        const { [id]: _gone, ...rest } = all;
        return rest;
      }),
    [],
  );
  /** Rows read from an export replace the same rows in the draft. */
  const mergeIn = useCallback((rows: Record<string, RowDraft>) => setDrafts((all) => ({ ...all, ...rows })), []);
  const clearAll = useCallback(() => setDrafts({}), []);

  return { drafts, saved, setRow, clearRow, mergeIn, clearAll };
}
