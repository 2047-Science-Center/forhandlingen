<script setup lang="ts">
/**
 * "TA DITT BAND" (Lager A — IDENTISK i alla X&Y-stationer). Helskärm över stationen medan regi står i
 * fasen `incheckning`. Gruppen som börjar här, namnen per sida → "Alla har sina band på sig" →
 * station<N>/incheckad → "Vänta på de andra grupperna". Logik i incheckning.ts.
 */
import { computed } from 'vue'
import { useIncheckning } from './incheckning'
import type { SideId } from '../entre/types'

const props = withDefaults(defineProps<{ stationTitle: string; sideLabels?: Partial<Record<SideId, string>> }>(), {
  sideLabels: () => ({}),
})

const inch = useIncheckning()
const s = inch.state
const o = computed(() => inch.options())
const SIDES = ['A', 'B'] as const
const bandMode = computed(() => !o.value.bandlost)
const klara = computed(() => inch.klaraStationer.value.length)
</script>

<template>
  <div v-if="inch.visible.value" class="ic" role="dialog" aria-label="Incheckning">
    <section v-for="side in SIDES" :key="side" class="ic__col" :class="`ic__col--${side}`" :style="{ order: side === 'A' ? 0 : 2 }">
      <header class="ic__head">
        <span class="ic__letter">{{ side }}</span>
        <span class="ic__head-text">
          <span class="ic__sida">SIDA {{ side }}</span>
          <span v-if="props.sideLabels[side]" class="ic__label">{{ props.sideLabels[side] }}</span>
        </span>
      </header>
      <ol class="ic__names">
        <li
          v-for="m in inch.namnPaSida(side)"
          :key="m.band_id"
          class="ic__name"
          :class="{ 'ic__name--ok': bandMode && s.bippade[m.band_id] }"
        >
          <span v-if="bandMode" class="ic__tick" aria-hidden="true">{{ s.bippade[m.band_id] ? '✓' : '·' }}</span>{{ m.name }}
        </li>
        <li v-if="!inch.namnPaSida(side).length" class="ic__name ic__name--empty">—</li>
      </ol>
    </section>

    <section class="ic__mid" :style="{ order: 1 }">
      <p class="ic__group">{{ s.group != null ? `Testgrupp ${s.group}` : 'Gruppen som börjar här' }} · {{ props.stationTitle }}</p>
      <template v-if="!inch.kvitterad.value">
        <h1 class="ic__title ink-strong">TA DITT BAND</h1>
        <p class="ic__hint">Leta upp ditt namn och ta på dig ditt band.</p>
        <p v-if="!s.members.length" class="ic__muted">Namnen kommer när gruppen är incheckad.</p>
        <button type="button" class="crt-button crt-button--strong ic__cta" :disabled="!inch.kanKvittera.value" @click="inch.kvittera()">
          Alla har sina band på sig ▸
        </button>
        <p v-if="bandMode && o.kravBipp && !inch.allaBippat.value" class="ic__muted">Bippa banden på läsaren först.</p>
      </template>
      <template v-else>
        <p class="ic__ok" aria-hidden="true">✓</p>
        <h1 class="ic__title ink-strong">KLART!</h1>
        <p class="ic__hint">Vänta på de andra grupperna.</p>
        <p class="ic__progress">
          <span v-for="i in o.antalStationer" :key="i" class="ic__pip" :class="{ 'ic__pip--on': i <= klara }" />
          <span class="ic__muted">{{ klara }} av {{ o.antalStationer }} grupper klara</span>
        </p>
      </template>
    </section>
  </div>
</template>

<style scoped>
.ic {
  position: fixed;
  inset: 0;
  z-index: 520; /* över rotationens skärmar (500), under filmerna */
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr) minmax(0, 1fr);
  gap: clamp(0.5rem, 1.6vw, 1.4rem);
  padding: clamp(0.6rem, 1.6vw, 1.4rem);
  background: var(--color-background, #0b0d0a);
}
.ic__col {
  --zone: var(--entre-side-a, #fff1d6);
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: clamp(0.5rem, 1.2vw, 1rem);
  border: 3px solid var(--zone);
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.35);
}
.ic__col--B {
  --zone: var(--entre-side-b, #ff3cc8);
}
.ic__head {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding-bottom: 0.6rem;
  border-bottom: 2px solid var(--zone);
}
.ic__letter {
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
.ic__head-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.ic__sida {
  font-family: var(--font-retro, monospace);
  font-size: clamp(1.2rem, 2.4vw, 1.9rem);
  letter-spacing: 0.08em;
  color: var(--color-ink-strong);
}
.ic__label {
  font-size: clamp(0.95rem, 1.6vw, 1.3rem);
  color: var(--color-ink-muted);
}
.ic__names {
  flex: 1;
  list-style: none;
  margin: 0;
  padding: 0.7rem 0 0;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  gap: 0.4rem;
}
.ic__name {
  display: flex;
  align-items: baseline;
  gap: 0.4em;
  font-family: var(--font-retro, monospace);
  font-size: clamp(1.9rem, 4.6vw, 3.6rem);
  line-height: 1.1;
  color: var(--color-ink-strong);
  overflow-wrap: anywhere;
}
.ic__name--ok {
  color: var(--zone);
}
.ic__name--empty {
  color: var(--color-ink-muted);
}
.ic__tick {
  width: 1em;
  font-size: 0.7em;
}
.ic__mid {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(0.6rem, 1.6vw, 1.2rem);
  text-align: center;
  min-width: 0;
}
.ic__group {
  margin: 0;
  font-size: clamp(1rem, 1.8vw, 1.4rem);
  letter-spacing: 0.06em;
  color: var(--color-primary);
}
.ic__title {
  margin: 0;
  font-size: clamp(2rem, 5vw, 4.4rem);
  letter-spacing: 0.06em;
  line-height: 1.05;
}
.ic__hint {
  margin: 0;
  font-size: clamp(1.1rem, 2.2vw, 1.8rem);
  color: var(--color-ink-strong);
}
.ic__muted {
  margin: 0;
  font-size: clamp(0.95rem, 1.6vw, 1.25rem);
  color: var(--color-ink-muted);
}
.ic__cta {
  font-size: clamp(1.1rem, 2.2vw, 1.8rem);
  padding: 0.55em 1.4em;
}
.ic__cta:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.ic__ok {
  margin: 0;
  font-size: clamp(3rem, 8vw, 6rem);
  line-height: 1;
  color: var(--color-primary);
}
.ic__progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
}
.ic__pip {
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  border: 2px solid var(--color-primary-dim, #555);
}
.ic__pip--on {
  background: var(--color-primary);
  border-color: var(--color-primary);
}
@media (max-width: 760px) {
  .ic {
    grid-template-columns: 1fr 1fr;
    overflow: auto;
  }
  .ic__mid {
    grid-column: 1 / -1;
    order: -1 !important;
  }
}
</style>
