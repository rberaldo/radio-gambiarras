# Data sources

Research done on 2026-11-08. "Verified" means the URL was fetched and the
content inspected that day. Re-check anything marked unverified before relying
on it.

## Anatel: licensed amateur stations (shared by callsigns and repeaters)

- **URL:** <https://www.anatel.gov.br/dadosabertos/paineis_de_dados/outorga_e_licenciamento/estacoes_licenciadas.zip>
- **Access (verified):** HTTP 200, no login, no captcha, behind Cloudflare.
  Works with a plain `curl`.
- **Size (verified):** 225,066,017 bytes zipped, 10.5 GB uncompressed, 10 CSV
  members. We only need one member: `Estacoes_Radioamador.csv` (11.9 MB,
  about 3.2 MB compressed).
- **Range requests work (verified):** the server answers `206` to a byte
  range. The pipeline must read the zip's central directory and fetch only
  the amateur member, never the whole archive.
- **Freshness:** `Last-Modified` was the same day and members were dated the
  same or previous day, so it appears to refresh daily (one observation).
- **Unverified:** the dataset's license (Anatel describes its open data as
  free to use with credit, but the license of this dataset was not readable),
  and whether a GitHub Actions runner on a non-Brazilian IP gets through
  Cloudflare. The research ran from a Brazilian IP.
- Guessed direct URLs for an amateur-only file return 404. Anatel's data
  panels were in maintenance on the research date; Anatel endpoints do go
  down.

### `Estacoes_Radioamador.csv`

UTF-8 with BOM, CRLF, `;` delimiter, decimal comma, dates as dd/mm/yyyy.
71,328 rows, 18 columns:

```
Tipo de Identificação; CNPJ ou CPF; Nome da Entidade;
Fistel do Serviço da Estação; Serviço; Indicativo; Número da Estação;
UF da Entidade; COER; Nome da Estação; Tipo de Estação;
Frequências de Operação da Estação; Município da Estação; UF da Estação;
Data do Primeiro Licenciamento; Data do Último Licenciamento;
Data de Validade da Estação; Status da Validade
```

- `Tipo de Estação`: Móvel 38,552, Fixa 31,279, Repetidora 1,241, N/I 250,
  Terrena 6.
- `Serviço` is "Radioamador" on every row.
- **Personal data:** the file carries licensee names and masked CPF. Never
  copy those columns into `data/` or anything published.

### Fetching it cheaply (verified)

The server sends `ETag` and `Last-Modified`, honours conditional requests
(304) and byte ranges (206, `If-Range` with the ETag works). The zip is
rebuilt every day, so the ETag changes daily even when the amateur rows do
not; a 304 will be rare. The cheap path is therefore:

1. Range-fetch the last 64 KB of the zip and parse the central directory.
   Find `Estacoes_Radioamador.csv` **by name** (its offset moves daily). Two
   other members are over 4 GB, so handle zip64 fields.
2. Range-fetch only that member (local header + about 3.2 MB of deflate
   data), inflate it, and check the CRC32 from the directory.
3. Reduce it (see below) and compare with the committed snapshot. Commit only
   when the reduced output differs.

Worst case is about 3.3 MB of download and a few seconds of work per day.
Fall back to downloading the whole zip if range requests ever stop working.
A community project (`github.com/SamuelMoraesF/anatel-indicativo`) fetches
this zip daily from GitHub-hosted runners and succeeded on every run from
2026-10-18 to 2026-11-08, so foreign datacentre IPs are not blocked today.

Cloudflare caches the file for up to 4 hours. Anatel rebuilds it around
11:00 UTC, so run the job after 12:00 UTC.

### Things that have already gone wrong upstream

- **Content freeze:** as of 2026-11-08 the newest
  `Data do Último Licenciamento` is 2026-10-23 and the rows have not changed
  since about 2026-10-27, although the file is regenerated daily. Cause
  unknown. The pipeline must record the newest licensing date and warn when
  it is old.
- **Renamed member:** it was `Estacoes_PY.csv` in April 2025. Fail loudly
  when the member or a column is missing.
- Anatel's old public "Consulta de Indicativo" was shut down after a security
  incident in March 2026. There is no other public source.

## Callsigns

From the same CSV, every row counts regardless of station type.

- 46,670 distinct `Indicativo` values, 46,659 well-formed. Rows are one per
  station, so a callsign repeats (up to 12 times).
