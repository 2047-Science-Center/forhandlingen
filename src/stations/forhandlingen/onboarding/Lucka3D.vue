<script setup lang="ts">
/**
 * Instruktionens tredje steg: "Så går en lucka" i 3D (ersätter det gamla demoklippet med foton).
 * Scenen är Förhandlingens egen stationsmodell — samma värld som entréns "Så här blev det" —
 * och visar sändebuden som budar över väggen medan rapportörerna lyssnar
 * (public/entre/lucka-3d.html, kopia av intro-3d/scen3-ordvaxling med vendrad three).
 * Undertexten följer scenens 15 s-loop från det att den laddats.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from '@/station-kit/i18n'

defineProps<{ step: number; steps: number }>()
const emit = defineEmits<{ next: []; back: [] }>()
const { t } = useI18n()

const LOOP = 15
/** Undertextens takter (s in i loopen) — matchar talarbytena i scenens tidslinje. */
const TAKTER = [
  { at: 0, key: 'lucka3d.t1' },
  { at: 4.8, key: 'lucka3d.t2' },
  { at: 8.9, key: 'lucka3d.t3' },
  { at: 12.7, key: 'lucka3d.t4' },
]
const src = `${import.meta.env.BASE_URL}entre/lucka-3d.html`
const laddad = ref(false)
const t0 = ref(0)
const nu = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null
onMounted(() => (tick = setInterval(() => (nu.value = Date.now()), 200)))
onUnmounted(() => tick && clearInterval(tick))
function onLoad() {
  laddad.value = true
  t0.value = Date.now()
}
const takt = computed(() => {
  if (!laddad.value) return TAKTER[0]
  const s = ((nu.value - t0.value) / 1000) % LOOP
  return [...TAKTER].reverse().find((x) => s >= x.at) ?? TAKTER[0]
})
</script>

<template>
  <div class="l3">
    <p class="l3__rubrik">{{ t('lucka3d.title') }}</p>
    <div class="l3__scen">
      <iframe :src="src" class="l3__iframe" title="Så går en lucka" @load="onLoad" />
      <Transition name="l3-txt" mode="out-in">
        <p :key="takt.key" class="l3__text">{{ t(takt.key) }}</p>
      </Transition>
    </div>
    <div class="l3__nav">
      <button class="crt-button l3__btn l3__btn--back" @click="emit('back')">◂ {{ t('onboarding.back') }}</button>
      <div class="l3__dots">
        <span v-for="n in steps" :key="n" class="l3__dot" :class="{ 'l3__dot--now': n - 1 === step }" />
      </div>
      <button class="crt-button crt-button--strong l3__btn" @click="emit('next')">{{ t('onboarding.next') }} ▸</button>
    </div>
  </div>
</template>

<style scoped>
.l3 {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 0.4rem;
}
.l3__rubrik {
  margin: 0;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 2.2rem;
  letter-spacing: 0.04em;
  color: var(--color-primary);
  text-shadow: var(--glow-soft);
}
.l3__scen {
  position: relative;
  flex: 1;
  min-height: 0;
  border: 2px solid var(--color-primary-dim);
  border-radius: 12px;
  overflow: hidden;
  background: #141518;
}
.l3__iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}
.l3__text {
  position: absolute;
  left: 50%;
  bottom: 1.2rem;
  transform: translateX(-50%);
  width: min(90%, 46rem);
  margin: 0;
  padding: 0.5em 1em;
  text-align: center;
  font-family: var(--font-retro);
  font-size: 1.7rem;
  line-height: 1.2;
  color: var(--color-ink-strong);
  background: rgba(3, 12, 10, 0.82);
  border: 1px solid var(--color-primary-dim);
  border-radius: 10px;
}
.l3-txt-enter-active,
.l3-txt-leave-active {
  transition: opacity 180ms ease-out, filter 180ms ease-out;
}
.l3-txt-enter-from,
.l3-txt-leave-to {
  opacity: 0;
  filter: blur(4px);
}
.l3__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.l3__btn {
  font-size: 1.3rem;
  padding: 0.4em 1.4em;
}
.l3__dots {
  display: flex;
  gap: 0.6rem;
}
.l3__dot {
  width: 0.8rem;
  height: 0.8rem;
  border-radius: 50%;
  border: 2px solid var(--color-primary);
}
.l3__dot--now {
  background: var(--color-primary);
}
@media (prefers-reduced-motion: reduce) {
  .l3-txt-enter-active,
  .l3-txt-leave-active {
    transition: none;
  }
}
</style>
