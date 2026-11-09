# Roadmap

Work plan for the site. Read `CLAUDE.md` first for the fixed decisions and
conventions, then the docs a milestone points to.

## How to use this file

- Milestones run in order: M0, M1, M2, M3, M4. Inside a milestone, tasks run
  in order unless a task says it can be done in parallel.
- One task is sized for one working session. Do the task, verify it against
  its "Done when", tick its box, and stop or move to the next.
- If a task is wrong, blocked or needs a decision from the user, write a note
  under the task and raise it. Do not guess on anything listed under
  "Open questions".
- New ideas go under "Ideas / later", not into the current task.
- Tasks marked **(user)** need the user to act or approve. Creating the
  GitHub repository, connecting Netlify and anything else that publishes
  something needs the user's go-ahead first.

## Open questions for the user

1. **Site name and domain.** Undecided. Use the placeholder in `src/site.ts`.
2. ~~GitHub repository.~~ Settled: public repo
   <https://github.com/rberaldo/radio-gambiarras>, default branch `main`.
   Is "Rádio Gambiarras" also the site name? Not confirmed.
3. **Seeding the quarantine history** (task M2.5): start empty, or seed from a
   third-party April 2025 snapshot of callsigns in use?
4. **Anatel dataset license.** Anatel describes its open data as free to
   reuse with credit, but the license for this dataset could not be read
   during research. Confirm it in a browser before launch.
5. **Filling the overlay from RepeaterBook by hand.** RepeaterBook's policy
   says using its data to build another repeater directory needs its written
   permission. The user plans to add entries manually over time; the overlay
   records a source per entry so this stays the user's call entry by entry.
6. **APRS tool source code.** Where it lives, for M4.

---

## M0 — Foundations

Goal: an empty but working Astro site with the tooling every later task
relies on.

- [x] **M0.1 Scaffold.** Done 2026-11-09: Astro 7.4, Preact, TypeScript
  strict, Vitest 5, Node 26 (Homebrew). On this Mac Node lives in
  `/opt/homebrew/bin`; agents' shells may need it added to `PATH`. `git init`; Astro with strict TypeScript and the
  Preact integration; Vitest; `.gitignore`; Node version pinned (`.nvmrc`
  and `engines`); npm scripts `dev`, `build`, `preview`, `check`
  (`astro check`), `test`.
  Done when: all five scripts run cleanly on a fresh clone.
- [x] **M0.2 Site config and tool registry.** Done 2026-11-09; the name is
  the placeholder "Nome do Site" in `src/site.ts`. `src/site.ts` (name
  placeholder, meta pages) and `src/tools.ts` with three entries:
  `indicativos`, `repetidoras`, `aprs`, all with status `soon` for now.
  Types for the registry, and a unit test that slugs are unique.
  Done when: a page can import the registry and list the tools.
- [ ] **M0.3 Repository and hosting (user).** The GitHub repository exists
  (`rberaldo/radio-gambiarras`, public; local `origin` already points to it).
  Remaining: the Netlify site connected to it, and `netlify.toml` (build
  command, publish directory, Node version). Ask before the first push.
  Done when: a push to the main branch produces a live Netlify deploy.

## M1 — Win95 shell and landing page

Goal: the look and the navigation, with no tools yet. See "Design language"
in `CLAUDE.md`.

- [x] **M1.1 Tokens and base styles.** CSS custom properties for the palette
  (desktop teal, window gray, title-bar navy, bevel light and shadow), bevel
  recipes (raised, sunken, window frame), type scale and spacing. Base
  element styles. System font stack; no web fonts.
  Done when: a demo page shows raised and sunken surfaces at correct
  contrast, and nothing uses a literal color outside the token file.
- [x] **M1.2 Core components.** `Window` (title bar with icon and title,
  menu bar, body, status bar), `MenuBar` (drop-down menus built from the
  registry and the meta pages; keyboard operable; works without JavaScript
  as plain links), `Button`, `Field`, `Select`, `Checkbox`, `StatusBar`.
  Build only these; add others when a tool needs them.
  Done when: each component is shown on an internal `/_componentes` page and
  is usable by keyboard alone.
  Note (2026-11-09): Astro ignores `_`-prefixed pages, so the showcase is
  `/componentes` (noindex, unlinked). Form controls are CSS classes in
  `src/styles/controls.css` (`btn`, `field`, `check`, `fieldset`) rather
  than components, so Preact islands can use the same markup.
