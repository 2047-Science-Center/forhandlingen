# station-kit/stationsintro — bryggor + rollkort

Gemensam mall mellan hype-klippet och rollklippen. **Identisk i alla X&Y-stationer.** Källan finns i
`xy-produktion/stationsintro/station-kit/stationsintro/` och kopieras byte-identiskt till varje station.

```
StationIntro (hype, public/media/stationsintro/<station>.mp4)
  → <BryggKort steg="brygga1">  → <BryggKort steg="kortA" :rollnamn="A">  → rollklipp A
  → <BryggKort steg="brygga2">  → <BryggKort steg="kortB" :rollnamn="B">  → rollklipp B
  → STOPP → rollvalet
```

- Props: `steg` (`brygga1|kortA|brygga2|kortB`), `rollnamn`, `sprak` (`sv|no`), `valvfarg`, valfri `ms`.
- Emit `done` efter fast tid (brygga 1,8 s, kort 1,6 s). Ett tryck hoppar över, som `StationIntro.vue`.
- **Neutral:** kortA och kortB har samma layout, tid och färg. Bara texten byts. Sidan A/B visas aldrig.
- Sekvensen kopplas in i `rollval` (`clipsOnly`) av entré-sessionen. Den här mappen innehåller bara komponenten.

**Rollnamn (Josef 2026-11-19):**

| Station | A / B |
|---|---|
| Förhandlingen | Sändebud / Rapportör |
| Människotestet | Äkthetsgranskare / Sanningsanalytiker |
| Undersökningen | Labbtekniker / Forensiker |
| Reaktorkärnan | Expeditionsledare / Fälttekniker |

**Valvfärg på tejpen (SYV-låsningen):**

| Station | Valvfärg |
|---|---|
| Förhandlingen | `#7ad14f` |
| Människotestet | `#ff5a3c` |
| Undersökningen | `#4aa3ff` |
| Reaktorkärnan | `#e8c020` |
