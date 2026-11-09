// The detail panel beside a tool's grid: a header with the item and a close
// button, then free content. Escape closes it.
import type { ComponentChildren } from 'preact';

interface Props {
  /** Accessible name of the panel. */
  label: string;
  /** What goes in the header, left of the close button. */
  header: ComponentChildren;
  onClose: () => void;
  children: ComponentChildren;
}

export function ToolPanel({ label, header, onClose, children }: Props) {
  return (
    <aside class="tool-panel panel-raised" aria-label={label} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <header class="tool-panel__head">
        {header}
        <button class="tool-panel__close" type="button" onClick={onClose} aria-label="Fechar" title="Fechar">
          <span aria-hidden="true">×</span>
        </button>
      </header>
      {children}
    </aside>
  );
}
