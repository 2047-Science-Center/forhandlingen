<script setup lang="ts">
/**
 * Diskret pilotpanel — FINNS EJ i skarpt läge. Välj dataset, byt vy, starta,
 * nollställ, auto-fyll lag. Fälld ihop som default.
 */
import { ref } from 'vue'
import { useGameStore, type ViewSide } from '../store/gameStore'
import { DATASETS, config } from '@/config'
import { useI18n } from '@/station-kit/i18n'

const store = useGameStore()
const { t } = useI18n()
const open = ref(false)

const views: ViewSide[] = ['lag1', 'lag2', 'shared']
</script>

<template>
  <div class="pilot" :class="{ 'pilot--open': open }">
    <button class="pilot__toggle" @click="open = !open" :title="t('pilot.title')">
      ⚙ {{ open ? '×' : t('pilot.title') }}
    </button>

    <div v-if="open" class="pilot__body">
      <label class="pilot__row">
        <span>{{ t('pilot.dataset') }}</span>
        <select v-model="store.selectedDataset" class="pilot__select mono">
          <option v-for="d in DATASETS" :key="d.id" :value="d.id">{{ d.id }}</option>
        </select>
      </label>

      <div class="pilot__row">
        <span>{{ t('pilot.timer') }}</span>
        <span class="mono">{{ config.negotiationSeconds ?? '∞' }} s/lucka</span>
      </div>

      <div class="pilot__row">
        <span>{{ t('pilot.view') }}</span>
        <div class="pilot__views">
          <button
            v-for="v in views"
            :key="v"
            class="crt-button pilot__viewbtn"
            :class="{ 'crt-button--strong': store.view === v }"
            @click="store.setView(v)"
          >
            {{ t('pilot.view.' + v) }}
          </button>
        </div>
      </div>

      <div class="pilot__actions">
        <button class="crt-button crt-button--strong" @click="store.startLive()">
          {{ t('pilot.start') }}
        </button>
        <button class="crt-button crt-button--danger" @click="store.reset()">
          {{ t('pilot.reset') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pilot {
  position: fixed;
  right: 0.75rem;
  bottom: 0.75rem;
  z-index: 100;
  font-family: var(--font-retro);
}
.pilot__toggle {
  font-family: var(--font-retro);
  background: var(--color-background-2);
  color: var(--color-primary);
  border: 1px solid var(--color-primary-dim);
  border-radius: 6px;
  padding: 0.3em 0.7em;
  cursor: pointer;
  font-size: 1rem;
  opacity: 0.7;
}
.pilot__toggle:hover {
  opacity: 1;
}
.pilot__body {
  margin-top: 0.5rem;
  background: var(--color-background-2);
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  padding: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 15rem;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
}
.pilot__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  color: var(--color-ink-muted);
}
.pilot__select {
  background: var(--color-background);
  color: var(--color-ink-strong);
  border: 1px solid var(--color-primary);
  border-radius: 5px;
  padding: 0.2em 0.4em;
}
.pilot__views {
  display: flex;
  gap: 0.3rem;
}
.pilot__viewbtn {
  font-size: 0.85rem;
  padding: 0.15em 0.5em;
}
.pilot__actions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.pilot__actions .crt-button {
  font-size: 0.9rem;
  padding: 0.2em 0.6em;
}
</style>
