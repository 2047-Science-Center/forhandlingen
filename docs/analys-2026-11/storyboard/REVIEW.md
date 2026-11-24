# REVIEW: storyboard "Förhandlingen: nuläge mot förslag" (2026-11-24)

## Vad det är

Det här är en skiss på 68 s som hör till [`../../ANALYS-FLODE-2026-11.md`](../../ANALYS-FLODE-2026-11.md). Den är inte stationsmedia.

- **Scener:** titel, tidslinje, steg, lucka (Klubban), coach (TILLBAKA), spelläge (TÄVLING + 3-2-1) och de fem förslagen.
- **Formspråk:** samma som `xy-produktion/spellage/skiss`, alltså CRT `#05100b` med scanlines, Oswald 700 och IBM Plex Mono. Färgerna är stationens tokens: tutorial `#35e0d0`, skarp `#ff9500`, sidorna `#fff1d6`/`#ff3cc8`.
- **Ljud:** bara stationens egna sfx från `public/Sound/sfx`, på synliga händelser (tryck, stämpel, klubba). Ingen musik och ingen röst, eftersom det är en arbetsskiss.

## Kontroll

`hyperframes check` gav 0 fel. Följande varningar är kvar med flit:

- `line_unread` i luckscenens vänstra halva: inmatningen ska kännas hackig och snabb, det är själva poängen.
- `line_unread` på coach-steg 3, som visas 2,5 s.
- `text_below_floor`: segmentetiketterna i tidslinjen är 24 px. Skissen visas på skärm, inte på telefon.
- `content_overlap` på coach-bubblans korsfade.

Jag har tittat på review-arken, men ljudet har jag bara mätt (`hyperframes audio`), inte lyssnat på.

## Svagast

Tidslinjens siffror är uppskattningar ur config och klipplängder, inte mätta med en grupp. Med mer tid skulle jag mäta en riktig körning och visa 3D-luckan (`intro-3d/scen3`) i coach-scenen i stället för en platt konsol.
