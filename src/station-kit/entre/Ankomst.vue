<script setup lang="ts">
/**
 * "STÄLL ER PÅ RÄTT SIDA" (Lager A — IDENTISK i alla X&Y-stationer) = entréns attract.
 *
 * v3 (Josef 2026-11-27, xy-produktion/ankomst/UTVARDERING.md + mockup-sida-a/b.png): EN SKÄRM = EN SIDA.
 * Rutan svarar på fyra frågor i den här ordningen:
 *   1. Står jag vid rätt station?   → stationsnamnet stort överst (spellägesmärket ① till vänster)
 *   2. Står jag vid rätt skärm?     → DEN HÄR sidans ruta stor (~60 %), hel ram i sidfärgen, STÅ HÄR
 *   3. Om inte, vart ska jag?       → andra sidans ruta smal, streckad, "Gå till andra skärmen ▶"
 *   4. Vad gör vi nu?               → en rad + "VI STÅR RÄTT ▸"
 *
 *   ┌ ◐ SAMARBETE            UNDERSÖKNINGEN               TESTGRUPP 2 ┐
 *   │ ┌──────────── SIDA A ── [STÅ HÄR] ┐  ┌ ─ SIDA B ─ ─ ─ ─ ─ ─ ┐  │
 *   │ │  ♟ Alma                          │    Fredrik · Wilma · Ebba    │
 *   │ │  ♟ Noah    (stort)               │  │ Gå till andra skärmen ▶│  │
 *   │ └──────────────────────────────────┘  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘  │
 *   └ Hitta ditt namn. Står det i den stora rutan? …   [VI STÅR RÄTT ▸] ┘
 *
 * Den egna rutan står på sin fysiska sida (A vänster, B höger), så pilen pekar dit man ska gå.
 * Delad vy (pilot, ingen screenSide): två lika rutor. Rollnamnen (sides[].label) visas INTE här —
 * rollen väljs efteråt; sides[].ankomst (st2: sidans spel) blir en liten underrad. 3D-bilden visas
 * inte längre i ankomsten (den dubblerade namnen); `illuSrc` finns kvar för kompatibilitet.
 * Startsidorna = entréns voteSides (klasslistans `halva`, annars seedad indelning — samma vid alla stationer).
 */
import { computed, ref, watch } from 'vue'
import { useRotation } from '../rotation/rotation'
import { useEntre } from './entre'
import SpellageSymbol from '../spellage/SpellageSymbol.vue'
import type { Lage } from '../spellage/spellage'
import type { SideId } from './types'

withDefaults(defineProps<{ /** Används inte längre i ankomsten (3D:n visas i utfallet). */ illuSrc?: string }>(), {
  illuSrc: '',
})

const entre = useEntre()
const s = entre.state
const rot = useRotation().state
const cfg = computed(() => entre.config())

const LAGE_TEXT: Record<Lage, { ord: string; rad: string }> = {
  samarbete: { ord: 'SAMARBETE', rad: 'två sidor, ett lag' },
  tavling: { ord: 'TÄVLING', rad: 'sida mot sida' },
  motValdi: { ord: 'MOT VALDI', rad: 'var och en mot VALdi' },
}
const lage = computed(() => (cfg.value.lage ? { lage: cfg.value.lage, ...LAGE_TEXT[cfg.value.lage] } : null))

const egen = computed<SideId | null>(() => s.screenSide ?? null)
const SIDES = ['A', 'B'] as const
const columns = computed(() =>
  SIDES.map((side) => ({
    side,
    under: cfg.value.sides?.[side]?.ankomst ?? '',
    names: entre.members.value.filter((m) => entre.voteSides.value[m.band_id] === side).map((m) => m.name),
    mine: egen.value === side,
    other: egen.value != null && egen.value !== side,
  })),
)
/** Många namn på en sida → lite mindre text så att alla får plats. */
const manga = computed(() => Math.max(...columns.value.map((c) => c.names.length)) > 3)

const grupp = computed(() =>
  rot.group != null && rot.phase !== 'off'
    ? { rad1: `TESTGRUPP ${rot.group}`, rad2: `RUNDA ${rot.round}${rot.manual ? ' · manuellt' : ''}` }
    : { rad1: 'PILOTGRUPP', rad2: '' },
)

/**
 * Attract-bilden (config.attractBild) som svag remsa BAKOM RUBRIKEN, aldrig bakom namnen. Visas bara om
 * den faktiskt laddas (saknad fil → ingen bild; Vite/statisk server svarar annars index.html med 200).
 */
