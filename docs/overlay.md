# Repeater overlay

`data/repeaters/overlay.json` holds the corrections the maintainer approved:
CTCSS tone or DCS code, exact position, modes, on-air status, notes, and
repeaters Anatel does not list. The daily job never touches it. The map
merges it with Anatel's data (`src/lib/repeaters/merge.ts`).

## Format

```json
{
  "format": 1,
  "entries": {
    "PY2KJP@146.610": {
      "tone": 88.5,
      "lat": -23.6512,
      "lon": -46.8025,
      "modes": ["FM"],
      "onAir": true,
      "notes": "Pico do Jaraguá",
      "source": "PU1JAZ, teste no ar",
      "date": "2026-11-09"
    }
  }
}
```

- The key is the callsign, `@`, and the output frequency with three
  decimals, exactly as the map shows it.
- `source` and `date` are required: who or what confirmed it, and when.
- `tone` is a standard CTCSS tone in Hz, or `"none"` when the repeater needs
  no tone; leave it out when unknown. Use `dcs` ("023") instead of `tone` for
  DCS repeaters.
- `lat`/`lon` are the repeater's site (decimal degrees, negative south and
  west), not the town.
- `modes`: any of FM, DMR, D-STAR, Fusion, NXDN, P25, M17.
- `onAir`: `true` when confirmed working, `false` when confirmed off the air.
- A repeater Anatel does not list also needs `input`, `municipio`, `uf`,
  `lat` and `lon`.

`npm test` validates the file (`validateOverlay` in
`src/lib/repeaters/overlay.ts`) and explains every problem in Portuguese.
Run it before committing a change.

## Corrections through GitHub issues

People suggest corrections with the issue form "Correção de repetidora"
(`.github/ISSUE_TEMPLATE/correcao-repetidora.yml`). The map's "Sugerir
correção" button opens it prefilled with the repeater id and what the site
shows; "avise sobre uma repetidora nova" opens it with the chosen point.

1. Read the issue. Check it makes sense (tone from someone who tested it,
   a position on a hill rather than in town, a club's announcement...). Edit
   the issue to fix small mistakes, or ask in a comment.
2. Add the label `aprovada`. `.github/workflows/correcoes.yml` parses the
   form (`scripts/repeaters/issue.ts`), merges it into `overlay.json` (blank
   answers keep earlier values; a tone replaces a DCS code and vice versa),
   validates the whole file, commits to main (which deploys the site),
   comments with the applied entry and closes the issue.
3. If the issue cannot be applied, the job comments why and removes the
   label; fix the issue and add the label again.

The source shown on the site is the callsign the person gave (or their
GitHub login), what they said about how they know, and the issue number.

The form is generated: edit the fields in `src/lib/repeaters/correction.ts`
and run `node scripts/repeaters/issue-form.ts`; a test fails if the committed
form is stale. The labels `correcao` (added by the form) and `aprovada` must
exist in the repository.

Apply an issue locally (for testing) with
`ISSUE_BODY="$(cat body.md)" ISSUE_NUMBER=1 ISSUE_AUTHOR=login node scripts/repeaters/apply-issue.ts`.
