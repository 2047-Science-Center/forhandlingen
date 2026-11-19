<script setup lang="ts">
/**
 * "STÄLL ER PÅ RÄTT SIDA" (Lager A — IDENTISK i alla X&Y-stationer) = entréns attract, TREDELAD:
 *
 *   ┌ SIDA A · Labb ┬──── UNDERSÖKNINGEN ────┬ SIDA B · Fält ┐
 *   │  Alma         │  Testgrupp 2 · runda 1 │  Fredrik      │
 *   │  Noah         │      [3D: sidorna]     │  Wilma        │
 *   │  Sigge        │ Ställ er på rätt sida  │  Ebba         │
 *   └───────────────┴─ [ Vi står rätt ▸ ]  ──┴───────────────┘
 *
 * entre-v2 (Josef 2026-11-19): ersätter förskärmen + ankomst-steget (samma information två gånger).
 * Tryck var som helst (sin sida eller knappen) → stationsintrot → rollvalet. Varje skärm startar sig själv.
 *
 * Eleven letar upp sitt namn: kolumnen säger sidan, mitten säger stationen. Två skärmar per station:
 * båda kolumnerna syns på båda, den egna sidan i full styrka och den andra dämpad ("andra sidan").
 * Design: xy-arkitektur/XY-BANDLOST-OCH-ANKOMST.md §2.2. Startsidorna = entréns voteSides
 * (klasslistans `halva`, annars seedad indelning — samma vid alla stationer).
 */
import { computed, ref, watch } from 'vue'
import { useRotation } from '../rotation/rotation'
import { useEntre } from './entre'
import type { SideId } from './types'

const props = withDefaults(defineProps<{ /** 3D-bilden (xy-entre-3d, lage=ankomst); tom = utan. */ illuSrc?: string }>(), {
  illuSrc: '',
})

const entre = useEntre()
const s = entre.state
const rotation = useRotation()
const rot = rotation.state
/** Startspärren (regi före rotationen, SOM.md): visa sidorna men ingen startknapp. */
const locked = rotation.startLocked
const cfg = computed(() => entre.config())

