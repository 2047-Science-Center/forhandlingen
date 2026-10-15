# Förhandlingen — ljud-identitet, genereringsprompter och kopplingskarta

STATUS: **Assets genererade och inkopplade (2026-10-15).** De 15 ljuden ligger i
`public/Sound/sfx/` (ElevenLabs text-to-sound-effects v2, normaliserade: UI −10 dBFS,
vinst/live −6 dBFS, attract-loop −18 dBFS). `SAMPLES_ENABLED = true`. Alla ljud i
kopplingskartan nedan är inkopplade UTOM `sfx-attract-loop` (kräver loop-stöd i
motorn — ej gjort). Prompterna nedan sparas som referens för omgenerering.
Nyckeln användes bara transient vid generering och finns ingenstans i repot.

## 1. Ljud-identitetsanalys (utifrån det som redan finns)

**Berättarröst (public/Sound/ljud 1.1–1.4.mp3)** — ElevenLabs-röster ("Kai – Clean,
Modern, Global" + "Cecilia O'Connor – Warm & Conversational"), ihopklippta i
Premiere, med ett diskret musklick ("big mack click") och sorl av människor i en
stor hall under. 48 kHz stereo 192 kbps, ca -21 dB RMS / -28 LUFS, peak -4 dBFS.
Känsla: **ren, modern, varm, mänsklig; lugn och "rumslig"**. Inga effekter eller
musik — röst + minimal bakgrund.

**Syntetiserad UI-motor (AudioEngine.ts)** — Web Audio, bara fyrkant/triangel/
sågtand-oscillatorer, mycket korta (30–350 ms), snabb attack (8 ms) och
exponentiellt avtag. Tonhöjderna är **rena kvinter och durtrior**: confirm 660→990
(E5→B5, kvint), hatch 880→1320 (A5→E6, kvint), win 523-659-784-1047 (C-dur-
arpeggio uppåt), deny 180/140 Hz sågtand (grumligt, lågt), boot = sågtandssvep
80→520 Hz + 660-blipp, render = sågtandssvep 220→1400. Budgivningen i intro
stegrar fyrkantsblipp 320+n·130 Hz. Inga ackord-bäddar, ingen efterklang.

**Tema (crt.css)** — bärnstens-terminal (#ff9500) på nästan svart grön; VT323/
IBM Plex Mono; glöd, scanlines. Terminal-/teletype-estetik.

**Slutsats — paletten att bygga vidare på:**
- *Retro-CRT-terminal*: 8/16-bitars blippar, fyrkantsvåg, teletype-klick, kort
  elektrisk bärnstensglöd. Kort, torrt, nästan ingen reverb (ev. en antydan av
  litet rum).
- *Musikaliskt*: uppåtgående kvint/durtriad = framsteg/vinst; sjunkande eller
  lågt grumligt = nej/fel. Håll dig i C/E/A-dur-världen (E5, B5, A5, E6, C5–C6).
- *Mänsklig motvikt*: berättarrösten är varm och mänsklig, så UI-ljuden ska vara
  **lågmälda och torra** och aldrig konkurrera med rösten (rösten ligger runt
  -21 dB RMS; UI-ljud peakar max ca -10 dBFS, vinst/live -6 dBFS).
- *Muskeln*: det "mänskliga" musklicket i berättarmixen får återkomma som
  mekaniskt knapp-/lås-klick i lås-in-ljudet — en röd tråd mellan film och UI.

## 2. Genereringsprompter (sound-effects-skillen / ElevenLabs)

Gemensamt för ALLA prompter — lägg som prefix: **"Retro amber CRT terminal UI
sound, 8-bit square and triangle wave, dry, no reverb, no music, no voice, clean
start and clean cut-off."**

Kör så här (en per rad, `prompt_influence` 0.6–0.8 för korta UI-ljud):

```bash
elevenlabs text-to-sound-effects convert --text "<prefix> + <prompt>" \
  --duration-seconds <s> --prompt-influence 0.7 --output public/Sound/sfx/<fil>
```

(Python: `client.text_to_sound_effects.convert(text=..., duration_seconds=..., prompt_influence=0.7)`.
Generera gärna 3 varianter per ljud och välj bäst. Trimma tystnad, normalisera
till peak ca -8 dBFS; mp3 44.1/48 kHz 128 kbps räcker. Mål per fil: < 60 kB,
bortsett från loopen.)

| Fil (public/Sound/sfx/) | Sek | Prompt (efter prefixet) | Semantisk händelse |
|---|---|---|---|
| `sfx-boot.mp3` | 2.0 | rising sawtooth power-up sweep from deep hum to bright, ending in one crisp square blip a fifth above; old computer waking up | Attract-skärm/titelskärm ("tryck för att börja"), boot |
| `sfx-hatch-open.mp3` | 0.6 | two quick bright square blips a fifth apart, upward, like a small switch lighting a lamp | Ny lucka tänds / budgivning startar / förhandling börjar |
| `sfx-confirm.mp3` | 0.5 | soft two-note triangle chime, E to B (rising fifth), friendly, warm, short | Generell bekräftelse (steg -> bekräfta) |
| `sfx-lock-in.mp3` | 0.5 | heavy mechanical keypad "clack" followed by a bright square blip a fifth up, decisive, final, like locking a vault | Lås in bud / pris / bekräfta köp |
| `sfx-deny.mp3` | 0.5 | low buzzy sawtooth double-buzz, muddy and short, polite error, not aggressive | Avbryt / ogiltigt / fel |
| `sfx-nobuy.mp3` | 0.6 | soft descending two-note triangle sigh, a fifth down, neutral and calm | "Ingen köper" (noBuy) |
| `sfx-popup.mp3` | 0.4 | tiny upward square sweep ending in a high blip, like a small window popping up on a terminal | Popup/ruta slår upp (OverviewPopups, hjälprutor) |
| `sfx-tick.mp3` | 0.25 | single short dry square-wave tick, mid-high pitch, metronome-like | Nedräkning, tick per sekund |
| `sfx-tick-final.mp3` | 1.0 | one long confident square blip layered with a triangle an octave lower, clear "go" signal, fades cleanly | Sista tick / nedräkning slut |
| `sfx-phase-live.mp3` | 2.5 | dramatic rising sawtooth sweep that resolves into a bright triangle major-triad arpeggio C-E-G-high C, "the real thing starts now" | Övergång från träning till skarpt |
| `sfx-win-fanfare.mp3` | 3.0 | short retro 8-bit victory fanfare, major key, triangle and square leads, ending on a held bright high C, no drums | Reveal / resultat (phase reveal) |
| `sfx-render.mp3` | 0.8 | glitchy upward sawtooth scan sweep with faint digital static, like an image being drawn line by line on a CRT | Bild renderas på skärmen (CrtImage) |
| `sfx-stamp.mp3` | 0.4 | dull low "thunk" stamp with a tiny high click on top, heavy paper-and-metal | Livsviktig resurs markeras (stämpel) |
| `sfx-idle-warn.mp3` | 1.2 | two gentle repeated triangle blips, soft reminder, not alarming | "Återställs strax"-varning (inaktivitet) |
| `sfx-attract-loop.mp3` (valfri) | 10 (`--loop`) | very quiet seamless loop: low amber CRT terminal hum with faint distant crowd murmur in a large hall and the occasional soft teletype tick | Bakgrund på attract-skärm (matchar murmlet i filmljuden) |

`blip` (teletype-tecken) och budgivningens stegrande `beep(freq)` ska **förbli
syntetiserade** (per-tecken/parametriska, noll latens).

## 3. Kopplingskarta (var varje ljud avfyras)

Motorn: `src/station-kit/audio/AudioEngine.ts`. Alla nya händelser finns redan
som `audio.play('<namn>')` med syntetiserad fallback; samplen tar över när
`SAMPLES_ENABLED = true` och filen ligger i `public/Sound/sfx/` (mappning
`SAMPLE_FILES` i samma fil).

| Sfx-namn | Fil | Idag kopplat? | Rekommenderad koppling (fil / plats) |
|---|---|---|---|
| `boot` | sfx-boot | JA | `station-kit/components/AttractScreen.vue` (unlock+play), `onboarding/opening/TitleScreen.vue` onMounted |
| `hatch` | sfx-hatch-open | JA | `store/gameStore.ts` applyEffects: intro->bidding, step negotiating, lucka vunnen |
| `confirm` | sfx-confirm | JA | `store/gameStore.ts` applyEffects: step 'confirm'; OverviewPopups s2 |
| `deny` | sfx-deny | JA | `store/gameStore.ts` cancelEntry(); OverviewPopups s1-zero |
| `win` | sfx-win-fanfare | JA | `store/gameStore.ts` applyEffects: phase 'reveal'. OBS: används också för "rätt!" i OverviewPopups (s1-ok, s3-right, s3-x2) — där bör den korta `confirm` användas, och fanfaren spelas bara på riktiga reveal |
| `render` | sfx-render | JA | `station-kit/components/CrtImage.vue` |
| `lockin` | sfx-lock-in | NEJ | `store/gameStore.ts` confirmPurchase()/enterPrice() (där priset låses in) — ersätter `confirm` i den punkten |
| `nobuy` | sfx-nobuy | NEJ | `store/gameStore.ts` noBuy() |
| `popup` | sfx-popup | NEJ | `onboarding/opening/OverviewPopups.vue` (när en ruta visas, t.ex. via sfxOnce) och övriga popups |
| `tick` | sfx-tick | NEJ | `components/BiddingZone.vue` — watch på `countdown` (sekunder kvar) när > 3 |
| `tickfinal` | sfx-tick-final | NEJ | `components/BiddingZone.vue` — när `countdown` når 0 / "GO" |
| `live` | sfx-phase-live | NEJ | Övergång träning->skarpt (onboarding-slut/`config.mode`-byte; där `Onboarding.vue` släpper in i spelet) |
| `stamp` | sfx-stamp | NEJ | `OverviewPopups.vue` s1-stamp (idag `render`) |
| `idlewarn` | sfx-idle-warn | NEJ | `store/gameStore.ts` där IDLE_WARN_MS-varningen visas (IDLE_RESTART i config.ts) |
| (loop) | sfx-attract-loop | NEJ | Ny: spela i loop i `AttractScreen.vue`, stoppa vid start. Kräver loop-stöd i motorn (inte gjort) |

Kopplingarna i onboarding-/budgivnings-/store-filer är medvetet INTE gjorda
(parallell UI-omskrivning pågår). Det är nästa steg.

## 4. Så slår du på dem

1. Kör genereringarna ovan, lägg filerna i `public/Sound/sfx/`.
2. Sätt `SAMPLES_ENABLED = true` i `src/station-kit/audio/AudioEngine.ts`.
3. Koppla de saknade `audio.play('…')`-anropen enligt tabellen.
4. Lyssna: UI-ljuden ska ligga klart under berättarrösten (-21 dB RMS).
