// Filters of the callsign tool: class, state, suffix length, prefix, what to show.
import { UFS, UF_NAMES, type LicenseClass } from '../../lib/callsigns/index.ts';
import { Segmented } from '../../ui/Segmented.tsx';
import { SHOW_OPTIONS } from './filters.ts';
import type { ToolState, UfChoice } from './urlState.ts';

const CLASS_OPTIONS = [
  { value: 'AB', label: 'A ou B' },
  { value: 'C', label: 'C' },
] as const satisfies readonly { value: LicenseClass; label: string }[];

const LENGTH_OPTIONS = [
  { value: 2, label: '2 letras' },
  { value: 3, label: '3 letras' },
] as const;

interface Props {
  state: ToolState;
  set: (changes: Partial<ToolState>) => void;
  /** Prefixes of the current state and class; a choice appears when there are several. */
  prefixes: readonly string[];
}

export function FilterBar({ state, set, prefixes }: Props) {
  return (
    <fieldset class="fieldset tool-filters">
      <legend>Filtros</legend>
      <Segmented
        label="Classe"
        name="cs-class"
        options={CLASS_OPTIONS}
        value={state.licenseClass}
        onChange={(licenseClass) => set({ licenseClass, prefix: undefined })}
      />

      <label class="tool-filters__group">
        <span class="tool-filters__label">Estado</span>
        <select
          class="field"
          value={state.uf}
          onChange={(e) => set({ uf: (e.currentTarget as HTMLSelectElement).value as UfChoice, prefix: undefined })}
        >
          <option value="todos">Todos os estados</option>
          {UFS.map((uf) => (
            <option key={uf} value={uf}>
              {uf} – {UF_NAMES[uf]}
            </option>
          ))}
        </select>
      </label>

      {state.licenseClass === 'AB' && (
        <Segmented label="Sufixo" name="cs-length" options={LENGTH_OPTIONS} value={state.length} onChange={(length) => set({ length })} />
      )}

      {prefixes.length > 1 && (
        <label class="tool-filters__group">
          <span class="tool-filters__label">Prefixo</span>
          <select
            class="field"
            value={state.prefix ?? prefixes[0]}
            onChange={(e) => set({ prefix: (e.currentTarget as HTMLSelectElement).value })}
          >
            {prefixes.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      )}

      <Segmented label="Mostrar" name="cs-show" options={SHOW_OPTIONS} value={state.show} onChange={(show) => set({ show })} />
    </fieldset>
  );
}
