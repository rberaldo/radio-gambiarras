// A tool's main search box: label, field, "Limpar" and a hint line.
// Ctrl+K (⌘K on Apple devices) focuses it from anywhere on the page; Escape
// in the field clears it. "Limpar" only shows when there is something to
// clear, instead of sitting there disabled (it keeps its space, so the field
// does not jump).
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

interface Props {
  id: string;
  value: string;
  onInput: (value: string) => void;
  placeholder: string;
  hint: ComponentChildren;
  /** Phone keyboards: "characters" for codes such as callsigns. */
  autocapitalize?: 'off' | 'sentences' | 'words' | 'characters';
}

const isApple = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

export function SearchField({ id, value, onInput, placeholder, hint, autocapitalize }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [shortcut, setShortcut] = useState<string>();
  const hintId = `${id}-hint`;

  useEffect(() => {
    setShortcut(isApple() ? '⌘K' : 'Ctrl+K');
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div class="tool-search">
      <label for={id} class="tool-filters__label">
        Buscar
      </label>
      <input
        ref={input}
        id={id}
        class="field tool-search__input"
        type="search"
        value={value}
        placeholder={placeholder}
        autocomplete="off"
        autocapitalize={autocapitalize}
        autocorrect="off"
        spellcheck={false}
        enterkeyhint="search"
        aria-describedby={hintId}
        aria-keyshortcuts="Control+K Meta+K"
        onInput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            onInput('');
          }
        }}
      />
      <button
        class={value ? 'btn tool-search__clear' : 'btn tool-search__clear tool-search__clear--idle'}
        type="button"
        onClick={() => {
          onInput('');
          input.current?.focus();
        }}
      >
        Limpar
      </button>
      <p id={hintId} class="tool-search__hint">
        {hint}
        {shortcut && (
          <span class="tool-search__shortcut">
            {' '}
            Atalho: <kbd>{shortcut}</kbd>
          </span>
        )}
      </p>
    </div>
  );
}