- Dirty values: 9 rows `N/I`, a few with lowercase, hyphens, `Ç`/`Ü`, or 7
  characters. Normalize (trim, uppercase) and validate against
  `^[A-Z]{2}\d[A-Z]{2,3}$`; log rejects.
- **Derive the UF from the callsign** using the tables in
  `docs/callsign-rules.md`, never from the UF columns: `UF da Estação` is
  `N/A` for all mobile stations and `UF da Entidade` is the holder's address,
  which disagrees with the callsign in about 4% of cases. About 51 well-formed
  callsigns fall outside the tables (foreigners, legacy, typos).
- `COER` holds the class: Classe C 48,957 rows, A 12,404, B 9,123, `N/A` 842
  (entities such as clubs).
- `Status da Validade`: Ativa, N/I or Vencida. Per callsign, taking the best
  status across its stations: Ativa 35,371, N/I 10,994, Vencida 297. `N/I` is
  a license without a fixed expiry, not an irregular one. **All three mean
  the callsign is taken.**
- The file has no cancellation data. See the status model in `ROADMAP.md`.

How full the blocks are (in use / possible):

| UF | A/B 2-letter | Class C |
|---|---|---|
| SP | 910 / 1,352 | 9,016 / ~18,928 |
| RJ | 577 / 676 | 3,596 / ~10,140 |
| MG | 565 / 676 | 2,533 / ~16,224 |
| RS | 525 / 676 | 2,506 / ~16,224 |
| PR | 519 / 676 | 2,472 / ~8,112 |
| CE | 277 / 676 | 1,725 / ~2,704 |

The A/B 3-letter space is nearly empty everywhere.

## Repeaters

### What Anatel gives us

Filter `Tipo de Estação == "Repetidora"` (1,241 rows; 1,166 have at least one
2 m or 70 cm pair, 1,139 distinct callsigns).

- Present: callsign, município, UF, license dates, `Status da Validade`
  (Ativa 695, N/I 544, Vencida 2).
- Frequencies are one text field, e.g. `146,610 / 146,010 MHz`. The first
  value is the repeater's output, the second its input (confirmed by 495
  exact callsign + output matches against RepeaterBook's public listing).
- **Absent: coordinates, CTCSS/DCS tone, mode (FM/DMR), on-air status.**
  Anatel's sources that do carry coordinates (Mosaico) contain no amateur
  stations.

Dirty data the parser must tolerate, with a reject log:

- 8 rows with frequency `N/I`.
- About 19 rows with several pairs separated by ` ; `, some with stray quotes.
- Typos such as `145,370 / 14.477,000 MHz`.
- A few cross-band or zero-shift entries.
- One UF written as `Pr`.
- 17 callsigns with more than one row (PY2RCA has 9).

### Location

Anatel gives only município and UF. Join on name to
<https://github.com/kelvins/municipios-brasileiros> (MIT, 5,570 municípios
with IBGE code and coordinates) and place the repeater at the município seat.
Every such point is approximate: repeaters sit on hilltops that can be tens of
kilometres away. The UI must say so.

### Implementation notes (2026-11-09)

- `scripts/anatel/repeaters.ts` writes `data/repeaters/anatel.json` (1,213
  repeaters: 832 on 2 m, 381 on 70 cm), `meta.json` and `changes.json`.
- Coordinates come from `data/geo/municipios.json`, a reduced copy of
  `kelvins/municipios-brasileiros` (MIT, commit 503e2f7, license in
  `data/geo/municipios-LICENSE.txt`). Spelling differences go in `ALIASES`
  in `scripts/anatel/municipios.ts`; the job lists any unlocated município.

### RepeaterBook: not usable

- The export API returns `401 auth_missing` without an approved token
  (verified).
- Its API policy (rewritten 2026) lists public repeater maps, nearby-repeater
  finders, route search, cached re-serving and export/download services as
  uses that are generally not authorized without written permission. That is
  exactly this tool.
- Do not scrape or ingest it. Linking to its pages is fine. A token can be
  requested at <https://www.repeaterbook.com/api/token_request.php>; expect a
  refusal.
- For scale: its public listing shows 760 Brazilian entries (570 on 2 m, 166
  on 70 cm), with numeric tones on only about 35–41% of FM entries.

### Other sources

None of these is machine-readable and openly licensed. They are context, not
inputs: do not import from them.

