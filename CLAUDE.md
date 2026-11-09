# Site de ferramentas para radioamadores

A static website with small, self-contained tools for Brazilian amateur radio
operators. The work plan lives in `ROADMAP.md`; read it before starting any task.

The site is called **Rádio Gambiarras**. The name lives in exactly one place
(`src/site.ts`) so that renaming is a one-line change.

## Decisions already made (do not re-open without asking the user)

- **Audience and language:** Brazilian hams. All user-facing text is PT-BR,
  including URLs (`/indicativos`, `/repetidoras`, `/aprs`, `/sobre`). Code,
  identifiers, comments, commit messages and these docs are in English.
- **Architecture:** fully static. No server, no database, no accounts. All
  searching, filtering, GPX parsing and file export run in the browser.
- **Stack:** Astro + TypeScript, deployed on Netlify. Interactive parts are
  Preact islands; pages that don't need interactivity ship no JavaScript.
- **Design:** Windows 95 desktop chrome with modern amenities (see below).
- **Build order:** shell and landing page, then callsigns (`/indicativos`),
  then the repeater map (`/repetidoras`), then the user's existing APRS icon
  tool is brought into the site (`/aprs`).
- More tools will follow. Every structural choice should make adding the next
  tool cheap.

## Repository layout (target)

```
CLAUDE.md, ROADMAP.md
docs/                   reference notes (data sources, callsign rules)
scripts/                data pipelines, one folder per dataset (Node + TS)
data/                   committed, generated snapshots produced by scripts/
src/
  site.ts               site name, base URL, meta pages
  tools.ts              tool registry, the single source of truth for tools
  layouts/              Desktop (page frame) and Window (a tool's window)
  components/win95/     Window, TitleBar, MenuBar, Button, Field, StatusBar...
  styles/               design tokens and the Win95 stylesheet
  lib/                  pure, framework-free TypeScript (rules, geo, CSV, GPX)
  tools/<slug>/         a tool's islands and tool-specific code
  pages/                routes; one folder per tool, plus index and meta pages
tests/                  Vitest unit tests for src/lib and scripts
```

## Adding a tool

1. Add an entry to `src/tools.ts` (slug, title, short description, icon,
   status: `available`, `soon` or `external`).
2. Create `src/pages/<slug>/index.astro` using the `Window` layout.
3. Put its logic in `src/lib/` (pure, tested) and its UI in `src/tools/<slug>/`.

The landing page, the menu bar and the taskbar all render from the registry.
Never hard-code a list of tools anywhere else. Tools with status `soon` render
grayed out and are not clickable.

## Design language

**Windows 95 frame, modern interior**, built with our own CSS (no UI
framework). Decided with the user on 2026-11-09 after comparing previews.

- **The frame is plain Windows 95:** teal desktop, gray beveled windows, navy
  title bars, the menu bar, status bars, the taskbar with its start menu (Tux
  on the button), pixel-art icons.
- **Window interiors are modern design drawn with 1995's tools**
  (`src/styles/interior.css`, scoped to `.window__body`): a warm paper
  background, square corners, thin 1px gray borders, small *hard* offset
  shadows (never blurred), buttons that sink when pressed, segmented controls
  instead of radio rows, cards instead of group boxes, and the dotted focus
  outline.
- **Two type levels inside windows, never alike:** section titles are the UI
  sans, bold, sentence case, with a small navy square in front; field labels
  are small gray monospace caps.
- **Semantic colors come from the web-safe palette:** navy `#000080` for
  selection, Windows green `#008000` on `#CCFFCC` for free/available,
  `#FFFFCC` for warnings and quarantine. Keep it restrained: an earlier
  version with 2px black borders everywhere looked like Windows high-contrast
  mode and was rejected.
- The landing page is the desktop: one icon per tool.
- Each tool is a window. The window's **menu bar is site navigation only**:
  links to the other tools and to the site's meta pages (home, about). A
  tool's own controls go in a toolbar or form inside the window body, never in
  the menu bar.
