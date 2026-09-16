# Förhandlingen — station i X&Y-riggen

En spelbar budgivningsstation för två lag med maskerad röst, byggd i **två lager**:

- **`src/station-kit/`** (Lager A) — återanvändbart stations-kit som alla fyra
  X&Y-stationer delar: retro-CRT-tema, i18n, framskriven text, bildupprendering,
  syntetiserad ljudmotor, lag-panel, attract-skärm, och adaptrar.
- **`src/stations/forhandlingen/`** (Lager B) — spelet Förhandlingen ovanpå kitet:
  ren TS-spelmotor, Pinia-store, och Vue-UI.

Byggd efter metoden i skillen `stationsbygge` (äg sömmen, lägsta-kodade vägen,
semantiska meddelanden). **Inga hemligheter** (broker-url, lösenord, tokens) i
denna kod — de hör hemma i driftmiljöns config.

Repo: `2047-Science-Center/forhandlingen`. Push till `main` → GitHub Pages
bygger om automatiskt: <https://2047-science-center.github.io/forhandlingen/>.

## Köra online mot annan enhet (dator/iPad)

GitHub Pages ger bara **samma-enhet**-synk (BroadcastChannel). För **kors-enhet
över internet** (dator ↔ iPad) finns en kombinerad server som servar den byggda
appen OCH kör WebSocket-reläet på samma origin (`server/server.mjs`):

- **Lokalt / LAN:** `npm run serve` → öppna `http://<din-ip>:8080/#lag1` och `…/#lag2`.
- **Internet (Render):** anslut repot i Render (New → Blueprint; `render.yaml`
  finns) — bygger `npm run build:relay` och startar `node server/server.mjs`.
  Öppna den https-url du får: dator på `…/#lag1`, iPad på `…/#lag2` → synkas via
  `wss://<host>/ws`. (Railway/Fly funkar likadant; `Dockerfile` finns.)

Appen väljer transport automatiskt: `?net=<wsUrl>` (uttryckligt) → annars
same-origin-relä om bygget satt `VITE_RELAY_PATH` → annars BroadcastChannel.

## Kör piloten

```bash
npm install
npm run dev
```

Öppna sedan appen i **två fönster** (samma webbläsare) för tvåskärms-piloten:

- Lag A: <http://localhost:5173/#lag1>
- Lag B: <http://localhost:5173/#lag2>
- Delad vy (soloprov, båda konsolerna): <http://localhost:5173/#shared>

Fönstren synkas via `BroadcastChannel` (samma dator/webbläsare) — registrerar
ett lag ett köp ser det andra det direkt. Lägg fönstren på var sin skärm så
mockar du hela spelet. Sen-anslutande fönster hämtar aktuellt tillstånd
automatiskt.

### Spela online mot en kompis (olika datorer)

`BroadcastChannel` fungerar bara på samma dator. För två datorer finns en liten
relä-server som skickar samma meddelanden över nätet:

```bash
npm run relay        # startar ws://localhost:8787
```

Öppna appen med `?net=<wsUrl>&room=<rum>` (param före `#`):

- Dator 1 (Lag A): `http://<host>:5173/?net=ws://<host>:8787&room=match1#lag1`
- Dator 2 (Lag B):  `http://<host>:5173/?net=ws://<host>:8787&room=match1#lag2`

Samma `room` = samma spel. På samma lokala nät byter du `<host>` mot datorns
LAN-IP (t.ex. `192.168.1.42`) och kör Vite med `npm run dev -- --host`. Över
internet: deploya den byggda appen + relä-servern bakom TLS (`wss://`). Ingen
kod behöver ändras — bara `?net`-adressen. Samma `WebSocketTransport` används
sedan i skarp drift mot NUC-orkestratorn.

### Lag-loggor

Lägg `a.png` och `b.png` i `public/teams/` (se `public/teams/README.md`).
Tills dess visas bokstaven (A / B). Lagnamn och roster ändras i `TEAMS` i
`src/config.ts`. Ingen färgmarkering per lag — allt i bärnsten.

### Onboarding: headset → 4 ljudblock + 3 tester → skarp körning

Sekvens: **headset** (maskerad röst, mockup) → **BÖRJA** → **Block 1** → **Test 1**
→ **Block 2** → **Test 2** → **Block 3** → **Test 3** → **Block 4** → **skarp körning**.

- **Ljudblocken** (`Sound/ljud 1.1–1.4.mp3`) startar **synkat per valv** (delad
  epoch, drift-korrigerad). Cue-tidslinjer per block i
  [`onboarding/blocks.ts`](src/stations/forhandlingen/onboarding/blocks.ts);
  undertext per block i `public/subtitles/block1–4.vtt`.
- **Två demo-lägen:** *enkel-demo* (foto vänster + illustration höger, I1/I2/I4)
  och *förhandlingsdemo* (foto överst ~70 %, Nord/Syd settle-UI-kopia under,
  talarmarkering = spotlight på talarens halva). Demona speglar det riktiga
  settle-UI:t och auto-spelar manusets klick.
- **Testerna** görs i egen takt; en **barriär** ("Väntar på andra valvet") gatar
  nästa block tills **båda valv** är klara. Inga roller i testerna.
  - **Test 1:** 1 resurs, 30 kr, 3 popupar, 5 s + 15 s.
  - **Test 2:** 3 resurser, 60 kr, 2 popupar (livsviktig + pengar), utan gissning.
  - **Test 3:** lås gissningen (på Test 2:s omgång) — ingen feedback.
- **Skarp körning:** 100 kr, 5 resurser, 10 s före första + 5 s mellan, 30 s/förhandling.
  Roller (sändebud/rapportör) sätts uppströms. Poäng till system 1/2 som förut.

