# Brazilian amateur callsign rules

Transcribed on 2026-11-08 from **Ato Anatel nº 3448 of 11/03/2026**, section
12 (in force since 13/03/2026), which sits under Resolução Anatel nº 777/2025.
PDF:
<https://www.gov.br/anatel/pt-br/assuntos/noticias/anatel-simplifica-regras-e-fortalece-o-radioamadorismo-no-brasil/ato-3448-2026.pdf/@@download/file>

These tables are data, not code: keep them in one versioned file
(`src/lib/callsigns/rules-data.ts`) that records the Ato number and date, so a
future rule change is a data edit. Anatel may change designations at any time.

## Shape

- **Classes A and B** (identical for callsign purposes): state prefix + 2
  letters (`AA`–`ZZ`) or + 3 letters (`AAA`–`YZZ`).
- **Class C:** `PU` + region digit + 3 letters, where the first suffix letter
  is allotted per state. São Paulo also has `PV2`.
- No 1-letter or 4-letter suffixes for regular ("efetivo") callsigns.
- **Foreigners:** state prefix + 3-letter suffix starting with `Z`. This is
  why A/B 3-letter blocks stop at `YZZ` and class C ranges stop at `Y`.
- Repeaters and clubs have no reserved block; they hold ordinary A/B-format
  callsigns, so they count as taken like any other.

## Prefix table (Tabela II)

| UF | A/B prefix | Class C |
|---|---|---|
| AC | PT8 | PU8 JAA–LZZ |
| AL | PP7 | PU7 AAA–DZZ |
| AP | PQ8 | PU8 GAA–IZZ |
| AM | PP8 | PU8 AAA–CZZ |
| BA | PY6 | PU6 JAA–YZZ |
| CE | PT7 | PU7 MAA–PZZ |
| DF | PT2 | PU2 AAA–EZZ |
| ES | PP1 | PU1 AAA–IZZ |
| GO | PP2 | PU2 FAA–HZZ |
| MA | PR8 | PU8 MAA–OZZ |
| MT | PY9 | PU9 OAA–YZZ |
| MS | PT9 | PU9 AAA–NZZ |
| MG | PY4 | PU4 AAA–YZZ |
| PB | PR7 | PU7 EAA–HZZ |
| PR | PY5 | PU5 MAA–YZZ |
| PA | PY8 | PU8 WAA–YZZ |
| PE | PY7 | PU7 RAA–YZZ |
| PI | PS8 | PU8 PAA–SZZ |
| RJ | PY1 | PU1 JAA–YZZ |
| RN | PS7 | PU7 IAA–LZZ |
| RS | PY3 | PU3 AAA–YZZ |
| RO | PW8 | PU8 DAA–FZZ |
| RR | PV8 | PU8 TAA–VZZ |
| SC | PP5 | PU5 AAA–LZZ |
| SP | PY2 and PR2 | PU2 KAA–YZZ and PV2 KAA–YZZ |
| SE | PP6 | PU6 AAA–IZZ |
| TO | PQ2 | PU2 IAA–JZZ |

## Oceanic islands and Antarctica (Tabela III)

A/B use `PY0`, C uses `PU0`. The first suffix letter identifies the place:
`F` Fernando de Noronha, `S` São Pedro e São Paulo, `T` Trindade, `R` Atol das
Rocas, `M` Martim Vaz, `A` Antarctica. A/B get 2 or 3 letters (`PY0FA`–`FZ`,
`PY0FAA`–`FZZ`); C gets 3. `PY0` + 2 or 3 letters is also used for space
stations. Low priority for the tool.

## Forbidden suffixes (item 12.2)

`DDD`, `SNM`, `SOS`, `SVH`, `TTT`, `XXX`, `PAN`, `RRR`, and the series
`QAA`–`QZZ`, "no todo ou em parte". Two-letter suffixes starting with `Q` are
not excluded by the text. The tool shows forbidden suffixes as
"reservado", never as free.

## After cancellation or death (items 12.1.1, 12.1.2)

- **Cancellation:** the callsign becomes vacant one year after all licenses
  with it are removed from Anatel's database. The former holder may reclaim it
  within that year.
- **Death:** vacant the day Anatel processes the removal.

Anatel's open data lists only currently licensed stations, so **a callsign
missing from the file is not necessarily free**. See "Status model" in
`ROADMAP.md`.

## Special callsigns (out of scope for the first version)

Event-only callsigns: `ZV`–`ZZ` + digit for any class, and for class A the
P-series prefixes not used as regular prefixes in the region. Up to 10
characters, one at a time per station.

## How to request a callsign

Through the "MMAR – Licenciamento Radioamador" module in Anatel's Mosaico
system (gov.br login). Page to link from the tool:
<https://www.gov.br/anatel/pt-br/regulado/outorga/radioamador-e-radio-cidadao/licenciamento-de-estacoes-do-radioamador>

There is no public availability check any more: Anatel's old "Consulta de
Indicativo" was taken offline in March 2026.

## Known drafting glitches in the Ato

- The SP row reads "PR 2 AA e ZZ" (should be "a").
- Item 12.10.6-II gives Antarctic class C "duas ou três letras",
  contradicting Tabela III.
