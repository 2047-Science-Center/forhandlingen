<script setup lang="ts">
/**
 * Diskret facilitator-kontroll i ett hörn — finns i BÅDE pilot och drift (till
 * skillnad från PilotPanel). Två saker facilitatorn (Madde) behöver mitt i en
 * körning:
 *   - Paus: fryser nedräkningen och lägger paus-overlay på båda skärmarna.
 *   - Starta om: nollställer hela stationen (med bekräftelse mot råkade klick).
 * Ligger ovanför paus-overlayen så pausen alltid kan hävas.
 * Renodlat (Josef 2026-11-24): allt ligger bakom en diskret ⋯-knapp i hörnet, även ljudknappen.
 * Under paus visas knapparna alltid (annars går pausen inte att häva).
 */
import { ref } from 'vue'
import { useGameStore } from '../store/gameStore'
import { useI18n } from '@/station-kit/i18n'
import MuteButton from '@/station-kit/components/MuteButton.vue'

const store = useGameStore()
const { t } = useI18n()
/** '' = inga knappar bekräftas, annars vilken åtgärd som väntar på bekräftelse. */
const confirm = ref<'' | 'reset' | 'exit'>('')
const oppen = ref(false)

function doReset() {
  confirm.value = ''
  store.reset()
}
function doExit() {
  confirm.value = ''
  store.quitStation()
}
</script>

<template>
  <div class="facil">
    <div v-if="confirm === 'reset'" class="facil__confirm">
      <span class="facil__confirm-q">{{ t('facil.reset_confirm') }}</span>
      <div class="facil__confirm-row">
        <button class="crt-button crt-button--danger facil__btn" @click="doReset">{{ t('facil.reset_yes') }}</button>
        <button class="crt-button facil__btn" @click="confirm = ''">{{ t('facil.cancel') }}</button>
      </div>
    </div>
    <div v-else-if="confirm === 'exit'" class="facil__confirm">
      <span class="facil__confirm-q">{{ t('facil.exit_confirm') }}</span>
      <div class="facil__confirm-row">
        <button class="crt-button crt-button--danger facil__btn" @click="doExit">{{ t('facil.exit_yes') }}</button>
        <button class="crt-button facil__btn" @click="confirm = ''">{{ t('facil.cancel') }}</button>
      </div>
    </div>
    <button v-else-if="!oppen && !store.paused" class="facil__dold" aria-label="Facilitator" @click="oppen = true">⋯</button>
    <div v-else class="facil__row">
      <button v-if="!store.paused" class="crt-button facil__btn" @click="oppen = false">×</button>
      <MuteButton />
      <button class="crt-button facil__btn" :class="{ 'crt-button--strong': store.paused }" @click="store.togglePause()">
        {{ store.paused ? '▶ ' + t('facil.resume') : '⏸ ' + t('facil.pause') }}
      </button>
      <button class="crt-button facil__btn facil__reset" @click="confirm = 'reset'">⟲ {{ t('facil.reset') }}</button>
      <button class="crt-button facil__btn facil__reset" @click="confirm = 'exit'">✕ {{ t('facil.exit') }}</button>
    </div>
  </div>
</template>

<style scoped>
.facil__dold {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: transparent;
  color: rgba(255, 255, 255, 0.25);
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
}
.facil {
  position: fixed;
  left: 0.75rem;
  bottom: 0.75rem;
  z-index: 300; /* över paus-overlayen (200) */
  font-family: var(--font-retro);
}
.facil__row,
.facil__confirm-row {
  display: flex;
  gap: 0.4rem;
}
.facil__confirm {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  background: var(--color-background-2);
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  padding: 0.6rem;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
}
.facil__confirm-q {
  color: var(--color-ink-strong);
  font-size: 0.95rem;
}
.facil__btn {
  font-size: 0.9rem;
  padding: 0.25em 0.7em;
  opacity: 0.82;
}
.facil__btn:hover {
  opacity: 1;
}
.facil__reset {
  color: var(--color-ink-muted);
  border-color: var(--color-primary-dim);
}
</style>
