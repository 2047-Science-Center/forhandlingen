<script setup lang="ts">
/**
 * Lagidentitet — fast plats i UI:t: logga + lagnamn (LAG A/LAG B) och vilka
 * individer som har vilken roll. Rollval sker uppströms; här visas resultatet.
 * Ingen färgmarkering per lag — allt i bärnsten. Logga faller tillbaka till
 * bokstav (A/B) tills asset finns i public/teams/.
 */
import { ref, computed } from 'vue'
import type { TeamId, Person } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { useI18n } from '@/station-kit/i18n'

const props = defineProps<{ team: TeamId; compact?: boolean }>()
const store = useGameStore()
const { t } = useI18n()

const cfg = computed(() => store.teamConfig(props.team))
const members = computed(() => store.state.members[props.team])
const logoBroken = ref(false)

function byRole(role: 'A' | 'B'): Person[] {
  return members.value.filter((m) => m.assigned_role === role)
}
function nameOf(p: Person): string {
  return p.name ?? p.band_id
}
</script>

<template>
  <section class="tid" :class="{ 'tid--compact': compact }">
    <div class="tid__logo amber-frame">
      <img
        v-if="cfg.logo && !logoBroken"
        :src="cfg.logo"
        :alt="cfg.name"
        @error="logoBroken = true"
      />
      <span v-else class="tid__emoji">{{ cfg.emoji }}</span>
    </div>

    <div class="tid__body">
      <div class="tid__name">{{ store.teamName(team) }}</div>
      <div class="tid__roles">
        <div class="tid__role">
          <span class="tid__rolelabel">{{ t('role.A') }}</span>
          <span class="tid__names ink-strong">{{
            byRole('A').map(nameOf).join(', ') || '—'
          }}</span>
        </div>
        <div class="tid__role">
          <span class="tid__rolelabel">{{ t('role.B') }}</span>
          <span class="tid__names ink-strong">{{
            byRole('B').map(nameOf).join(', ') || '—'
          }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.tid {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}
.tid__logo {
  width: 3.4rem;
  height: 3.4rem;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-color: var(--color-primary);
  box-shadow: var(--glow-soft);
  overflow: hidden;
}
.tid__logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.tid__emoji {
  font-family: var(--font-retro);
  font-size: 2.1rem;
  font-weight: 700;
  line-height: 1;
  color: var(--color-ink-strong);
}
.tid__name {
  font-family: var(--font-retro);
  font-size: 1.8rem;
  color: var(--color-primary);
  text-shadow: var(--glow-soft);
  letter-spacing: 0.06em;
  line-height: 1.05;
}
.tid__roles {
  display: flex;
  gap: 1.2rem;
  margin-top: 0.15rem;
  flex-wrap: wrap;
}
.tid__role {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}
.tid__rolelabel {
  font-size: 0.8rem;
  color: var(--color-ink-muted);
  letter-spacing: 0.05em;
}
.tid__names {
  font-size: 1.05rem;
}
.tid--compact .tid__logo {
  width: 2.6rem;
  height: 2.6rem;
}
.tid--compact .tid__name {
  font-size: 1.35rem;
}
</style>