- [x] **M1.3 Desktop layout.** Page frame with the desktop background and a
  taskbar: a start button that opens a menu of tools (from the registry),
  the current window's title, and a clock. On narrow screens the window is
  maximized and the taskbar stays reachable.
  Done when: the layout holds from 320 px to wide desktop without
  horizontal scrolling.
- [x] **M1.4 Icons.** Original pixel-art icons for the three tools and the
  site, drawn for this project (do not copy Microsoft's icons). One size
  that scales crisply (`image-rendering: pixelated`).
- [x] **M1.5 Landing page.** The desktop: one icon per registry entry with
  its title; `soon` entries are grayed out, not clickable, and labelled
  "em breve". A short welcome window explains what the site is.
  Done when: adding a fourth entry to the registry makes it appear on the
  desktop, in the start menu and in the menu bar with no other change.
- [x] **M1.6 Meta pages.** `/sobre` (what the site is, data sources and
  credits, how to report a problem) and a 404 page styled as a Win95 error
  dialog.
- [x] **M1.7 Review pass.** Keyboard walk-through, focus visibility,
  contrast check, `prefers-reduced-motion`, phone and desktop screenshots,
  Lighthouse accessibility and performance.
  Done when: no accessibility errors remain and the landing page ships no
  JavaScript beyond the start menu and clock.
  Done 2026-11-09: axe-core (`scripts/a11y.ts`) reports 0 violations on every
  page at 1280 and 375 px; menus work by keyboard and close on Escape; no
  horizontal overflow at 320 px; landing page ships two small inline scripts.
  Lighthouse was not run (no Chrome on this Mac). Icons are 16×16 pixel grids
  in `src/lib/icons.ts`; the "PY" card is a first draft worth redrawing.

## M2 — Callsigns (`/indicativos`)

Goal: help someone choose a callsign by showing, for their class and state,
which callsigns are in use and which are probably free.

Read `docs/callsign-rules.md` and the Anatel and Callsigns sections of
`docs/data-sources.md` first.

### Status model

Anatel's file lists only currently licensed stations, so the tool can never
promise a callsign is free. It shows five states:

| State | Meaning | Source |
|---|---|---|
| em uso | Listed by Anatel with status Ativa or N/I | Anatel file |
| licença vencida | Listed, but every station's license is expired. Still taken. | Anatel file |
| em quarentena (provável) | Was listed in an earlier snapshot of ours and disappeared less than a year ago | Our own history |
| reservado | Forbidden suffix, or the `Z` block for foreigners | Rules |
| livre (provável) | Everything else in the allowed range | Rules minus the above |

The tool always says that Anatel has the final word, shows the date of the
data, and links to Anatel's licensing page.

### Daily refresh: the cheapest job that works

This matters to the user. The design:

- **One plain script on a GitHub Actions cron, once a day after 12:00 UTC.**
  No AI, no server. The same fetch feeds callsigns now and repeaters in M3.
- **Download only what is needed:** about 64 KB for the zip directory plus
  about 3.2 MB for the amateur member, using HTTP range requests, instead of
  the 225 MB archive. Details in `docs/data-sources.md`.
- **Commit only when the reduced data changed.** No commit means no deploy,
  so a no-change day costs a few seconds of free runner time and nothing
  else.
- **The site build never touches the network.** It reads the committed
  snapshot.
- **Fail safe:** on any error or suspicious result, the job fails (GitHub
  emails the owner) and the previous snapshot stays live.

### Tasks

Rules library:

- [x] **M2.1 Rules data and library.** Done 2026-11-09 (`src/lib/callsigns/`,
  142 tests). Checked against the real Anatel file of 2026-11-08: 46,661
  distinct well-formed callsigns; 46,483 regular, 154 foreigner, 1 forbidden
  suffix in use anyway, 23 outside every block (legacy `PV2` outside K–Y,
  2-letter class C like `PU5PC`, special `ZZ`, old `PY0E…`/`PY0U…`).
  Consequences: the pipeline keeps every well-formed callsign, even outside
  the blocks; and in M2.8 Anatel's "em uso" must win over the rules'
  "reservado". `src/lib/callsigns/`: the Ato 3448
  tables as data; `parse` and `normalize`; `ufOf(callsign)`;
  `blocksFor(uf, class)`; enumeration of a block's suffixes; classification
  of a suffix as regular, forbidden or foreigner. Classes A and B share
  blocks. Include the islands (`PY0`/`PU0`) in the data even if the UI
  leaves them for later.
  Done when: tests cover every row of the prefix table, the SP double
  prefixes, the class C letter ranges at their boundaries, the forbidden
  list and the `Q` series, and block sizes (an A/B prefix has 676 two-letter
  and 16,900 three-letter suffixes before exclusions).

Pipeline:

- [x] **M2.2 Anatel fetch.** Done 2026-11-09. Live run: 3,273,940 bytes
  downloaded in 0.5 s, CRC verified, 71,328 rows. `scripts/anatel/fetch.ts`: range-fetch the zip's
  central directory, locate `Estacoes_Radioamador.csv` by name, range-fetch
  and inflate that member, verify its CRC32. Handle zip64 fields. Fall back
  to a full download if ranges are refused. Fail with a clear message if the
  member is missing.
  Done when: unit tests pass against a small synthetic zip, and a manual run
  against the live URL prints the member's size and row count.
- [x] **M2.3 Callsign reduction.** Done 2026-11-09. Live data: 46,661
  callsigns (46,364 active, 297 expired), 15 rejects; `taken.json` 181 KB,
  85 KB gzipped; second run writes nothing; no personal values in `data/`.
  Design note: `meta.json` has no fetch timestamp (it would change daily and
  force a deploy); it records `updatedAt` (when the callsigns last changed)
  and `newestLicensing` (freshness of Anatel's file). `scripts/anatel/callsigns.ts`: parse the
  CSV (BOM, `;`, CRLF), check the header matches the expected 18 columns,
  normalize and validate callsigns, collapse to one record per callsign with
  its best status, and write `data/callsigns/taken.json` plus a `meta.json`
  (fetch date, newest `Data do Último Licenciamento`, counts, source). Sort
  the output so identical data gives identical bytes. Write a reject log to
  the job output, not to the repository.
  **Never write names, CPF/CNPJ, Fistel numbers or cities.** Test fixtures
  are synthetic.
  Guards: fail if the row count drops by more than 20% from the previous
  snapshot, or if the header changed.
  Output target: one file, all states, under roughly 150 KB gzipped (about
  46,700 callsigns; group suffixes by prefix rather than repeating full
  callsigns).
  Done when: running it twice on the same input produces no diff, and a grep
  of `data/` finds no personal fields.
- [ ] **M2.4 Disappearance history.** When a callsign present in the previous
  snapshot is missing from the new one, record it with today's date in
  `data/callsigns/released.json`. Remove an entry when the callsign
  reappears or after one year.
  Done when: tests cover disappear, reappear and expiry.
- [ ] **M2.5 History seed (user decision, optional).** See open question 3.
  If approved, mark callsigns that were in use in April 2025 and are absent
  now as possibly in quarantine, with the uncertainty stated in the UI.
- [ ] **M2.6 Scheduled workflow.** `.github/workflows/dados.yml`: daily cron
  and manual trigger; run fetch, reduction and history; commit and push only
  if `data/` changed. Emit a warning annotation when the newest licensing
  date is more than 14 days old (the upstream feed froze in late October
  2026). Note: GitHub disables scheduled workflows in a repository with no
  activity for 60 days; if the upstream stays frozen that long, the workflow
  needs re-enabling.
  Done when: a manual run on GitHub completes in under a minute and a run
  with unchanged data makes no commit.
- [ ] **M2.7 Hosting cost check (user).** The Netlify account is on the Free
  plan (checked 2026-11-08). Confirm in Netlify's billing page what a deploy
  costs on this account and how many a month are included. Normal upstream
  activity is 10–50 changed rows on most days, so expect up to one deploy a
  day. If that exceeds the free allowance, pick one: build in GitHub Actions
  and upload the finished site with the Netlify CLI; or serve `data/` from
  GitHub Pages so data updates need no Netlify deploy; or batch data commits
  weekly.

Interface (M2.8 can start as soon as M2.1 and M2.3 are done):

- [ ] **M2.8 Data loading and status.** Load `taken.json` and
  `released.json` once, lazily, and expose `statusOf(callsign)` implementing
  the status model. Loading and error states in Win95 style.
- [ ] **M2.9 Filters and grid.** Filters for class (A/B or C), state, and
  suffix length (2 or 3 letters, A/B only), plus "mostrar só livres". A
  virtualized grid of the selected block in alphabetical order with a
  letter index to jump around. In-use callsigns are grayed out; each state
  has its own look and a legend. The status bar shows counts (livres, em
  uso) for the current block.
  Done when: switching to the largest block (an A/B 3-letter block, 16,900
  cells) stays smooth on a phone, and states are distinguishable without
  relying on color alone.
- [ ] **M2.10 Search.** One search box that works across every block the
  filters allow (all states when no state is chosen):
  - full or partial callsign (`PY2RB`), or a suffix alone (`RBR`);
  - wildcards: `?` for one letter, `*` for any run (`PY2?AB`, `*RB`);
  - fuzzy fallback: when the exact match is taken or there are few results,
    offer near misses (one letter changed, two letters swapped, same letters
    in another order), free ones first.
  Query parsing and ranking live in `src/lib/callsigns/` with tests.
  Done when: a search across all states returns in well under 100 ms.
- [ ] **M2.11 Words and initials.** "Palavras": suffixes that spell short
  Portuguese words or names, from a curated list in the repository (review
  it for anything offensive). "Iniciais": the user types a name and gets
  suffixes built from its initials. Both respect the filters and the status
  model.
- [ ] **M2.12 Detail panel.** Selecting a callsign shows: its state with a
  plain explanation; the phonetic spelling (ICAO alphabet as used in
  Portuguese, digits in Portuguese); Morse code as dots and dashes, a play
  button (Web Audio, adjustable speed) and the length in dot units so short,
  rhythmic callsigns stand out; a copy button; and "Como solicitar" with the
  link to Anatel's licensing page.
- [ ] **M2.13 URL state and copy.** Filters, query and selected callsign live
  in the query string. Add the disclaimers, the "dados da Anatel,
  atualizados em …" status-bar text, and a visible notice when the data is
  stale (see M2.6).
- [ ] **M2.14 Occupancy summary.** A small table per state: how many 2-letter,
  3-letter and class C callsigns are in use out of how many possible.
  Useful for seeing where 2-letter suffixes are scarce.
- [ ] **M2.15 Release.** Set the registry entry to `available`. Full review:
  keyboard, screen sizes, slow network, data file missing.
  Done when: the user has tried it and signed off.

## M3 — Repeater map (`/repetidoras`)

Goal: a map of 2 m and 70 cm repeaters; pick the ones along a GPX track or
within a radius of a point; export them for CHIRP.

Read the Repeaters section of `docs/data-sources.md` and `docs/chirp-csv.md`
first. Two facts shape everything:

- Anatel has **no coordinates**: a repeater can only be placed at its
  município's seat unless the overlay has its real position.
- Anatel has **no tones**: the export has no tone unless the overlay has it.

So the tool must be honest about approximate positions and unknown tones,
and the overlay is what makes it better over time.

Data:

- [ ] **M3.1 Repeater reduction.** `scripts/anatel/repeaters.ts`, reading the
  same fetched CSV as M2: keep `Tipo de Estação = Repetidora`; parse the
  frequency field tolerantly (several pairs, stray quotes, decimal commas,
  `N/I`, typos) into output frequency and shift; keep 2 m and 70 cm pairs;
  one record per callsign + output frequency. Write
  `data/repeaters/anatel.json` with callsign, output, shift, município, UF
  and license validity. No names. Reject log to the job output.
  Done when: tests cover each kind of dirty value listed in the docs.
- [ ] **M3.2 Município coordinates.** Vendor the MIT-licensed município table
  (keep its license notice) and join on normalized name + UF (case, accents,
  apostrophes, the odd `Pr`). List unmatched names in the job output and fix
  them with a small alias table.
  Done when: every repeater has coordinates or appears in a short, explained
  unmatched list.
- [ ] **M3.3 Overlay.** `data/repeaters/overlay.json`, keyed by callsign +
  output frequency. Optional fields: tone (CTCSS), DCS code, exact latitude
  and longitude, mode (FM, DMR, D-STAR, Fusion), on-air status, notes; and
  required for every entry: source and date. The overlay can also add a
  repeater Anatel does not list. A schema check runs in tests. A merge
  function in `src/lib/repeaters/` produces the final records and marks each
  as "localização exata" or "localização aproximada".
- [ ] **M3.4 Contributions.** A "Sugerir correção" link on each repeater that
  opens a pre-filled GitHub issue form (callsign, frequency, tone, position,
  how the person knows). Nothing is published automatically: the user
  reviews each suggestion and edits the overlay. Document the steps for the
  user in `docs/overlay.md`.
- [ ] **M3.5 Wire into the daily job.** Extend the M2.6 workflow to produce
  the repeater data from the same fetch.

Library (pure, tested; can be done in parallel with the data tasks):

- [ ] **M3.6 Geometry.** Great-circle distance, and distance from a point to
  a polyline (for the GPX corridor).
- [ ] **M3.7 GPX parsing.** Tracks, routes and waypoints from a GPX file, in
  the browser. The file is never uploaded anywhere. Reject files that are
  not GPX with a clear message.
- [ ] **M3.8 CHIRP writer.** Implements `docs/chirp-csv.md` exactly,
  including the filler values for missing tones and dot decimals.
  Done when: tests cover simplex, plus and minus shifts, tone, no tone and
  unknown tone.

Interface:

- [ ] **M3.9 Map.** Leaflet with OpenStreetMap tiles and attribution, inside
  a window. Markers clustered at low zoom, with different markers for exact
  and approximate positions. A popup or side panel per repeater: callsign,
  output, shift, tone or "subtom desconhecido", city, license validity, and
  the correction link. Filters: band, mode, state, "só com subtom
  conhecido". A text list of the same repeaters for keyboard and
  screen-reader users.
- [ ] **M3.10 Point and radius.** Click or tap the map (or use the device's
  location, with permission) and set a radius in kilometres; draw the
  circle; select the repeaters inside. Repeaters with approximate positions
  are included when their município seat is inside the radius plus a margin,
  and are flagged.
- [ ] **M3.11 GPX corridor.** Load a GPX file, draw the track, choose a
  distance from the track, select the repeaters within it, ordered along the
  route.
- [ ] **M3.12 Selection list.** The selected repeaters in a table with a
  checkbox each, "marcar todas" and "desmarcar todas", sortable by distance,
  frequency or route order. Checking and unchecking updates the map.
- [ ] **M3.13 Export.** "Baixar CSV para o CHIRP" for the checked FM
  repeaters, with a choice of starting channel number. Digital-only
  repeaters are shown on the map but left out of the export, with a note.
  Disabled when nothing is checked.
  Done when: a downloaded file has been imported into the real CHIRP
  application without errors (user, or an agent with CHIRP installed).
- [ ] **M3.14 Release.** URL state for filters and the chosen point and
  radius; credits ("Fonte: Anatel", OpenStreetMap); the approximate-position
  explanation; registry entry to `available`; full review.

## M4 — APRS icons (`/aprs`)

Until this milestone the tool stays a grayed-out "em breve" entry.

- [ ] **M4.1 Get the code (user).** Location of the existing tool's source.
- [ ] **M4.2 Review and plan.** Read it; list what it does, its data and
  assets, their licenses, and what must change to fit this site.
- [ ] **M4.3 Port.** Bring it into `src/pages/aprs/` and `src/tools/aprs/`
  with the `Window` layout and Win95 components, keeping its behaviour.
- [ ] **M4.4 Release.** Registry entry to `available`; review.

## Ideas / later

Not planned. Move one into a milestone only when the user asks.

- Callsigns: a shortlist of favorites with a shareable link; special event
  callsigns (`ZV`–`ZZ`); islands in the UI; an alternative phonetic
  alphabet; spoken phonetics.
- Repeaters: DMR details from RadioID or BrandMeister (check their terms
  first); other bands; other export formats; a "repeaters near me" view.
- Site: a search box on the landing page once there are many tools; offline
  use; a changelog page.
- New tools: to be suggested by the user.

## Decision log

| Date | Decision |
|---|---|
| 2026-11-08 | PT-BR only; Win95 look; fully static Astro site on Netlify. |
| 2026-11-08 | Menu bar is site navigation only (other tools and meta pages). |
| 2026-11-08 | Callsign tool: pattern and word search, phonetics and CW; class and state are search filters, not a wizard; no shortlist for now. |
| 2026-11-08 | Repeaters: all 2 m and 70 cm, mode flagged, CHIRP export for FM only. |
| 2026-11-08 | Build order: callsigns, then repeaters, then the existing APRS tool, which stays a placeholder until then. |
| 2026-11-08 | Anatel open data is the source for both tools. RepeaterBook's API is not used. |
| 2026-11-08 | Repeater tones and exact positions come from an overlay the user maintains by hand; visitor suggestions need the user's approval; no request to PY2CER. |
| 2026-11-08 | Daily data refresh is a plain scheduled script that fetches about 3.3 MB and commits only on change. |
| 2026-11-09 | Repository: public `rberaldo/radio-gambiarras` on GitHub. |
