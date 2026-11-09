# CHIRP generic CSV

Checked against CHIRP source on 2026-11-08
(`chirp/chirp_common.py` and `chirp/drivers/generic_csv.py` in
<https://github.com/kk7ds/chirp>). The import rules below were read from the
code; they have not been tested by importing a file into CHIRP itself. Do that
before shipping the export.

## Header (21 columns, this order)

```
Location,Name,Frequency,Duplex,Offset,Tone,rToneFreq,cToneFreq,DtcsCode,DtcsPolarity,RxDtcsCode,CrossMode,Mode,TStep,Skip,Power,Comment,URCALL,RPT1CALL,RPT2CALL,DVCODE
```

| Column | Meaning and allowed values |
|---|---|
| Location | Integer channel number. Required. |
| Name | Free text. The radio truncates it. We write the city tag and the callsign without its two-letter prefix, `RIO 1BEU` for PY1BEU (`src/lib/repeaters/cityCode.ts`, user's choice, 2026-11-09): at most 8 characters. |
| Frequency | Receive frequency in MHz, dot decimal, up to 6 decimals (`146.610000`). |
| Duplex | Empty (simplex), `+`, `-`, `split` (Offset is then the absolute TX frequency) or `off`. |
| Offset | Shift magnitude in MHz (`0.600000`, `5.000000`). The sign is in Duplex. |
| Tone | Empty (none), `Tone` (TX CTCSS only), `TSQL`, `DTCS`, `DTCS-R`, `TSQL-R`, `Cross`. |
| rToneFreq | TX CTCSS used in `Tone` mode. Default `88.5`. |
| cToneFreq | CTCSS used in `TSQL` mode. Default `88.5`. |
| DtcsCode | Written as `023`. |
| DtcsPolarity | `NN`, `NR`, `RN`, `RR`. |
| RxDtcsCode | Written as `023`. |
| CrossMode | `Tone->Tone`, `DTCS->`, `->DTCS`, `Tone->DTCS`, `DTCS->Tone`, `->Tone`, `DTCS->DTCS`, `Tone->`. |
| Mode | `FM`, `NFM`, `WFM`, `AM`, `DV`, `DMR`, `DN` and others. We export `FM`. |
| TStep | kHz, e.g. `5.00`. |
| Skip | Empty, `S` or `P`. |
| Power | e.g. `5.0W`, `50W`. |
| Comment | Free text. |
| URCALL, RPT1CALL, RPT2CALL, DVCODE | D-STAR only. Leave empty. |

## Rules for the exporter

- Comma delimiter, `"` quoting, UTF-8. **Dot decimals always.** Anatel's
  source uses decimal commas, so convert.
- Every row must have as many cells as the header.
- Do not leave `rToneFreq`, `cToneFreq`, `TStep`, `Power`, `CrossMode` or the
  DTCS columns blank: a blank cell makes CHIRP reject the row.
- **Repeater with no or unknown tone:** `Tone` empty, and the filler values
  CHIRP itself writes: `88.5,88.5,023,NN,023,Tone->Tone`. Put
  "subtom desconhecido" in `Comment` when the tone is unknown.
- Number `Location` sequentially from 1. CHIRP lets people paste the rows into any memory slots.
- A header-only file fails to import, so disable the download when nothing is
  selected.
