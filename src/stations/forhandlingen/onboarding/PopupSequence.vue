<script setup lang="ts">
/**
 * Klick-igenom-popupar som MODAL över grund-UI:t (testernas intro-popupar).
 * Varje popup kan ha titel, en illustration (emoji-ikon eller resurs), text
 * och/eller ett belopp som "flyger upp till kapitalet". Emit('finish') efter sista.
 */
import { ref } from 'vue'
import { resourceIcon } from '../resources'
import { useI18n } from '@/station-kit/i18n'

export interface PopupSpec {
  title?: string
  body?: string
  /** Emoji-ikon som illustrerar budskapet. */
  icon?: string
  /** Resurs-id → visa resurs-ikon + namn. */
  resource?: string
  /** Belopp (kr) → visas stort och flyger upp mot kapitalet. */
  money?: number
}

const props = defineProps<{ popups: PopupSpec[] }>()
const emit = defineEmits<{ finish: [] }>()
const { t } = useI18n()

const i = ref(0)
const cur = () => props.popups[i.value]
const last = () => i.value >= props.popups.length - 1

function next() {
  if (last()) emit('finish')
  else i.value += 1
}
</script>

<template>
  <div class="ps">
    <div class="ps__backdrop" />
    <div class="ps__card" :key="i">
      <span v-if="cur().icon" class="ps__bigicon">{{ cur().icon }}</span>
      <span v-if="cur().title" class="ps__title">{{ cur().title }}</span>
      <div v-if="cur().resource" class="ps__res">
        <span class="ps__icon">{{ resourceIcon(cur().resource!) }}</span>
        <span class="ps__name ink-strong">{{ t('resource.' + cur().resource) }}</span>
      </div>
      <template v-if="cur().money != null">
        <div class="ps__money mono ink-strong">{{ cur().money }}<small> kr</small></div>
        <span class="ps__coin mono" aria-hidden="true">🪙 {{ cur().money }} kr</span>
        <span class="ps__point">⤒ {{ t('reveal.money_here') }}</span>
      </template>
      <p v-if="cur().body" class="ps__body">{{ cur().body }}</p>
      <button class="crt-button crt-button--strong ps__btn" @click="next">{{ t('onboarding.next') }} ▸</button>
      <div class="ps__dots">
        <span v-for="n in popups.length" :key="n" class="ps__dot" :class="{ 'ps__dot--now': n - 1 === i }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ps {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.ps__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(5, 16, 11, 0.72);
}
.ps__card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.7rem;
  text-align: center;
  max-width: 34ch;
  padding: 1.6rem 1.8rem;
  border: 2px solid var(--color-primary);
  border-radius: 14px;
  background: var(--color-background-2);
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.6), var(--frame-glow);
  animation: ps-in 0.35s ease-out;
}
@keyframes ps-in {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.ps__bigicon { font-size: 3.4rem; line-height: 1; }
.ps__title { font-size: 1.5rem; color: var(--color-ink-strong); line-height: 1.3; }
.ps__res { display: flex; align-items: center; gap: 0.7rem; }
.ps__icon { font-size: 3rem; line-height: 1; }
.ps__name { font-size: 2.4rem; }
.ps__money { font-size: 3.6rem; line-height: 1; text-shadow: var(--glow-strong); }
.ps__money small { font-size: 1.2rem; }
.ps__coin { font-size: 1.2rem; color: var(--color-primary); animation: ps-coin 1.6s ease-in infinite; }
@keyframes ps-coin {
  0% { transform: translateY(0); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: translateY(-40vh); opacity: 0; }
}
.ps__point { font-size: 0.85rem; color: var(--color-ink-muted); }
.ps__body { margin: 0; font-size: 1.15rem; color: var(--color-ink-muted); line-height: 1.4; }
.ps__btn { margin-top: 0.4rem; font-size: 1.15rem; }
.ps__dots { display: flex; gap: 0.5rem; margin-top: 0.2rem; }
.ps__dot { width: 0.55rem; height: 0.55rem; border-radius: 50%; border: 1px solid var(--color-primary-dim); }
.ps__dot--now { background: var(--color-primary); border-color: var(--color-primary); box-shadow: 0 0 8px var(--color-primary); }
@media (prefers-reduced-motion: reduce) {
  .ps__card, .ps__coin { animation: none; }
}
</style>
