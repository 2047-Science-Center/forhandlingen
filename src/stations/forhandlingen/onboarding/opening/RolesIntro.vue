<script setup lang="ts">
/**
 * Öppningsskärm — ROLLERNA (rolltydlighet var svagast i testomgång 1).
 * Visas i FÖRSTA genomklicket, efter deltagarna och INNAN rapportören agerar.
 * Tre klick-igenom-steg, självtempo per valv:
 *   1) "Ställ er rätt": rapportör till vänster, sändebud till höger.
 *   2) "Vem gör vad?": skillnaden STORT + varför bara en har mikrofon.
 *   3) "Så går en budgivning till": bud → neka/höj → fram och tillbaka → lås in
 *      (textstöd/struktur; introklippet kan bytas senare).
 *
 * Rollerna färgmarkeras via --role-negotiator / --role-reporter (egna tokens,
 * förberedda för att matcha de fysiska headseten). Gruppstorlek antas aldrig —
 * vyn beskriver rollerna, inte individerna, så den funkar oavsett antal.
 */
import { ref } from 'vue'
import { useI18n } from '@/station-kit/i18n'

const emit = defineEmits<{ next: [] }>()
const { t } = useI18n()

const step = ref<0 | 1 | 2>(0)
function next() {
  if (step.value >= 2) emit('next')
  else step.value++
}

const bidFlow = [
  'roles.example_bid',
  'roles.example_counter',
  'roles.example_back',
  'roles.example_lock',
]
</script>

<template>
  <div class="ri">
    <!-- STEG 1: Ställ er rätt (rapportör vänster, sändebud höger) -->
    <section v-if="step === 0" class="ri__scene" :key="0">
      <h2 class="ri__title">{{ t('roles.stand_title') }}</h2>
      <div class="ri__stand">
        <div class="ri__card ri__card--reporter">
          <span class="ri__icon">🖥️</span>
          <span class="ri__rolename">{{ t('role.B') }}</span>
          <span class="ri__tag ri__tag--reporter">{{ t('roles.has_console') }}</span>
          <span class="ri__sub">{{ t('roles.stand_reporter') }}</span>
        </div>
        <div class="ri__card ri__card--negotiator">
          <span class="ri__icon">🎙️</span>
          <span class="ri__rolename">{{ t('role.A') }}</span>
          <span class="ri__tag ri__tag--negotiator">{{ t('roles.has_mic') }}</span>
          <span class="ri__sub">{{ t('roles.stand_negotiator') }}</span>
        </div>
      </div>
      <p class="ri__note">{{ t('roles.stand_sub') }}</p>
    </section>

    <!-- STEG 2: Vem gör vad + varför bara en mikrofon -->
    <section v-else-if="step === 1" class="ri__scene" :key="1">
      <h2 class="ri__title">{{ t('roles.diff_title') }}</h2>
      <div class="ri__diff">
        <div class="ri__row ri__row--negotiator">
          <span class="ri__rowicon">🎧</span>
          <div class="ri__rowbody">
            <span class="ri__rolename ri__rolename--neg">{{ t('role.A') }}</span>
            <span class="ri__rowtext">{{ t('roles.diff_negotiator') }}</span>
          </div>
        </div>
        <div class="ri__row ri__row--reporter">
          <span class="ri__rowicon">👂</span>
          <div class="ri__rowbody">
            <span class="ri__rolename ri__rolename--rep">{{ t('role.B') }}</span>
            <span class="ri__rowtext">{{ t('roles.diff_reporter') }}</span>
          </div>
        </div>
      </div>
      <div class="ri__why">
        <span class="ri__why-title">{{ t('roles.why_mic_title') }}</span>
        <span class="ri__why-text">{{ t('roles.why_mic') }}</span>
      </div>
    </section>

    <!-- STEG 3: Budgivningsexempel (bud → neka/höj → fram/tillbaka → lås) -->
    <section v-else class="ri__scene" :key="2">
      <h2 class="ri__title">{{ t('roles.example_title') }}</h2>
      <ol class="ri__flow">
        <li v-for="(k, i) in bidFlow" :key="k" class="ri__flowitem">
          <span class="ri__flownum">{{ i + 1 }}</span>
          <span class="ri__flowtext">{{ t(k) }}</span>
        </li>
      </ol>
    </section>

    <button class="crt-button crt-button--strong ri__btn" @click="next">
      {{ t('onboarding.next') }} ▸
    </button>
    <div class="ri__dots">
      <span v-for="n in 3" :key="n" class="ri__dot" :class="{ 'ri__dot--now': n - 1 === step }" />
    </div>
  </div>