const bildOk = ref(false)
watch(
  () => cfg.value.attractBild,
  (src) => {
    bildOk.value = false
    if (!src || typeof Image === 'undefined') return
    const img = new Image()
    img.onload = () => (bildOk.value = cfg.value.attractBild === src && img.naturalWidth > 0)
    img.onerror = () => (bildOk.value = false)
    img.src = src
  },
  { immediate: true },
)
const bandStil = computed(() =>
  bildOk.value && cfg.value.attractBild ? { backgroundImage: `url("${cfg.value.attractBild}")` } : undefined,
)
const pil = (side: SideId) => (side === 'A' ? '◀ Gå till andra skärmen' : 'Gå till andra skärmen ▶')
</script>

<template>
  <div
    class="ak"
    :class="{ 'ak--delad': egen == null, 'ak--manga': manga }"
    role="button"
    tabindex="0"
    @click="entre.start()"
    @keydown.enter="entre.start()"
  >
    <div v-if="bandStil" class="ak__band" :style="bandStil" aria-hidden="true" />

    <!-- 1. Station (+ spelläget ① och gruppen) -->
    <header class="ak__top">
      <div class="ak__lage">
        <template v-if="lage">
          <SpellageSymbol :lage="lage.lage" :size="96" class="ak__symbol" />
          <span class="ak__lage-text">
            <b>{{ lage.ord }}</b>
            <small>{{ lage.rad }}</small>
          </span>
        </template>
      </div>
      <h1 class="ak__station">{{ cfg.stationTitle }}</h1>
      <p class="ak__grupp">
        {{ grupp.rad1 }}<template v-if="grupp.rad2"><br />{{ grupp.rad2 }}</template>
      </p>
    </header>

    <!-- 2–3. Den här sidan (stor) + andra sidan (smal) — den egna på sin fysiska sida -->
    <main class="ak__sidor">
      <section
        v-for="c in columns"
        :key="c.side"
        class="ak__sida"
        :class="[`ak__sida--${c.side}`, { 'ak__sida--egen': c.mine, 'ak__sida--andra': c.other }]"
      >
        <header class="ak__huvud">
          <span class="ak__bokstav">{{ c.side }}</span>
          <span class="ak__huvud-text">
            <span class="ak__sida-namn">SIDA {{ c.side }}</span>
            <span v-if="c.other" class="ak__under">ANDRA SKÄRMEN</span>
            <span v-else-if="c.under" class="ak__under">{{ c.under }}</span>
          </span>
          <span v-if="c.mine" class="ak__har">STÅ HÄR</span>
        </header>
        <ol class="ak__namn">
          <li v-for="n in c.names" :key="n">
            <svg v-if="!c.other" class="ak__fig" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="7.5" r="4.2" />
              <path d="M3.5 22c0-5 3.8-8.2 8.5-8.2s8.5 3.2 8.5 8.2z" />
            </svg>
            <span>{{ n }}</span>
          </li>
          <li v-if="!c.names.length" class="ak__tom">—</li>
        </ol>
        <p v-if="c.other" class="ak__pil"><b>Står ditt namn här?</b>{{ pil(c.side) }}</p>
      </section>
    </main>

    <!-- 4. Vad gör vi nu? -->
    <footer class="ak__fot">
      <p class="ak__instr">
        Hitta ditt namn.
        <template v-if="egen"><em>Står det i den stora rutan?</em> Då är du rätt.</template>
        <template v-else>Ställ er på er sida.</template>
      </p>
      <button type="button" class="ak__cta" @click.stop="entre.start()">VI STÅR RÄTT ▸</button>
    </footer>
  </div>
</template>

