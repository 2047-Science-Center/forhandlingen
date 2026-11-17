# Rollval-flödet (X&Y)

Ett gemensamt touchskärms-flöde som läggs **först** i en station, **före**
stationens eget flöde. Identiskt i alla X&Y-stationer (Förhandlingen,
Undersökningen, Minnestestet). Besökaren tittar på ett kort "en dag i livet"-
klipp per roll och väljer sedan roll på skärmen.

> Samma `ROLLVAL.md` ligger i alla tre repon (identisk). Byggt som en
> station-kit-komponent (Lager A) och speglat oförändrat till varje repo.

## Flödet

Attract-skärmen äger stationen och kommer **före** rollvalet. Själva rollvalet:

1. **Attract** – stationens vanliga attract-skärm (första gesten startar).
2. **Intro** – stationen + de två rollerna presenteras. Tryck "Utforska rollerna ▸".
3. **Klipp – roll A** – "Se hur en dag i livet ser ut som *[roll A]*" → videoklipp, klicka play, "Nästa ▸".
4. **Klipp – roll B** – "Se hur en dag i livet ser ut som *[roll B]*" → videoklipp, "Nästa ▸".
5. **Val (split screen)** – båda rollerna sida vid sida, med frågan **"Vilken av dem känns som du?"**
6. **Välj roll** – besökaren trycker på en roll på skärmen.

> Band-bipp kopplas in **senare** (steg 6 blir då ett band-bip). I detta läge
> väljer man på touchskärmen – ingen band-bipp.

Efter val (eller "Hoppa över ▸") fortsätter appen in i stationens ordinarie
flöde. Rollvalet är det ENDA roll-/startsteget — det **ersätter** stationernas
äldre ad hoc-rutor (bippa band / välj roll) så alla gör detta på ETT
standardiserat sätt. Allt är gatat på `ROLLVAL_ENABLED`: stängs rollvalet av
återgår varje station till sina gamla rutor.

## Ersätter befintliga rutor (per station)

| Station | Ersätter | Hur |
|---|---|---|
| **Förhandlingen** | Bipp-start (`BippStart`, onboarding-stage `identify`) + rollpresentationen (`RolesSplit`, "vem gör vad") | Onboardingen startar direkt vid `headset`; deltagarskärmen går rakt in i coach-stegen. Styrs av `ONB_START` i `store/gameStore.ts`. |
| **Minnestestet** | Spelväljaren (`GameSelect`, "Välj test") | Roll-valet driver spelet: Äkthetsgranskare → människotestet, Sanningsanalytiker → lögndetektorn (`chooseGame`). Hoppar man över rollvalet → `GameSelect` visas som fallback. |
| **Undersökningen** | — | Ingen befintlig bippa-band/roll-ruta (rollerna är valv-bundna: LABB/FÄLT). Rollvalet läggs bara till som för-steg; inget tas bort. |

## Inramning (framtidsyrken – IMPLICIT)

Rollerna beskrivs som **förmågor värda att vara bra på** – egenskaper som bär
långt i en framtid där mycket annat automatiserats. Framingen är **implicit**:
copyn säger **aldrig** "framtidsyrke" och nämner **aldrig** AI. Den visar bara
rollen som något eftersträvansvärt och mänskligt.

## Rollkarta (LÅST)

| Station | Roll A | Roll B |
|---|---|---|
| **Förhandlingen** | Sändebud | Rapportör |
| **Undersökningen** | Doktorand | Metodspecialist |
| **Minnestestet** | Äkthetsgranskare | Sanningsanalytiker |

- **Förhandlingen**: Sändebud = den som möter motparten; Rapportör = den som
  håller överblick och fattar besluten. (Speglar stationens två roller.)
