<script setup lang="ts">
/**
 * Resultat-popupar (modal över UI) efter test 2 och test 3, per valv.
 *  test2: (1) livsviktig säkrad/ej säkrad, (2) poäng = kvarvarande kapital
 *         (räknas ner från startkapitalet; 0 om ej säkrad).
 *  test3: (1) rätt/fel gissning, (2) totalpoäng (räknas upp till dubbla vid rätt
 *         gissning med bultande ×2).
 * Emit('finish') efter sista popupen.
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { TeamId } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { scoreTeam } from '../engine/scoring'
import { ALL_DATASETS } from '@/config'
import { useI18n } from '@/station-kit/i18n'

const props = defineProps<{ mode: 'test2' | 'test3'; team: TeamId }>()
const emit = defineEmits<{ finish: [] }>()
const { t } = useI18n()
const store = useGameStore()

const score = computed(() => scoreTeam(store.state, props.team))
const startKapital = computed(
  () => ALL_DATASETS.find((d) => d.id === store.state.datasetId)?.kapital ?? 60,
)

const i = ref(0)
const total = 2
function next() {
  if (i.value >= total - 1) emit('finish')
  else i.value += 1
}

// Animerad räknare.
const counter = ref(0)
let raf = 0
function animateTo(from: number, to: number, ms: number) {
  cancelAnimationFrame(raf)
  const start = performance.now()
  counter.value = from
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / ms)
    counter.value = Math.round(from + (to - from) * p)
    if (p < 1) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

const showX2 = ref(false)
function runPointsAnim() {
  showX2.value = false
  if (props.mode === 'test2') {
    // Räkna ner från startkapital till kvarvarande (poäng), om säkrad.
    if (score.value.securedCritical) animateTo(startKapital.value, score.value.capitalLeft, 1400)
    else counter.value = 0
  } else {
    // test3: räkna upp till dubbla vid rätt gissning.
    const base = score.value.securedCritical ? score.value.capitalLeft : 0
    if (score.value.guessedRight && score.value.securedCritical) {
      animateTo(base, base * 2, 1400)
      setTimeout(() => (showX2.value = true), 500)
    } else {
      counter.value = base
    }
  }
}

watch(i, (v) => {
  if (v === 1) runPointsAnim()
})
onMounted(() => {
  /* popup 1 är statisk */
})
onUnmounted(() => cancelAnimationFrame(raf))
</script>

<template>
  <div class="rp">
    <div class="rp__backdrop" />
    <div class="rp__card" :key="i">
      <!-- POPUP 1 -->
      <template v-if="i === 0">
        <template v-if="mode === 'test2'">
          <span class="rp__status" :class="score.securedCritical ? 'ok' : 'bad'">
            {{ score.securedCritical ? '✓' : '✗' }}
          </span>
          <p class="rp__title" :class="score.securedCritical ? 'ok' : 'bad'">
            {{ score.securedCritical ? t('res.secured') : t('res.not_secured') }}
          </p>
        </template>
        <template v-else>
          <span class="rp__status" :class="score.guessedRight ? 'ok' : 'bad'">
            {{ score.guessedRight ? '✓' : '✗' }}
          </span>
          <p class="rp__title" :class="score.guessedRight ? 'ok' : 'bad'">
            {{ score.guessedRight ? t('res.guess_right') : t('res.guess_wrong') }}
          </p>
        </template>
      </template>

      <!-- POPUP 2: poäng / totalpoäng -->
      <template v-else>
        <span class="rp__label">{{ mode === 'test2' ? t('res.points') : t('res.total') }}</span>

        <template v-if="mode === 'test2'">
          <template v-if="score.securedCritical">
            <div class="rp__count mono ink-strong">{{ counter }}<small> kr</small></div>
            <span class="rp__sub">{{ t('res.remaining_capital') }}</span>
            <p class="rp__big">{{ t('res.capital_is_points') }}</p>
          </template>
          <template v-else>
            <p class="rp__title bad">{{ t('res.not_secured_short') }}</p>
            <div class="rp__count mono ink-strong">{{ t('res.zero_points') }}</div>
          </template>
        </template>

        <template v-else>
          <div class="rp__countrow">
            <div class="rp__count mono ink-strong">{{ counter }}</div>
            <span v-if="showX2" class="rp__x2">×2</span>
          </div>
          <p v-if="score.guessedRight && score.securedCritical" class="rp__big">{{ t('res.double_copy') }}</p>
        </template>
      </template>

      <button class="crt-button crt-button--strong rp__btn" @click="next">{{ t('onboarding.next') }} ▸</button>
      <div class="rp__dots">
        <span v-for="n in total" :key="n" class="rp__dot" :class="{ 'rp__dot--now': n - 1 === i }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.rp { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 50; }
.rp__backdrop { position: absolute; inset: 0; background: rgba(5, 16, 11, 0.75); }
.rp__card {
  position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.7rem;
  text-align: center; max-width: 34ch; padding: 1.8rem 2rem;
  border: 2px solid var(--color-primary); border-radius: 14px; background: var(--color-background-2);
  box-shadow: 0 0 40px rgba(0,0,0,0.6), var(--frame-glow); animation: rp-in 0.35s ease-out;
}
@keyframes rp-in { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.rp__status { font-size: 3rem; line-height: 1; }
.rp__status.ok, .rp__title.ok { color: var(--color-ink-strong); }
.rp__status.bad, .rp__title.bad { color: var(--color-danger); }
.rp__title { margin: 0; font-size: 1.4rem; line-height: 1.35; }
.rp__label { font-size: 1.1rem; letter-spacing: 0.12em; color: var(--color-primary); }
.rp__count { font-size: 4.2rem; line-height: 1; text-shadow: var(--glow-strong); }
.rp__count small { font-size: 1.3rem; }
.rp__countrow { display: flex; align-items: center; gap: 0.8rem; }
.rp__x2 {
  font-family: var(--font-retro); font-size: 2.6rem; color: var(--color-danger);
  text-shadow: 0 0 14px var(--color-danger); animation: rp-x2 0.7s ease-in-out infinite;
}
@keyframes rp-x2 {
  0%, 100% { transform: scale(1); } 50% { transform: scale(1.35); }
}
.rp__sub { font-size: 0.9rem; color: var(--color-ink-muted); }
.rp__big { margin: 0.2rem 0 0; font-size: 1.3rem; color: var(--color-ink-strong); line-height: 1.35; }
.rp__btn { margin-top: 0.5rem; font-size: 1.15rem; }
.rp__dots { display: flex; gap: 0.5rem; }
.rp__dot { width: 0.55rem; height: 0.55rem; border-radius: 50%; border: 1px solid var(--color-primary-dim); }
.rp__dot--now { background: var(--color-primary); border-color: var(--color-primary); box-shadow: 0 0 8px var(--color-primary); }
@media (prefers-reduced-motion: reduce) { .rp__card, .rp__x2 { animation: none; } }
</style>
