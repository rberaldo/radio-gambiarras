// A compact multiple choice of modes for one sheet row: a disclosure that
// opens a column of checkboxes.
import { MODES, type Mode } from '../../lib/repeaters/overlay.ts';

interface Props {
  /** What the site knows today, shown while nothing is chosen. */
  current: readonly Mode[];
  value: readonly Mode[] | undefined;
  label: string;
  onChange: (modes: Mode[] | undefined) => void;
}

export function ModesPicker({ current, value, label, onChange }: Props) {
  const chosen = value ?? [];
  const toggle = (m: Mode, on: boolean) => {
    const next = MODES.filter((x) => (x === m ? on : chosen.includes(x)));
    onChange(next.length ? next : undefined);
  };
  return (
    <details class="vs-modes">
      <summary class="field" aria-label={label}>
        {chosen.length ? chosen.join(', ') : <span class="vs-keep">{current.length ? `manter (${current.join(', ')})` : 'manter'}</span>}
      </summary>
      <div class="vs-modes__list panel-raised">
        {MODES.map((m) => (
          <label class="check" key={m}>
            <input type="checkbox" checked={chosen.includes(m)} onChange={(e) => toggle(m, (e.currentTarget as HTMLInputElement).checked)} />
            {m}
          </label>
        ))}
      </div>
    </details>
  );
}
