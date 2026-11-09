// A labelled group of mutually exclusive options. Native radio buttons, so it
// works with the keyboard (arrow keys) and screen readers; the interior theme
// draws them as a segmented control.

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
}

interface Props<T extends string | number> {
  /** Visible label, also the group's accessible name. */
  label: string;
  /** Unique radio group name. */
  name: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string | number>({ label, name, options, value, onChange }: Props<T>) {
  return (
    <div class="tool-filters__group" role="radiogroup" aria-label={label}>
      <span class="tool-filters__label">{label}</span>
      {options.map((o) => (
        <label class="check" key={o.value}>
          <input type="radio" name={name} checked={o.value === value} onChange={() => onChange(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}