| Source | Notes |
|---|---|
| Antena Ativa (PY2CER), <https://antenaativa.com.br/lista-de-repetidoras-analogicas-brasileiras/> | 663 analog repeaters, updated October 2026, with offset and subtone. Terms forbid copying without authorization. Best lead for tones. |
| UNOPR, <https://unopr.com.br/repetidoras-vhf-brasil-2026-base-completa-com-filtros/> | Appears to be the same crowdsourced base. No license stated. |
| CRAM PDF, <https://www.cram.org.br/download/repetidoras.pdf> | 632 rows, created 2010. Stale. |
| hearham.com API | Open, but only 5 Brazilian entries. |
| RadioID, <https://radioid.net/static/rptrs.json> | 306 Brazilian DMR repeaters, no coordinates. Terms not checked. |
| BrandMeister API | Coordinates and last-seen for BrandMeister DMR repeaters. Terms not checked. |

### Strategy (decided with the user)

1. Anatel is the backbone: callsign, output frequency, shift, município, UF,
   license validity.
2. Location is the município seat, labelled approximate.
3. Tones, exact coordinates, mode and on-air status come from an overlay file
   kept in this repository, keyed by callsign + output frequency. The user
   fills it in by hand over time. Visitors can suggest entries, but nothing
   reaches the overlay without the user's approval. Every overlay entry
   records where its information came from.
4. No bulk import from any third-party list. No permission request to PY2CER.
5. Known risks: licensed does not mean on the air (544 rows have validity
   `N/I`); coverage differs from community lists in both directions.

## APRS symbols (static)

- `data/aprs/symbols.json`: 159 symbols (86 primary `/`, 73 alternate `\`),
  imported once on 2026-11-09 from <https://github.com/rberaldo/aprs-symbol-search>.
  Descriptions are the user's own Portuguese translations
  (`symbols/symbols-pt-br.js`); codes and the "unused" flags come from that
  repo's English `symbols/symbols.json`, because the Portuguese file has two
  bugs: one entry says `used` instead of `unused`, and six alternate codes
  (`\b \f \n \r \t \v`) were turned into control characters by JavaScript
  string escapes. Placeholders and unused symbols are left out.
- `public/aprs/aprs-symbols-64-{0,1}[@2x].png`: Heikki Hannikainen's
  <https://github.com/hessu/aprs-symbols>, copied unchanged (commit f2286a9,
  2024-10-10); see `public/aprs/CREDITS.txt`. Per-symbol sources and licenses
  are in that repo's COPYRIGHT.md; credit and link to the repo wherever the
  images are shown.
- No pipeline: this data does not change upstream in any way we track.

## Map services (repeater map, checked 2026-11-09)

All keyless, free, CORS-enabled (`Access-Control-Allow-Origin: *` tested),
donation-funded, no SLA. Attribution must stay visible.

| Service | Use | URL | Attribution |
|---|---|---|---|
| OpenFreeMap | Vector base map (OpenMapTiles schema, max zoom 14; peaks in `mountain_peak` with `ele`) | Styles `https://tiles.openfreemap.org/styles/liberty`; TileJSON `https://tiles.openfreemap.org/planet` (tile paths rotate: always go through the TileJSON) | "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" |
| Mapterhorn | Elevation (Terrarium, 512 px WebP, max zoom 12 over Brazil, Copernicus GLO-30) | `https://tiles.mapterhorn.com/{z}/{x}/{y}.webp` | "© Mapterhorn"; "Copernicus GLO-30 © DLR/Airbus, provided under COPERNICUS by EU and ESA" |
| AWS Terrain Tiles | Elevation fallback (same Terrarium encoding) | `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` | "SRTM / GMTED2010 courtesy of the U.S. Geological Survey; ETOPO1 NOAA; Mapzen" |
| OpenTopoMap | Raster topo fallback layer (CC-BY-SA, light use only) | `https://{a,b,c}.tile.opentopomap.org/{z}/{x}/{y}.png` | "Kartendaten: © OpenStreetMap-Mitwirkende, SRTM, Kartendarstellung: © OpenTopoMap (CC-BY-SA)" |

Libraries: MapLibre GL JS 6.x (BSD-3, ~295 KB gzipped), maplibre-contour
0.1.x (BSD-3; MapLibre 6 support unverified, smoke-test).

Netlify Forms (legacy free plan): 100 verified submissions per site per
month; Akismet always on; honeypot via `netlify-honeypot`; JS-rendered forms
need a hidden static HTML form with the same fields; POST url-encoded with
`form-name`. API: `GET https://api.netlify.com/api/v1/sites/{site_id}/submissions`
with a personal access token. Exceeding a metered limit on the legacy free
plan can pause every site on the account, hence the separate team (M3.0).
