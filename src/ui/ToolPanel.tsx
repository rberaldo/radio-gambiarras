// The detail panel beside a tool's grid: a header with the item and a close
// button, then free content. Escape closes it, and closing returns focus to
// the control that opened it, so keyboard users keep their place.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

interface Props {
  /** Accessible name of the panel. */
  label: string;
  /** What goes in the header, left of the close button. */
  header: ComponentChildren;
  onClose: () => void;
  /**
   * Move focus into the panel when it opens. Use it when the panel replaces
   * what was clicked (so Escape and screen readers land in it); leave it off
   * when opening comes from typing in a field that should keep focus.
   */
  autoFocus?: boolean;
  children: ComponentChildren;
}

export function ToolPanel({ label, header, onClose, autoFocus = false, children }: Props) {
  const panel = useRef<HTMLElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    if (autoFocus) panel.current?.focus();
    return () => {
      // Only take focus back if it was in the panel (or got lost with it), and
      // after the panel has left the page.
      const active = document.activeElement;
      const focusWasHere = !active || active === document.body || panel.current?.contains(active);
      const el = opener.current;
      if (!focusWasHere || !(el instanceof HTMLElement)) return;
      requestAnimationFrame(() => {
        if (el.isConnected) el.focus();
      });
    };
  }, []);

  return (
    <aside ref={panel} tabIndex={-1} class="tool-panel panel-raised" aria-label={label} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <header class="tool-panel__head">
        {header}
        <button class="tool-panel__close" type="button" onClick={onClose} aria-label="Fechar" title="Fechar (Esc)">
          <span aria-hidden="true">×</span>
        </button>
      </header>
      {children}
    </aside>
  );
}