- **Undersökningen**: Doktorand ↔ FÄLT; Metodspecialist ↔ LABB.
- **Minnestestet**: Äkthetsgranskare = människotest-sidan ("är det en äkta
  människa?"); Sanningsanalytiker = lögndetektor-sidan ("är det sant?").

## Klippset

Varje station har **två klippset**. Ett set = **ett klipp per roll**. Vid en
körning visas **ett** set (ett klipp per roll) – olika set ger variation mellan
grupper.

**För testet körs ETT fast set per station** (båda seten finns kvar i config):

| Station | Aktivt set (test) | Klipp som visas |
|---|---|---|
| Förhandlingen | **set 1** | Ida sändebud + Ossian rapportör |
| Undersökningen | **set 2** | Frederico doktorand + Essy metodspecialist |
| Minnestestet | **set 1** | placeholders |

- Aktivt set styrs av `ROLLVAL_START_SET` i `src/config.ts`:
  - `0` / `1` = lås till ett fast set (så det är satt nu).
  - `'alternate'` = växla set per körning (sparas i `localStorage`).
- **SET-växeln är av** i testet. Slå på den diskreta SET 1/2-växeln (uppe till
  vänster) för granskning genom att skicka `:show-set-toggle="true"` till
  `RoleSelect` i stationens app-skal.
- Hela flödet stängs av med `ROLLVAL_ENABLED = false` (appen kör då utan det).

## Var ligger klippen + exakta filnamn

Riktiga klipp ligger i **`<station>/assets/`** (ej `public/`). Flödets `<video>`
pekas dit via Vite-glob i `src/config.ts`. Matcha filnamnen **exakt**
(versalisering, å/ä/ö och mellanslag spelar roll).

### Förhandlingen — `forhandlingen/assets/`
| Set | Sändebud | Rapportör |
|---|---|---|
| 1 | `Ida sändebud.mp4` | `Ossian rapportör.mp4` |
| 2 | `Jakob Sändebud.mp4` | `Mary rapportör.mp4` |

### Undersökningen — `undersokningen/assets/`
| Set | Doktorand | Metodspecialist |
|---|---|---|
| 1 | `Karin doktorand.mp4` | `Dragan metodspecialist.mp4` |
| 2 | `Frederico doktorand.mp4` | `Essy metodspecialist.mp4` |

### Minnestestet — `minnestest/Assets/` (PLATSHÅLLARE)
Inga riktiga klipp ännu → tydligt märkta placeholder-mp4:er (prefix `roll_`).
Byt mot riktiga klipp (behåll filnamnen, eller byt namn och uppdatera
`src/config.ts`).
| Set | Äkthetsgranskare | Sanningsanalytiker |
|---|---|---|
| 1 | `roll_akthetsgranskare_set1.mp4` | `roll_sanningsanalytiker_set1.mp4` |
| 2 | `roll_akthetsgranskare_set2.mp4` | `roll_sanningsanalytiker_set2.mp4` |

### Stresstestet — `stresstest/assets/` (ENDAST registrerad – appen ej byggd)
Klippen finns men stationen är inte byggd. Mappningen registreras här så den är
redo när appen byggs:
| Set | Expeditionsledare | Fälttekniker |
|---|---|---|
| 1 | `Gabriella expeditionsledare.mp4` | `Erik fälttekniker.mp4` |
| 2 | `Daniel expeditionsledare.mp4` | `Anna fälttekniker.mp4` |

## Byta ut ett klipp

1. Lägg den nya mp4:en i `<station>/assets/` (Minnestestet: `minnestest/Assets/`).
2. Behåll filnamnet ovan → inget mer behövs. Byter du namn: uppdatera
   motsvarande rad i `clipSets` i `src/config.ts` (matcha exakt).

## Kod (var saker bor)

- Komponent (identisk): `src/station-kit/rollval/RoleSelect.vue` + `types.ts`
- Per-station data + klippmappning: `src/config.ts` (`ROLLVAL`, `ROLLVAL_ENABLED`, `ROLLVAL_START_SET`)
- Inwire:at som skippbart första-steg i stationens app-skal
  (`ForhandlingenApp.vue` / `UndersokningenApp.vue` / `MinnestestApp.vue`).
