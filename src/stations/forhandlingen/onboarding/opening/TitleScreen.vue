<script setup lang="ts">
/**
 * Öppningsskärm 1 — Titel ("förbilden"). Endast FÖRHANDLINGEN i profilen,
 * ingen ingress. CRT-boot-in. Tap var som helst → nästa. Självtempo per valv.
 */
import { onMounted } from 'vue'
import { useI18n } from '@/station-kit/i18n'
import { audio } from '@/station-kit/audio/AudioEngine'

const emit = defineEmits<{ next: [] }>()
const { t } = useI18n()

onMounted(() => audio.play('boot'))
</script>

<template>
  <button class="ts" @click="emit('next')" :aria-label="t('opening.tap_continue')">
    <h1 class="ts__title">{{ t('app.title') }}</h1>
    <span class="ts__hint crt-caret">{{ t('opening.tap_continue') }}</span>
  </button>
</template>

<style scoped>
.ts {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2.5rem;
  background: transparent;
  border: none;
  cursor: pointer;
  color: inherit;
}
.ts__title {
  font-family: var(--font-retro);
  font-size: clamp(2.6rem, 8vw, 5.5rem);
  letter-spacing: 0.08em;
  color: var(--color-ink-strong);
  text-shadow: var(--glow-strong, 0 0 18px var(--color-primary));
  margin: 0;
  animation: ts-boot 1.1s ease-out both;
}
.ts__hint {
  font-family: var(--font-retro);
  font-size: 1.2rem;
  color: var(--color-primary);
  opacity: 0.75;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  animation: ts-blink 1.8s ease-in-out infinite;
}
@keyframes ts-boot {
  0% { opacity: 0; letter-spacing: 0.5em; filter: blur(6px) brightness(2); }
  60% { opacity: 1; filter: blur(0) brightness(1.2); }
  100% { opacity: 1; letter-spacing: 0.08em; filter: none; }
}
@keyframes ts-blink {
  0%, 100% { opacity: 0.75; }
  50% { opacity: 0.25; }
}
@media (prefers-reduced-motion: reduce) {
  .ts__title { animation: none; }
  .ts__hint { animation: none; }
}
</style>