<style scoped>
/* Sidfärgerna (spikade 2026-11-19): A varmvitt, B magenta — station-kit/ljus/kanon.ts SIDFARG.skarm. */
.ak {
  --sida-a: var(--entre-side-a, #fff1d6);
  --sida-b: var(--entre-side-b, #ff3cc8);
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: clamp(0.6rem, 2vh, 1.6rem);
  padding: clamp(0.6rem, 2.4vh, 1.6rem) clamp(0.8rem, 3vw, 3.5rem) clamp(0.6rem, 2vh, 1.4rem);
  cursor: pointer;
  overflow: hidden;
  color: var(--color-ink-strong);
}

/* Stationsbilden: svag remsa bakom rubriken, tonar ut mot botten. */
.ak__band {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: clamp(6rem, 22vh, 15rem);
  background-position: center 40%;
  background-size: cover;
  opacity: 0.5;
  -webkit-mask-image: linear-gradient(to bottom, #000 20%, transparent 100%);
  mask-image: linear-gradient(to bottom, #000 20%, transparent 100%);
  pointer-events: none;
}

/* ---------- 1. överst ---------- */
.ak__top {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 1.5rem;
}
.ak__lage {
  display: flex;
  align-items: center;
  gap: clamp(0.6rem, 1.2vw, 1.3rem);
  min-width: 0;
}
.ak__symbol {
  flex: none;
  width: clamp(3.2rem, 8.9vh, 6rem);
  height: auto;
}
.ak__lage-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.ak__lage-text b {
  font-family: var(--font-retro);
  font-weight: 400;
  font-size: clamp(1.6rem, 4.4vh, 3rem);
  line-height: 1;
  letter-spacing: 0.06em;
  color: var(--color-primary);
}
.ak__lage-text small {
  font-family: var(--font-mono);
  font-size: clamp(0.95rem, 2.6vh, 1.75rem);
  color: var(--color-ink-strong);
  opacity: 0.8;
  white-space: nowrap;
}
.ak__station {
  margin: 0;
  font-family: var(--font-retro);
  font-weight: 400;
  font-size: clamp(2.6rem, 11vh, 7.5rem);
  line-height: 1;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  text-align: center;
  white-space: nowrap;
  color: var(--color-ink-strong);
  text-shadow: 0 0 18px color-mix(in srgb, var(--color-primary) 35%, transparent);
}
.ak__grupp {
  margin: 0;
  justify-self: end;
  text-align: right;
  font-family: var(--font-mono);
  font-size: clamp(0.95rem, 2.6vh, 1.75rem);
  letter-spacing: 0.1em;
  line-height: 1.35;
  opacity: 0.8;
}

/* ---------- 2–3. sidorna ---------- */
.ak__sidor {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: clamp(1rem, 3vw, 3.75rem);
}
.ak__sida {
  --zone: var(--sida-a);
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: clamp(0.8rem, 3.1vh, 2.2rem) clamp(1rem, 2.4vw, 2.9rem);
  border: 4px solid var(--zone);
  border-radius: 24px;
  background: color-mix(in srgb, var(--zone) 5%, transparent);
}
.ak__sida--B {
  --zone: var(--sida-b);
}
/* Den här skärmens sida: bred, hel ram + glöd. Den andra: smal, streckad. A vänster, B höger. */
.ak__sida--egen {
  flex-grow: 1.9;
  border-width: 5px;
  box-shadow: 0 0 40px color-mix(in srgb, var(--zone) 30%, transparent);
}
.ak__sida--andra {
  border-style: dashed;
  border-color: color-mix(in srgb, var(--zone) 55%, transparent);
  background: transparent;
}

.ak__huvud {
  display: flex;
  align-items: center;
  gap: clamp(0.8rem, 1.5vw, 1.75rem);
  padding-bottom: clamp(0.5rem, 2vh, 1.4rem);
  border-bottom: 3px solid var(--zone);
}
.ak__sida--andra .ak__huvud {
  border-bottom: 0;
  padding-bottom: 0;
}
.ak__bokstav {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: clamp(3.4rem, 12vh, 8.1rem);
  height: clamp(3.4rem, 12vh, 8.1rem);
  border-radius: 18px;
  background: var(--zone);
  color: #0b0b0b;
  font-family: var(--font-retro);
  font-size: clamp(3rem, 11vh, 7.5rem);
  line-height: 1;
}
.ak__sida--andra .ak__bokstav {
  width: clamp(2.4rem, 7.2vh, 4.9rem);
  height: clamp(2.4rem, 7.2vh, 4.9rem);
  font-size: clamp(2rem, 6.6vh, 4.5rem);
  background: transparent;
  border: 3px solid color-mix(in srgb, var(--zone) 70%, transparent);
  color: color-mix(in srgb, var(--zone) 80%, #ffffff);
}
.ak__huvud-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.ak__sida-namn {
  font-family: var(--font-retro);
  font-size: clamp(2rem, 7vh, 4.75rem);
  line-height: 1;
  letter-spacing: 0.06em;
  color: var(--zone);
}
.ak__sida--andra .ak__sida-namn {
  font-size: clamp(1.4rem, 4.3vh, 2.9rem);
  color: color-mix(in srgb, var(--zone) 75%, #ffffff);
}
.ak__under {
  font-family: var(--font-mono);
  font-size: clamp(0.95rem, 2.6vh, 1.75rem);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.85;
}
.ak__har {
  margin-left: auto;
  flex: none;
  padding: 0.35em 0.8em;
  border-radius: 14px;
  background: var(--zone);
  color: #0b0b0b;
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: clamp(1.1rem, 3.1vh, 2.1rem);
  letter-spacing: 0.14em;
  white-space: nowrap;
  animation: ak-blink 0.36s steps(1) 0.8s 6;
}

.ak__namn {
  flex: 1;
  min-height: 0;
  list-style: none;
  margin: 0;
  padding: clamp(0.5rem, 2.4vh, 1.6rem) 0 0;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  gap: 0.3rem;
}
.ak__namn li {
  display: flex;
  align-items: center;
  gap: clamp(0.8rem, 1.6vw, 1.9rem);
  min-width: 0;
  font-family: var(--font-retro);
  font-size: clamp(2.4rem, 10.9vh, 7.4rem);
  line-height: 1.05;
  color: var(--color-ink-strong);
}
.ak__namn li span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ak--manga .ak__namn li {
  font-size: clamp(2rem, 8.2vh, 5.6rem);
}
.ak__fig {
  flex: none;
  width: 0.62em;
  height: 0.62em;
  fill: var(--zone);
}
.ak__sida--andra .ak__namn {
  flex: 0 1 auto;
  justify-content: flex-start;
  gap: clamp(0.2rem, 1vh, 0.7rem);
}
.ak__sida--andra .ak__namn li {
  font-size: clamp(1.6rem, 6.1vh, 4.1rem);
  color: color-mix(in srgb, var(--color-ink-strong) 72%, transparent);
}
.ak__tom {
  opacity: 0.5;
}
.ak__pil {
  margin: auto 0 0;
  font-family: var(--font-mono);
  font-size: clamp(1rem, 2.8vh, 1.9rem);
  line-height: 1.35;
  opacity: 0.9;
  animation: ak-nick 0.9s ease-in-out 2s 4;
}
.ak__pil b {
  display: block;
  color: color-mix(in srgb, var(--zone) 80%, #ffffff);
}
.ak__sida--A .ak__pil {
  --nick: -14px;
}
.ak__sida--B .ak__pil {
  --nick: 14px;
}

/* Delad vy (pilot, en skärm för båda): två lika rutor, ingen STÅ HÄR. */
.ak--delad .ak__namn li {
  font-size: clamp(2rem, 8.2vh, 5.6rem);
}

/* ---------- 4. foten ---------- */
.ak__fot {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}
.ak__instr {
  margin: 0;
  font-family: var(--font-mono);
  font-size: clamp(1.05rem, 3vh, 2rem);
  color: var(--color-ink-strong);
}
.ak__instr em {
  font-style: normal;
  color: var(--color-primary);
}
.ak__cta {
  flex: none;
  font-family: var(--font-retro);
  font-size: clamp(1.8rem, 5.6vh, 3.75rem);
  line-height: 1.15;
  letter-spacing: 0.06em;
  color: var(--color-primary);
  background: transparent;
  border: 4px solid var(--color-primary);
  border-radius: 16px;
  padding: 0.05em 0.7em;
  cursor: pointer;
  animation: ak-puls 2.4s ease-in-out infinite;
}

@keyframes ak-blink {
  50% {
    opacity: 0.35;
  }
}
@keyframes ak-nick {
  50% {
    transform: translateX(var(--nick, 14px));
  }
}
@keyframes ak-puls {
  50% {
    box-shadow: 0 0 30px color-mix(in srgb, var(--color-primary) 60%, transparent);
  }
}
@media (prefers-reduced-motion: reduce) {
  .ak__har,
  .ak__pil,
  .ak__cta {
    animation: none;
  }
}
/* Smal skärm: sidorna under varandra, rubriken utan sidokolumner. */
@media (max-width: 900px) {
  .ak__top {
    grid-template-columns: 1fr;
    justify-items: center;
  }
  .ak__grupp {
    justify-self: center;
    text-align: center;
  }
  .ak__station {
    white-space: normal;
  }
  .ak__sidor {
    flex-direction: column;
  }
  .ak__fot {
    flex-direction: column;
  }
}
</style>
