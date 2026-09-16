# Undertext (WebVTT)

Lägg den svenska undertexten här som **`sv.vtt`** (standard WebVTT). Appen
hämtar `/subtitles/sv.vtt`, parsar den själv och renderar den synkat mot Ljud 1
(CRT-stil). Saknas filen visas ingen text — renderaren är tålig.

Arbetsgång: auto-transkribera `Sound/Ljud 1.mp3` → `.vtt`, finjustera tiderna.

Exempel på format:

```
WEBVTT

00:00.000 --> 00:05.040
Välkommen till diplomatkåren. Som ni ser gör vi

00:05.040 --> 00:11.140
rösterna anonyma för att skydda vår identitet …
```

Nytt språk = eget ljud + egen `.vtt` (t.ex. `no.vtt`) + egen cue-tidslinje
(`src/stations/forhandlingen/intro/timeline.ts`), eftersom tiderna skiljer.
Byt även `INTRO_MEDIA` i `src/config.ts` för att peka på rätt ljud/undertext.
