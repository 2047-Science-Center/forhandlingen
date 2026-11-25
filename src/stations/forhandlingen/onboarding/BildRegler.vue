<script setup lang="ts">
/**
 * Instruktionens tre regler som BILD med tre ord var (UTVARDERING-BILD-ANIMATION.md):
 *   1 Måste ha       — er vara med LIVSVIKTIG-tagg och puls; utan den blir det 0.
 *   2 Kvar = poäng   — mynt försvinner vid köp, resten blir poäng.
 *   3 Rätt gissning  — ett av motståndarens kort vänds: ×2.
 * Alla tre syns hela tiden; den aktiva lyser och spelar sin lilla animation. NÄSTA och TILLBAKA.
 */
import { useI18n } from '@/station-kit/i18n'
import VaraBild from '../components/VaraBild.vue'

defineProps<{ aktiv: number; steg: number; antal: number; vara: string; motVara: string }>()
const emit = defineEmits<{ next: []; back: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="br">
    <div class="br__paneler">
      <!-- 1 · Måste ha -->
      <section class="br__panel" :class="{ 'br__panel--aktiv': aktiv === 0 }">
        <span class="br__nr">1</span>
        <div class="br__bild br__bild--livs">
          <span class="br__kort"><VaraBild :vara="vara" :size="120" /></span>
          <span class="br__tagg">{{ t('critical.tagg') }}</span>
          <svg class="br__puls" viewBox="0 0 300 50" aria-hidden="true"><path d="M0 25 H90 L105 5 L120 45 L135 25 H170 L185 5 L200 45 L215 25 H300" /></svg>
          <span class="br__noll">0</span>
        </div>
        <p class="br__ord">{{ t('regel.1') }}</p>
      </section>

      <!-- 2 · Kvar = poäng -->
      <section class="br__panel" :class="{ 'br__panel--aktiv': aktiv === 1 }">
        <span class="br__nr">2</span>
        <div class="br__bild br__bild--mynt">
          <span class="br__stapel"><i v-for="n in 10" :key="n" :style="{ bottom: `${(n - 1) * 9}px`, '--i': n }" :class="{ 'br__ut': n > 4 }" /></span>
          <span class="br__poang">40<small> p</small></span>
        </div>
        <p class="br__ord">{{ t('regel.2') }}</p>
      </section>

      <!-- 3 · Rätt gissning ×2 -->
      <section class="br__panel" :class="{ 'br__panel--aktiv': aktiv === 2 }">
        <span class="br__nr">3</span>
        <div class="br__bild br__bild--gissa">
          <span class="br__rad">
            <i v-for="n in 5" :key="n" class="br__gk" :class="{ 'br__gk--vand': n === 3 }">
              <span v-if="n === 3" class="br__gk-fram"><VaraBild :vara="motVara" :size="40" /></span>
            </i>
          </span>
          <span class="br__x2">×2</span>
        </div>
        <p class="br__ord">{{ t('regel.3') }}</p>
      </section>
    </div>

    <div class="br__nav">
      <button class="crt-button br__btn br__btn--back" :disabled="steg === 0" @click="emit('back')">◂ {{ t('onboarding.back') }}</button>
      <div class="br__dots"><span v-for="n in antal" :key="n" class="br__dot" :class="{ 'br__dot--now': n - 1 === steg }" /></div>
      <button class="crt-button crt-button--strong br__btn" @click="emit('next')">{{ t('onboarding.next') }} ▸</button>
    </div>
  </div>
</template>

<style scoped>
.br {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.6rem 0.4rem 0.2rem;
}
.br__paneler {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}
.br__panel {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 0.6rem 0.8rem;
  border: 2px solid var(--color-primary-dim);
  border-radius: 18px;
  background: rgba(var(--mode-accent-rgb), 0.04);
  opacity: 0.4;
  transition: opacity 300ms, border-color 300ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
}
.br__panel--aktiv {
  opacity: 1;
  border-color: var(--color-primary);
  box-shadow: 0 0 28px rgba(var(--mode-accent-rgb), 0.3);
  transform: translateY(-4px);
}
.br__nr {
  position: absolute;
  left: 0.9rem;
  top: 0.5rem;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 1.8rem;
  color: var(--color-primary-dim);
}
.br__bild {
  position: relative;
  flex: 1;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.br__ord {
  margin: 0;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 2.2rem;
  color: var(--color-primary);
  text-align: center;
}
/* Animationerna spelar bara i den aktiva panelen */
.br__panel:not(.br__panel--aktiv) * {
  animation-play-state: paused !important;
}

/* 1 · livsviktig */
.br__kort {
  padding: 0.6rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  box-shadow: 0 0 24px rgba(255, 90, 60, 0.35);
  animation: br-kort 4s ease-in-out infinite;
}
.br__tagg {
  position: absolute;
  top: 12%;
  left: 18%;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 1.2rem;
  color: #fff;
  background: var(--color-danger);
  padding: 0.05em 0.5em;
  border-radius: 6px;
  transform: rotate(-8deg);
}
.br__puls {
  position: absolute;
  bottom: 6%;
  width: 80%;
  fill: none;
  stroke: var(--color-danger);
  stroke-width: 4;
  stroke-dasharray: 420;
  animation: br-puls 4s linear infinite;
}
.br__noll {
  position: absolute;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 7rem;
  color: var(--color-danger);
  opacity: 0;
  animation: br-noll 4s ease-in infinite;
}
@keyframes br-kort { 0%, 45% { opacity: 1; } 60%, 90% { opacity: 0.2; } 100% { opacity: 1; } }
@keyframes br-puls { 0% { stroke-dashoffset: 420; } 45%, 100% { stroke-dashoffset: 0; } }
@keyframes br-noll { 0%, 50% { opacity: 0; transform: scale(1.6); } 56%, 90% { opacity: 1; transform: scale(1); } 100% { opacity: 0; } }

/* 2 · mynt → poäng */
.br__stapel {
  position: relative;
  width: 90px;
  height: 120px;
}
.br__stapel i {
  position: absolute;
  left: 0;
  width: 90px;
  height: 26px;
  border-radius: 50%;
  background: radial-gradient(ellipse at 40% 35%, #ffe08a, #d79a1c 70%, #8a5b07);
  border: 2px solid #6b4504;
}
.br__ut {
  animation: br-ut 4s cubic-bezier(0.55, 0, 1, 0.45) infinite;
  animation-delay: calc((10 - var(--i)) * 0.15s);
}
.br__poang {
  position: absolute;
  bottom: 4%;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 3.2rem;
  color: var(--color-ink-strong);
  opacity: 0;
  animation: br-poang 4s ease-out infinite;
}
.br__poang small { font-size: 1.6rem; color: var(--color-primary); }
@keyframes br-ut { 0%, 20% { transform: none; opacity: 1; } 40%, 92% { transform: translateY(-90px); opacity: 0; } 100% { transform: none; opacity: 1; } }
@keyframes br-poang { 0%, 55% { opacity: 0; transform: scale(1.3); } 65%, 92% { opacity: 1; transform: scale(1); } 100% { opacity: 0; } }

/* 3 · gissa ×2 */
.br__rad {
  display: flex;
  gap: 0.4rem;
}
.br__gk {
  position: relative;
  width: 46px;
  height: 66px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--color-primary-dim), #0f3a36);
  border: 2px solid var(--color-primary);
}
.br__gk--vand {
  animation: br-vand 4s ease-in-out infinite;
}
.br__gk-fram {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e9f3f1;
  border-radius: 6px;
  opacity: 0;
  animation: br-fram 4s step-end infinite;
}
.br__x2 {
  position: absolute;
  bottom: 4%;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 4.4rem;
  color: #ff3cc8;
  opacity: 0;
  animation: br-x2 4s ease-in infinite;
}
@keyframes br-vand { 0%, 25% { transform: scaleX(1) translateY(0); } 32% { transform: scaleX(0); } 40%, 92% { transform: scaleX(1) translateY(-10px); border-color: #ff3cc8; } 100% { transform: none; } }
@keyframes br-fram { 0% { opacity: 0; } 32% { opacity: 1; } 96% { opacity: 0; } }
@keyframes br-x2 { 0%, 48% { opacity: 0; transform: scale(2); } 54%, 92% { opacity: 1; transform: scale(1); } 100% { opacity: 0; } }

.br__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.br__btn {
  font-size: 1.3rem;
  padding: 0.4em 1.4em;
}
.br__btn:disabled {
  visibility: hidden;
}
.br__dots { display: flex; gap: 0.6rem; }
.br__dot { width: 0.8rem; height: 0.8rem; border-radius: 50%; border: 2px solid var(--color-primary); }
.br__dot--now { background: var(--color-primary); }
@media (prefers-reduced-motion: reduce) {
  .br__panel * { animation: none !important; }
  .br__noll, .br__poang, .br__x2 { opacity: 1; }
}
</style>
