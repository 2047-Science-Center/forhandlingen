<script setup lang="ts">
/**
 * Undertextlagret (station-kit, gemensamt i riggen): ritar raden som gäller vid `tid` ur
 * `rader` (overlay.json-format, XY-TEXTLAGER). Klockan ägs av den som spelar ljudet/klippet.
 * Placeras absolut i nederkant av närmaste positionerade förälder. Max 2 rader: plattan är 56ch bred,
 * så en rad i datan bör vara ≤ 110 tecken (dela längre repliker i flera rader).
 */
import { computed } from 'vue'
import { radVid, textPa, type Sprak, type UndertextRad } from './undertext'

const props = withDefaults(defineProps<{ rader: readonly UndertextRad[]; tid: number; sprak?: Sprak }>(), { sprak: 'sv' })

const rad = computed(() => radVid(props.rader, props.tid))
const text = computed(() => textPa(rad.value, props.sprak))
</script>

<template>
  <div class="ut" aria-live="polite">
    <Transition name="ut">
      <p v-if="text" :key="text" class="ut__rad">{{ text }}</p>
    </Transition>
  </div>
</template>

<style scoped>
.ut { position: absolute; left: 0; right: 0; bottom: clamp(1rem, 4vh, 2.6rem); display: flex; justify-content: center; padding: 0 clamp(1rem, 5vw, 4rem); pointer-events: none; z-index: 20; }
.ut__rad {
  margin: 0; max-width: min(56ch, 92vw); padding: 0.35em 0.8em; text-align: center; text-wrap: balance;
  font-family: var(--font-mono); font-size: clamp(1.3rem, 2.8vw, 2.1rem); line-height: 1.35; letter-spacing: 0.01em;
  color: var(--color-ink-strong); background: rgba(3, 8, 6, 0.78); border-radius: 8px;
  box-shadow: 0 0 0 1px rgba(var(--mode-accent-rgb), 0.25); text-shadow: var(--glow-soft);
}
.ut-enter-active { transition: opacity 140ms ease-out; }
.ut-leave-active { transition: opacity 100ms ease-in; position: absolute; }
.ut-enter-from, .ut-leave-to { opacity: 0; }
</style>
