# UI guidelines

How tools on this site should look and behave. Distilled on 2026-11-09 from
reading 98.css, 7.css and system.css, NN/g, GOV.UK Design System, WCAG 2.2,
web.dev and others (sources below). The visual language itself is in
`CLAUDE.md` ("Design language").

## Building blocks (use these, do not re-implement)

| Need | Use |
|---|---|
| State in the URL (shareable, survives reload) | `src/ui/useUrlState.ts` with a tested `readState`/`writeState` pair per tool |
| Main search box | `src/ui/SearchField.tsx` (Ctrl/⌘K focuses, Escape clears, "Limpar" only when there is text) |
| Mutually exclusive options | `src/ui/Segmented.tsx` (native radios, so arrow keys and screen readers work) |
| Detail panel beside a grid | `src/ui/ToolPanel.tsx` (Escape closes, focus returns to the opener; `autoFocus` moves focus into it when it replaces what was clicked) |
| Copy a code | `src/ui/CopyButton.tsx` (inline "Copiado!" plus a polite live region) |
| Nothing to show | `src/ui/EmptyState.tsx`, always with the action that fixes it |
| Data loading | `src/ui/LoadState.tsx` (`Loading`, `LoadError` with retry) |
| Numbers, dates, plurals | `src/lib/format.ts` (`formatNumber`, `formatDecimal`, `formatDate`, `daysSince`, `plural`) |
| Layout of a tool | classes in `src/styles/tool.css`: `tool-root`, `tool-search`, `tool-filters`, `tool-summary`, `tool-main`, `tool-panel`, `tool-scroll`, `tool-empty` |
| Pages | `Desktop` layout (`fit` for tools) and `Window` |

## Typography

- Body text, inputs, results and panels use the system UI font. Pixel fonts
  are accents only: W95FA (`--font-chrome`) for the Windows 95 chrome,
  Departure Mono (`--font-label`) for small labels and codes. Never use a
  pixel font for body text or inputs.
- Departure Mono is crisp at multiples of 11px (`--fs-label`, or twice it);
  W95FA at 16px and up. No synthetic bold on either (`font-synthesis: none`).
- Inputs render at 16px or more, or iOS Safari zooms in on focus.
- Running text is capped at about 72 characters per line. Headings balance
  (`text-wrap: balance`), paragraphs use `text-wrap: pretty`.
- Counts and dates use tabular figures (`.tabular`, `time`).

## Controls

- Targets: at least 24px everywhere (WCAG 2.2 AA) and 44px on touch screens
  (`--target-touch`, applied under `@media (pointer: coarse)`).
- Focus is always visible (dotted 2px outline). Never remove it without a
  replacement.
- Avoid disabled buttons that just sit there grayed out: hide the control
  until it applies, or explain why it does not.
- Filters apply instantly; no "Aplicar" button.
- Labels are specific verbs ("Copiar", "Limpar busca", "Buscar em todos os
  estados"), not "OK".

## Feedback and states

- Feedback is inline and stays on screen (no auto-dismissing toasts).
- Result counts sit in a polite live region that exists from page load.
- Empty states say what happened and offer the fix (clear the search, widen
  the filter, show everything).
- Loading shows a progress state, never a premature "nothing found".

## Keyboard

- Ctrl+K / ⌘K focuses the search; Escape clears it, and closes panels.
- Closing a panel returns focus to what opened it.
- A skip link ("Pular para o conteúdo") is the first focusable element.
  Safari skips links on Tab unless the user enables it (Option+Tab).
- Single-key shortcuts are avoided (WCAG 2.1.4); use a modifier.

## Details

- `color-scheme: light` until a dark theme is designed; `accent-color` and
  `::selection` use navy.
- Respect `prefers-reduced-motion`.
- Print shows only the window content, black on white (`src/styles/print.css`).
- Fonts are self-hosted (`public/fonts/`, OFL); no runtime third-party
  requests.
- Check new UI in Chrome and Safari's engine, at desktop and phone widths, and
  on a touch device profile (`devices['iPhone 13']` in Playwright).

## Sources

- 98.css <https://jdan.github.io/98.css/>, 7.css <https://khang-nd.github.io/7.css/>, system.css <https://sakofchit.github.io/system.css/>
- NN/g on neobrutalism <https://www.nngroup.com/articles/neobrutalism/>, on empty states <https://www.nngroup.com/articles/empty-state-interface-design/>, on toggles <https://www.nngroup.com/articles/toggle-switch-guidelines/>
- WCAG 2.2 target size <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>, focus appearance <https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html>, character key shortcuts <https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html>
- GOV.UK buttons <https://design-system.service.gov.uk/components/button/>, skip link <https://design-system.service.gov.uk/components/skip-link/>
- web.dev font best practices <https://web.dev/articles/font-best-practices>, accent-color <https://web.dev/articles/accent-color>
- Live regions (Sara Soueidan) <https://www.sarasoueidan.com/blog/accessible-notifications-with-aria-live-regions-part-1/>; toasts (Adrian Roselli) <https://adrianroselli.com/2020/01/defining-toast-messages.html>
- Line length and spacing <https://practicaltypography.com/line-length.html>; iOS input zoom <https://css-tricks.com/?p=339455>
