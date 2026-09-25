<script setup lang="ts">
/** Varning strax före automatisk idle-återstart. Rör skärmen → avbryts. */
import { useI18n } from '@/station-kit/i18n'
defineProps<{ seconds: number }>()
const { t } = useI18n()
</script>

<template>
  <div class="idle" role="status" aria-live="polite">
    <div class="idle__card">
      <p class="idle__text">{{ t('idle.restart_in') }}</p>
      <div class="idle__count mono">{{ t('idle.seconds', { n: seconds }) }}</div>
      <p class="idle__hint crt-caret">{{ t('idle.tap_to_stay') }}</p>
    </div>
  </div>
</template>

<style scoped>
.idle {
  position: fixed;
  inset: 0;
  z-index: 250;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(3, 12, 8, 0.88);
}
.idle__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
  padding: 2rem 2.6rem;
  border: 1px solid var(--color-primary);
  border-radius: 14px;
  background: var(--color-background-2);
  box-shadow: var(--glow-soft, 0 0 24px rgba(255, 149, 0, 0.25));
}
.idle__text {
  font-family: var(--font-retro);
  font-size: 1.3rem;
  color: var(--color-ink-strong);
  text-align: center;
  margin: 0;
}
.idle__count {
  font-size: 3rem;
  color: var(--color-primary);
  text-shadow: 0 0 16px var(--color-primary);
}
.idle__hint {
  font-family: var(--font-retro);
  font-size: 1.1rem;
  color: var(--color-primary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
</style>
