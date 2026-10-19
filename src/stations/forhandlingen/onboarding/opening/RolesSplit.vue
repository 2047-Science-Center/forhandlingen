<script setup lang="ts">
/**
 * Steg 2 — "Vem gör vad" i EN split-screen-ruta: SÄNDEBUD (roll A) vs RAPPORTÖR
 * (roll B). Rollerna skiljs via IKON (central RoleIcon, två tydligt olika
 * silhuetter) + ETIKETT + POSITION — aldrig färg. Mikrofon-rollens tagg är
 * dessutom FYLLD mot rapportörens konturade (en extra form-skillnad). Samma
 * RoleIcon används konsekvent i hela appen.
 */
import { useI18n } from '@/station-kit/i18n'
import RoleIcon from '../../components/RoleIcon.vue'

const emit = defineEmits<{ next: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="rs">
    <h2 class="rs__title">{{ t('roles.split_title') }}</h2>
    <div class="rs__split">
      <!-- SÄNDEBUD (vänster) -->
      <div class="rs__col">
        <RoleIcon role="A" :size="88" />
        <span class="rs__role">{{ t('role.A') }}</span>
        <span class="rs__tag rs__tag--neg">{{ t('roles.has_mic') }}</span>
        <span class="rs__desc">{{ t('roles.diff_negotiator') }}</span>
      </div>
      <div class="rs__divider" aria-hidden="true" />
      <!-- RAPPORTÖR (höger) -->
      <div class="rs__col">
        <RoleIcon role="B" :size="88" />
        <span class="rs__role">{{ t('role.B') }}</span>
        <span class="rs__tag rs__tag--rep">{{ t('roles.has_console') }}</span>
        <span class="rs__desc">{{ t('roles.diff_reporter') }}</span>
      </div>
    </div>
    <p class="rs__sub">{{ t('roles.split_sub') }}</p>
    <button class="crt-button crt-button--strong rs__btn" @click="emit('next')">
      {{ t('onboarding.next') }} ▸
    </button>
  </div>
</template>

<style scoped>
.rs {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.6rem;
  text-align: center;
  padding: 1rem;
}
.rs__title {
  font-family: var(--font-retro);
  font-size: clamp(1.8rem, 4vw, 2.6rem);
  letter-spacing: 0.1em;
  color: var(--color-ink-strong);
  text-shadow: var(--glow-soft);
  margin: 0;
}
.rs__split {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: stretch;
  gap: 1.4rem;
  width: min(48rem, 96%);
}
.rs__col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 1.6rem 1rem;
  border-radius: 14px;
  background: var(--color-background-2);
  border: 2px solid var(--color-primary-dim);
}
.rs__divider {
  width: 2px;
  align-self: stretch;
  background: linear-gradient(to bottom, transparent, var(--color-primary-dim), transparent);
}
.rs__role {
  font-family: var(--font-retro);
  font-size: 1.8rem;
  letter-spacing: 0.06em;
  color: var(--color-ink-strong);
}
.rs__tag {
  font-family: var(--font-retro);
  font-size: 1rem;
  letter-spacing: 0.1em;
  padding: 0.15em 0.8em;
  border-radius: 999px;
}
/* Form-skillnad (ej färg): sändebud FYLLD, rapportör KONTURAD. */
.rs__tag--neg {
  color: var(--color-background);
  background: var(--color-primary);
  border: 1px solid var(--color-primary);
  font-weight: 600;
}
.rs__tag--rep {
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
}
.rs__desc {
  font-size: 1.1rem;
  line-height: 1.35;
  color: var(--color-ink-muted);
  max-width: 22ch;
}
.rs__sub {
  margin: 0;
  font-size: 1.2rem;
  color: var(--color-ink-strong);
  max-width: 44ch;
}
.rs__btn {
  font-size: 1.3rem;
  padding: 0.5em 2em;
}
@media (max-width: 640px) {
  .rs__split {
    grid-template-columns: 1fr;
  }
  .rs__divider {
    display: none;
  }
}
</style>
