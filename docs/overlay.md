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

Suggestions arrive as GitHub issues (form `correcao-repetidora`); adding the
label `aprovada` applies them automatically (roadmap M3.8, documented here
when built).