- All colors, bevels and spacing come from CSS custom properties in
  `src/styles/` (`--c-*` for the frame, `--m-*` for interiors). Components
  use the tokens, never literal values.

Modern amenities are not optional:

- Responsive: on narrow screens a window is maximized and fills the viewport;
  nothing scrolls horizontally.
- Readable type at real sizes (no tiny pixel fonts for body text), sufficient
  contrast, visible focus rings, full keyboard operation, semantic HTML and
  ARIA where a custom widget needs it.
- State that matters lives in the URL so searches and selections can be
  shared and survive a reload.
- Fast: data is loaded lazily and only the slice a view needs; long lists are
  virtualized.
- Respect `prefers-reduced-motion`. No trackers, no third-party fonts.

## Data

- Datasets are produced by scripts in `scripts/<dataset>/` that download from
  the upstream source, validate, and write compact files into `data/`.
- The site build reads `data/` only. A build never touches the network, so it
  stays reproducible and cannot break because an upstream source is down.
- A scheduled job refreshes `data/`; a pipeline must fail loudly and leave the
  previous snapshot in place if the new download looks wrong (empty, far
  smaller than before, missing columns).
- Publish only what a tool needs. Anatel's file contains licensee names and
  masked CPF numbers: never commit the raw file, and never write those
  columns into `data/`, logs kept in the repository, or test fixtures.
- Every dataset records its source and fetch date, and the tool shows
  "dados de <fonte>, atualizados em <data>" in its status bar.
- The daily refresh must stay cheap: a plain script (no AI), a ranged
  download of only the file it needs, and a commit only when the reduced
  data actually changed.
- RepeaterBook's API and data are off limits for automated use (its policy
  forbids this kind of site). Do not scrape it or any other third-party
  repeater list.

## Building tools

Reuse the shared building blocks in `src/ui/` (search field, segmented
control, detail panel, copy button, empty and loading states, URL state) and
`src/lib/format.ts`, and the `tool-*` layout classes in `src/styles/tool.css`.
Follow `docs/ui-guidelines.md` for typography, controls, feedback and
keyboard behaviour. Tool-specific components live in `src/tools/<slug>/`,
one component per file.

## Reference docs

- `docs/ui-guidelines.md`: how tools should look and behave, with sources.

- `docs/data-sources.md`: where the data comes from, formats, pitfalls, and
  how to fetch it cheaply.
- `docs/callsign-rules.md`: the callsign rules and prefix tables.
- `docs/chirp-csv.md`: the CHIRP CSV format and the exporter's rules.

## Working rules

- Take the next unchecked task from `ROADMAP.md`, in order, unless the user
  says otherwise. Tick it off when it is done and verified. If a task turns
  out to be wrong or blocked, write that down in the roadmap instead of
  silently working around it.
- Stay inside the task. New ideas go under "Ideas / later" in the roadmap.
- Scripts in `scripts/` run directly with `node` (Node strips TypeScript
  types), so relative imports in `scripts/` and `src/lib/` must use explicit
  `.ts` extensions, and only erasable TypeScript syntax is allowed (no
  enums, parameter properties or `override`).
- Logic that can be pure goes in `src/lib/` with Vitest tests. Callsign rules,
  distance calculations and the CHIRP export must be tested.
- Before calling a task done: `npm run check`, `npm test` and `npm run build`
  pass, and UI changes have been looked at in a browser at phone and desktop
  widths. With `npm run preview` running,
  `node scripts/screenshot.ts http://localhost:4321 <out-dir> <path>...`
  saves desktop and phone screenshots (Playwright) and warns about
  horizontal overflow (`BROWSER=webkit` for Safari's engine: check both, the
  user browses with Safari), and `node scripts/a11y.ts http://localhost:4321
  <path>...` runs axe-core at both widths. For refactors that should not
  change the look, `node scripts/visual-snapshots.ts capture <url> <dir>`
  before and after, then `compare <dir-a> <dir-b>`. Put screenshots in a scratch
  directory, not the repo.
- Commit only when the user asks.