const SIDES = ['A', 'B'] as const
const columns = computed(() =>
  SIDES.map((side) => ({
    side,
    label: cfg.value.sides?.[side]?.label ?? '',
    names: entre.members.value.filter((m) => entre.voteSides.value[m.band_id] === side).map((m) => m.name),
    mine: s.screenSide === side,
    dim: s.screenSide != null && s.screenSide !== side,
  })),
)
const groupLine = computed(() =>
  rot.group != null && rot.phase !== 'off' ? `Testgrupp ${rot.group} · runda ${rot.round}` : 'Pilotgrupp',
)
/** Stationens attract-bild bakom vyn (config.attractBild), med mörk slöja så namnen syns. */
/**
 * Attract-bilden (config.attractBild) bakom vyn, med HyperFrames-förslagets toning (xy-produktion/attract/kontaktark.html):
 * mörka ytterkanter under namnkolumnerna + mörka band upptill/nedtill + scanlines. Bilden visas BARA om den faktiskt
 * laddas (saknad fil → ingen bild; Vite/statisk server svarar annars index.html med 200).
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
const bildStil = computed(() =>
  bildOk.value && cfg.value.attractBild ? { '--ak-bild': `url("${cfg.value.attractBild}")` } : undefined,
)
const otherHint = (side: SideId) => (side === 'A' ? '◀ andra sidan' : 'andra sidan ▶')
</script>

<template>
  <div class="ak" :class="{ 'ak--bild': bildStil, 'ak--locked': locked }" :style="bildStil" role="button" tabindex="0" @click="entre.start()" @keydown.enter="entre.start()">
    <section
      v-for="c in columns"
      :key="c.side"
      class="ak__col"
      :class="[`ak__col--${c.side}`, { 'ak__col--mine': c.mine, 'ak__col--dim': c.dim }]"
      :style="{ order: c.side === 'A' ? 0 : 2 }"
    >
      <header class="ak__head">
        <span class="ak__letter">{{ c.side }}</span>
        <span class="ak__head-text">
          <span class="ak__sida">SIDA {{ c.side }}</span>
          <span v-if="c.label" class="ak__label">{{ c.label }}</span>
        </span>
      </header>
      <ol class="ak__names">
        <li v-for="n in c.names" :key="n" class="ak__name">{{ n }}</li>
        <li v-if="!c.names.length" class="ak__name ak__name--empty">—</li>
      </ol>
      <p v-if="c.dim" class="ak__other">{{ otherHint(c.side) }}</p>
      <p v-else-if="c.mine" class="ak__here">Här</p>
    </section>

    <section class="ak__mid" :style="{ order: 1 }">
      <p class="ak__group">{{ groupLine }}<span v-if="rot.manual"> · manuellt vald</span></p>
      <h1 class="ak__station ink-strong">{{ cfg.stationTitle }}</h1>
      <iframe v-if="props.illuSrc" :src="props.illuSrc" class="ak__illu" title="Era sidor" tabindex="-1" />
      <p class="ak__hint ink-strong">Ställ er på rätt sida</p>
      <p class="ak__sub">Leta upp ditt namn.</p>
      <p v-if="locked" class="ak__wait" role="status">Titta på den stora skärmen – vi börjar snart</p>
      <button v-else type="button" class="crt-button crt-button--strong ak__cta" @click.stop="entre.start()">Vi står rätt ▸</button>
    </section>
  </div>
</template>

<style scoped>
.ak {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr) minmax(0, 1fr);
  gap: clamp(0.5rem, 1.6vw, 1.4rem);
  padding: clamp(0.4rem, 1.2vw, 1rem);
  cursor: pointer;
}
.ak--locked {
  cursor: default;
}
.ak--bild {
  border-radius: 12px;
  background:
    repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0.18) 0 2px, transparent 2px 4px),
    linear-gradient(to right, rgba(0, 0, 0, 0.72) 0%, rgba(0, 0, 0, 0.25) 30%, rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, 0) 60%, rgba(0, 0, 0, 0.25) 70%, rgba(0, 0, 0, 0.72) 100%),
    linear-gradient(to bottom, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0) 28%, rgba(0, 0, 0, 0) 70%, rgba(0, 0, 0, 0.6) 100%),
    var(--ak-bild) center / cover no-repeat;
}
/* Sidfärgerna (spikade 2026-11-19): A varmvitt, B magenta — station-kit/ljus/kanon.ts SIDFARG.skarm. */
.ak__col {
  --zone: var(--entre-side-a, #fff1d6);
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: clamp(0.5rem, 1.2vw, 1rem);
  border: 3px solid var(--zone);
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.35);
  transition: opacity 0.3s ease, filter 0.3s ease;
}
.ak__col--B {
  --zone: var(--entre-side-b, #ff3cc8);
}
.ak__col--dim {
  opacity: 0.45;
  filter: saturate(0.6);
  border-style: dashed;
}
.ak__col--mine {
  box-shadow: 0 0 0 3px var(--zone), 0 0 28px color-mix(in srgb, var(--zone) 45%, transparent);
}
.ak__head {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding-bottom: 0.6rem;
  border-bottom: 2px solid var(--zone);
}
.ak__letter {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 1.6em;
  border-radius: 10px;
  background: var(--zone);
  color: #0b0b0b;
  font-family: var(--font-retro, monospace);
  font-size: clamp(2.2rem, 5vw, 3.8rem);
  font-weight: 700;
  line-height: 1.1;
}
.ak__head-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.ak__sida {
  font-family: var(--font-retro, monospace);
  font-size: clamp(1.2rem, 2.4vw, 1.9rem);
  letter-spacing: 0.08em;
  color: var(--color-ink-strong);
}
.ak__label {
  font-size: clamp(0.95rem, 1.6vw, 1.3rem);
  color: var(--color-ink-muted);
  overflow-wrap: anywhere;
}
.ak__names {
  flex: 1;
  list-style: none;
  margin: 0;
  padding: 0.7rem 0 0;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  gap: 0.4rem;
}
.ak__name {
  font-family: var(--font-retro, monospace);
  font-size: clamp(1.9rem, 4.6vw, 3.6rem);
  line-height: 1.1;
  letter-spacing: 0.03em;
  color: var(--color-ink-strong);
  overflow-wrap: anywhere;
}
.ak__name--empty {
  color: var(--color-ink-muted);
}
.ak__other,
.ak__here {
  margin: 0.4rem 0 0;
  font-size: clamp(1rem, 1.8vw, 1.4rem);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.ak__other {
  color: var(--color-ink-muted);
}
.ak__here {
  color: var(--zone);
}
.ak__mid {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(0.6rem, 1.6vw, 1.3rem);
  text-align: center;
  min-width: 0;
}
.ak__group {
  margin: 0;
  font-size: clamp(1rem, 1.8vw, 1.4rem);
  letter-spacing: 0.06em;
  color: var(--color-primary);
}
.ak__station {
  margin: 0;
  max-width: 100%;
  font-size: clamp(1.4rem, 3.4vw, 4.2rem);
  letter-spacing: 0.04em;
  line-height: 1.05;
  overflow-wrap: break-word;
  hyphens: auto;
}
.ak__illu {
  flex: 1;
  width: 100%;
  min-height: 0;
  max-height: 46vh;
  border: 0;
  pointer-events: none; /* trycket går till vyn (start), inte till 3D-sidan */
}
.ak__hint {
  margin: 0;
  font-size: clamp(1.4rem, 3vw, 2.6rem);
  letter-spacing: 0.04em;
}
.ak__sub {
  margin: 0;
  font-size: clamp(1rem, 1.8vw, 1.4rem);
  color: var(--color-ink-muted);
}
.ak__wait {
  margin: 0;
  font-size: clamp(1.1rem, 2.2vw, 1.8rem);
  letter-spacing: 0.03em;
  color: var(--color-ink-muted);
}
.ak__cta {
  font-size: clamp(1.1rem, 2.2vw, 1.8rem);
  padding: 0.5em 1.4em;
  animation: ak-pulse 2.4s ease-in-out infinite;
}
@keyframes ak-pulse {
  50% {
    box-shadow: 0 0 22px color-mix(in srgb, var(--color-primary) 55%, transparent);
  }
}
@media (prefers-reduced-motion: reduce) {
  .ak__cta {
    animation: none;
  }
}
@media (max-width: 760px) {
  .ak {
    grid-template-columns: 1fr 1fr;
  }
  .ak__mid {
    grid-column: 1 / -1;
    order: -1 !important;
  }
}
</style>
