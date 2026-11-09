// A tool's main search box: label, field, "Limpar" and a hint line.
import type { ComponentChildren } from 'preact';

interface Props {
  id: string;
  value: string;
  onInput: (value: string) => void;
  placeholder: string;
  hint: ComponentChildren;
  /** Phone keyboards: "characters" for codes such as callsigns. */
  autocapitalize?: 'off' | 'sentences' | 'words' | 'characters';
}

export function SearchField({ id, value, onInput, placeholder, hint, autocapitalize }: Props) {
  const hintId = `${id}-hint`;
  return (
    <div class="tool-search">
      <label for={id} class="tool-filters__label">
        Buscar
      </label>
      <input
        id={id}
        class="field tool-search__input"
        type="search"
        value={value}
        placeholder={placeholder}
        autocomplete="off"
        autocapitalize={autocapitalize}
        spellcheck={false}
        aria-describedby={hintId}
        onInput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
      />
      <button class="btn" type="button" disabled={!value} onClick={() => onInput('')}>
        Limpar
      </button>
      <p id={hintId} class="tool-search__hint">
        {hint}
      </p>
    </div>
  );
}
