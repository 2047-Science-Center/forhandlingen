# Lag-loggor

Lägg lagens loggor här (valfritt):

- `a.png` — Lag A
- `b.png` — Lag B

Kvadratiska bilder (t.ex. 256×256 PNG med transparens) ser bäst ut. Filer i
`public/` serveras från roten, så de refereras som `/teams/a.png` — det är redan
inställt i `src/config.ts` (`TEAMS`). Saknas filen visas bokstaven (A / B) i
stället tills du lägger dit den.

Vill du byta namn/sökväg: ändra `logo` i `TEAMS` i `src/config.ts`.