</template>

<style scoped>
.ri {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.4rem;
  text-align: center;
  padding: 1rem;
}
.ri__scene {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.3rem;
  width: 100%;
  animation: ri-in 0.3s ease-out;
}
@keyframes ri-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}
.ri__title {
  font-family: var(--font-retro);
  font-size: clamp(1.8rem, 4vw, 2.6rem);
  letter-spacing: 0.1em;
  color: var(--color-ink-strong);
  text-shadow: var(--glow-soft);
  margin: 0;
}
/* Steg 1: ställ er rätt */
.ri__stand {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.4rem;
  width: min(44rem, 94%);
}
.ri__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.4rem 1rem;
  border-radius: 12px;
  background: var(--color-background-2);
  border: 2px solid var(--color-primary-dim);
}
.ri__card--reporter { border-color: var(--role-reporter); box-shadow: 0 0 20px rgba(var(--role-reporter-rgb), 0.3); }
.ri__card--negotiator { border-color: var(--role-negotiator); box-shadow: 0 0 20px rgba(var(--role-negotiator-rgb), 0.3); }
.ri__icon { font-size: 2.8rem; line-height: 1; }
.ri__rolename {
  font-family: var(--font-retro);
  font-size: 1.7rem;
  letter-spacing: 0.06em;
  color: var(--color-ink-strong);
}
.ri__tag {
  font-family: var(--font-retro);
  font-size: 0.95rem;
  letter-spacing: 0.1em;
  padding: 0.15em 0.7em;
  border-radius: 999px;
}
.ri__tag--reporter { color: var(--role-reporter); border: 1px solid var(--role-reporter); }
.ri__tag--negotiator { color: var(--role-negotiator); border: 1px solid var(--role-negotiator); }
.ri__sub { font-size: 1.05rem; color: var(--color-ink-muted); }
.ri__note {
  margin: 0;
  font-size: 1.15rem;
  color: var(--color-ink-muted);
  max-width: 40ch;
}
/* Steg 2: vem gör vad */
.ri__diff {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: min(46rem, 96%);
}
.ri__row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.2rem;
  border-radius: 12px;
  background: var(--color-background-2);
  border-left: 5px solid var(--color-primary-dim);
  text-align: left;
}
.ri__row--negotiator { border-left-color: var(--role-negotiator); }
.ri__row--reporter { border-left-color: var(--role-reporter); }
.ri__rowicon { font-size: 2.4rem; line-height: 1; flex: none; }
.ri__rowbody { display: flex; flex-direction: column; gap: 0.2rem; }
.ri__rolename--neg { color: var(--role-negotiator); font-size: 1.4rem; }
.ri__rolename--rep { color: var(--role-reporter); font-size: 1.4rem; }
.ri__rowtext { font-size: 1.25rem; color: var(--color-ink-strong); line-height: 1.3; }
.ri__why {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 1rem 1.4rem;
  border-radius: 12px;
  border: 2px dashed var(--color-primary);
  background: var(--color-background-2);
  width: min(46rem, 96%);
}
.ri__why-title {
  font-family: var(--font-retro);
  font-size: 1.3rem;
  color: var(--color-primary);
  letter-spacing: 0.04em;
}
.ri__why-text { font-size: 1.2rem; color: var(--color-ink-strong); line-height: 1.4; }
/* Steg 3: budgivningsflöde */
.ri__flow {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  width: min(42rem, 94%);
}
.ri__flowitem {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.8rem 1.1rem;
  border-radius: 10px;
  background: var(--color-background-2);
  border: 1px solid var(--color-primary-dim);
  text-align: left;
}
.ri__flownum {
  flex: none;
  width: 2.1rem;
  height: 2.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 2px solid var(--color-primary);
  color: var(--color-primary);
  font-family: var(--font-retro);
  font-size: 1.3rem;
}
.ri__flowtext { font-size: 1.25rem; color: var(--color-ink-strong); }
/* Knapp + dots */
.ri__btn { font-size: 1.3rem; padding: 0.5em 2em; }
.ri__dots { display: flex; gap: 0.5rem; }
.ri__dot { width: 0.6rem; height: 0.6rem; border-radius: 50%; border: 1px solid var(--color-primary); }
.ri__dot--now { background: var(--color-primary); box-shadow: 0 0 8px var(--color-primary); }
@media (max-width: 640px) {
  .ri__stand { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .ri__scene { animation: none; }
}
</style>
