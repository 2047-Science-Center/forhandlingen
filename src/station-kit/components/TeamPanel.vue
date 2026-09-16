<script setup lang="ts">
/**
 * Lag-panel: vilket lag som är inloggat just nu (namn + medlemmar), tydligt
 * och fast placerad. Fosfor-accent per lag (sparsam lagidentitet). Delas av
 * alla stationer.
 */
import { computed } from 'vue'
import type { TeamId, Person } from '@/stations/forhandlingen/engine/types'
import { useI18n } from '../i18n'

const props = defineProps<{
  team: TeamId
  label: string
  members: Person[]
  /** Extra live-värde att visa (t.ex. kapital) — valfritt. */
}>()

const { t } = useI18n()

const accent = computed(() =>
  props.team === 'lag1' ? 'var(--color-lag1)' : 'var(--color-lag2)',
)

function roleLabel(p: Person): string {
  return t(`role.${p.assigned_role}`)
}
</script>

<template>
  <section class="team-panel amber-frame" :style="{ '--accent': accent }">
    <header class="team-panel__head">
      <span class="team-panel__badge">{{ label }}</span>
    </header>
    <ul class="team-panel__members">
      <li v-for="p in members" :key="p.band_id">
        <span class="ink-strong">{{ p.band_id.replace(/^mock-band-/, '') }}</span>
        <span class="team-panel__role">{{ roleLabel(p) }}</span>
      </li>
      <li v-if="members.length === 0" class="team-panel__empty">—</li>
    </ul>
  </section>
</template>

<style scoped>
.team-panel {
  border-left: 4px solid var(--accent);
  padding: 0.6rem 0.9rem;
  min-width: 12rem;
}
.team-panel__badge {
  color: var(--accent);
  font-family: var(--font-retro);
  font-size: 1.3rem;
  letter-spacing: 0.05em;
  text-shadow: 0 0 6px var(--accent);
}
.team-panel__members {
  list-style: none;
  margin: 0.4rem 0 0;
  padding: 0;
  font-family: var(--font-retro);
  font-size: 1.1rem;
}
.team-panel__members li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
.team-panel__role {
  color: var(--color-ink-muted);
  font-size: 0.85em;
}
.team-panel__empty {
  color: var(--color-ink-muted);
}
</style>
