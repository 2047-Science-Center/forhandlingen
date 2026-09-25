<script setup lang="ts">
/**
 * Öppningsskärm 2 — Deltagare (splitscreen på Bild 5). Valv Syd (vänster) och
 * Valv Nord (höger) med orange rubrik + Deltagare-ruta (3 mockupnamn, data-
 * drivet — kommer från RFID-inloggningen i drift). Det EGNA valvet framhävs
 * (ljusare/ramat), det andra dämpas, så var och en ser vilken sida de tillhör.
 * Tap var som helst → nästa. Självtempo per valv (ingen sync här).
 */
import type { TeamId } from '../../engine/types'
import { TEAM_PARTICIPANTS, INTRO_MEDIA } from '@/config'
import { useI18n } from '@/station-kit/i18n'

const props = defineProps<{ me: TeamId | null }>()
const emit = defineEmits<{ next: [] }>()
const { t } = useI18n()

const bg = INTRO_MEDIA.photo(5)
// Vänster = Valv Syd (lag1), höger = Valv Nord (lag2).
const sides: { id: TeamId; label: string }[] = [
  { id: 'lag1', label: 'VALV SYD' },
  { id: 'lag2', label: 'VALV NORD' },
]
const participants = (id: TeamId) => TEAM_PARTICIPANTS[id]
// I delad vy (me === null) framhävs ingetdera.
const isMine = (id: TeamId) => props.me == null || props.me === id
</script>

<template>
  <button class="pt" @click="emit('next')" :style="{ backgroundImage: `url('${bg}')` }">
    <div class="pt__scrim" />
    <div class="pt__sides">
      <div
        v-for="s in sides"
        :key="s.id"
        class="pt__side"
        :class="{ 'pt__side--mine': isMine(s.id), 'pt__side--dim': !isMine(s.id) }"
      >
        <span class="pt__valv">{{ s.label }}</span>
        <div class="pt__card amber-frame">
          <span class="pt__card-title">{{ t('opening.participants') }}</span>
          <ul class="pt__names">
            <li v-for="(name, i) in participants(s.id)" :key="i" class="pt__name ink-strong">{{ name }}</li>
          </ul>
        </div>
      </div>
    </div>
    <p class="pt__market">{{ t('opening.market') }}</p>
    <span class="pt__start crt-caret">{{ t('opening.tap_start') }} ▸</span>
  </button>
</template>

<style scoped>
.pt {
  position: relative;
  height: 100%;
  width: 100%;
  border: none;
  cursor: pointer;
  color: inherit;
  background-size: cover;
  background-position: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}
.pt__scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(3, 12, 8, 0.55), rgba(3, 12, 8, 0.75));
}
.pt__sides {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  padding: 2rem clamp(1rem, 4vw, 4rem);
}
.pt__side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.1rem;
  transition: opacity 0.4s ease, transform 0.4s ease;
}
.pt__side--mine {
  opacity: 1;
}
.pt__side--dim {
  opacity: 0.4;
  transform: scale(0.95);
  filter: saturate(0.6);
}
.pt__valv {
  font-family: var(--font-retro);
  font-size: clamp(1.8rem, 4vw, 3rem);
  letter-spacing: 0.1em;
  color: var(--color-primary);
  text-shadow: 0 0 14px var(--color-primary);
}
.pt__side--mine .pt__valv {
  color: var(--color-ink-strong);
}
.pt__card {
  min-width: min(20rem, 80%);
  padding: 1rem 1.4rem;
  border-radius: 10px;
  background: rgba(5, 16, 11, 0.7);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  align-items: center;
}
.pt__side--mine .pt__card {
  box-shadow: 0 0 22px rgba(255, 149, 0, 0.35);
  background: rgba(12, 26, 18, 0.82);
}
.pt__card-title {
  font-family: var(--font-retro);
  font-size: 1rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-primary);
  opacity: 0.85;
}
.pt__names {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  align-items: center;
}
.pt__name {
  font-family: var(--font-retro);
  font-size: clamp(1.2rem, 2.4vw, 1.8rem);
  letter-spacing: 0.04em;
}
.pt__market {
  position: relative;
  align-self: center;
  max-width: 46rem;
  margin: 1.6rem auto 0;
  padding: 0 1rem;
  text-align: center;
  font-family: var(--font-retro);
  font-size: clamp(1rem, 2vw, 1.25rem);
  line-height: 1.4;
  color: var(--color-ink-strong);
}
.pt__start {
  position: relative;
  align-self: center;
  margin-top: 1rem;
  font-family: var(--font-retro);
  font-size: 1.4rem;
  color: var(--color-ink-strong);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  animation: pt-blink 1.8s ease-in-out infinite;
}
@keyframes pt-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
@media (prefers-reduced-motion: reduce) {
  .pt__start { animation: none; }
  .pt__side { transition: none; }
}
</style>
