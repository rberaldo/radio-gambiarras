// Copies a short text to the clipboard and says so, on the button and to
// screen readers. The confirmation resets when the text changes.
import { useEffect, useState } from 'preact/hooks';

interface Props {
  text: string;
  /** Accessible name, e.g. "Copiar PY2RB". */
  label: string;
  class?: string;
}

export function CopyButton({ text, label, class: className }: Props) {
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [text]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button class={className ? `btn ${className}` : 'btn'} type="button" onClick={copy} aria-label={label}>
      <span aria-live="polite">{copied ? 'Copiado!' : 'Copiar'}</span>
    </button>
  );
}