Valven heter **Valv Syd** (vänster) / **Valv Nord** (höger). Kit-delar
(återanvändbara): `AudioSlides` (cue-driven audio+slides, VTT-sync,
center/split/negotiate + svep, hoppa över) och `vtt.ts`. Termen **livsviktig**
(tidigare "kritisk") genomgående. Per språk: byt ljud + `.vtt` + tider per block.

### Roller & start

Rollval/uppdelning sker **uppströms i riggen** — man kommer rakt in i
dashboarden med lagen (LAG A/LAG B) och deras roller redan satta. Tryck
**STARTA RUNDAN** (eller **STARTA** i pilotpanelen, ⚙ nere till höger — finns
bara i pilotläge, för dataset/nollställ).

## Spelet i korthet

5 resurser auktioneras en i taget. Man ser **inte** på förhand vilken resurs som
ligger i nästa lucka — luckorna är anonyma thumbnails, och resursen ni förhandlar
om NU visas stort. Varje lag har en hemlig **kritisk resurs** som måste säkras.
Efter budgivningen gissar varje **rapportör** motståndarens kritiska — rätt
gissning dubblar lagets poäng. **Förhandlaren** vinner på att spendera minst.

**Timern** är knuten till varje förhandling och räknar ner från 30 s. När en
förhandling avräknas pausas timern; nästa luckas timer startar först när
slutpriset är bekräftat.

**Ett fokuserat steg i taget** (självklart vad man gör i varje läge):

0. **Intro-popup** (innan första luckan) — "Er kritiska resurs är X" med
   scenariotext (~5 s), som flyger upp till sin plats i headern, följt av
   "Här är era pengar" (~5 s).
1. **Gör er redo** — "Nu ska ni förhandla om resursen X" + nedräkning (10 s).
2. **Budgivning pågår** — bultande prick, nedräkning (30 s), resursen i mitten,
   "den som betalar mest när tiden är ute får resursen". (Facilitator kan avsluta
   i förtid; annars slut när timern är ute.)
3. Automatiskt hos en (slumpad, varannan gång) rapportör: **Vem vann?**
4. **Slutpris** dras på en slider (touch) — eller **Ingen köpte** → *Skicka till vinnaren*.
5. Bekräfta-ruta poppar hos **vinnaren** → bekräfta → kapital dras, luckan
   markeras vunnen (med LAG A/LAG B), ca 1 s senare startar nästa nedräkning.

Kritisk resurs ("resursen ni måste få tag på") ligger i headern; luckraden är en
liten prick-rad som bara visar hur många luckor som återstår (resurserna hemliga).

## Skript

| Kommando            | Gör                                            |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Startar dev-servern (Vite).                    |
| `npm run build`     | Typecheck + produktionsbygge.                  |
| `npm test`          | Kör enhetstesterna (spelmotor: avräkning + poäng). |
| `npm run typecheck` | Endast typkontroll (vue-tsc).                  |

## Pilot → drift: byt läge, inte logik

All skillnad mellan pilot och skarp drift ligger i **`src/config.ts`** (`mode`)
och adaptrarna. Spelmotorn och UI:t rörs aldrig.

| Utbyte      | Pilot (live)                | Drift (stubbad)                       |
| ----------- | --------------------------- | ------------------------------------- |
| Transport   | `BroadcastChannelTransport` | `WebSocketTransport` (NUC-orkestrator) |
| Ljus        | `ScreenLights` (luckrad)    | `MqttLights` → `station<N>/lights`    |
| Identitet   | `MockIdentity`              | `MqttIdentity` → `station<N>/rfid`/`identity` |
| Resultat    | `MockResultSink` (loggar)   | `MqttResultSink` → `station<N>/result`/`done` |

Ljus, identitet och resultat följer riggens **frysta kontrakt** (se
`src/station-kit/adapters/**` och beställningsfilen §5). `STATION_N` är en
konstant i config — **anta aldrig ett legacy-nummer**, bekräfta mot riggen innan
skarp koppling.

Pilotens luckrad använder exakt samma `{ hatch, state, winner }`-meddelanden som
`MqttLights` skulle skicka till LED-remsan — samma logik, bara "displayen" skiljer.

## Arkitektur

```
src/
  config.ts                     mode (pilot/production), STATION_N, datasets, kapital, timer, språk
  station-kit/                  LAGER A — delas av alla fyra stationer
    theme/crt.css               retro-CRT-tokens + chrome (bakom intensitet + reduced-motion)
    i18n/                        sv (byggd), no + svorsk (stubbade)
    audio/AudioEngine.ts         syntetiserad SFX, mute/volym, kiosk-upplåsning
    components/                  CrtScreen, Teletype, CrtImage, TeamPanel, AttractScreen, MuteButton
    adapters/                    transport / lights / identity / result (pilot live, drift stubbad)
  stations/forhandlingen/       LAGER B
    engine/                      REN TS-spelmotor (reducer) + scoring + typer + tester
    store/gameStore.ts           Pinia: binder motor ↔ adaptrar ↔ transport (ingen spellogik)
    components/                  TeamIdentity, ReporterConsole, HatchRow, BiddingZone, GuessView, ResultView, PilotPanel
    ForhandlingenApp.vue         attract → konsol(er) per vy
server/relay.mjs                liten WebSocket-relä för online-test (olika datorer)
```

## Firmware

ESP32-firmwaren (WS2812 via `station<N>/lights`) är **inte** byggd här — se
`FIRMWARE-SKISS.md` för skissen och beställningen till Erik.
