<script setup lang="ts">
/**
 * Bipp-start (kit): "bippa ditt band" i början av en station. Presentationell —
 * föräldern kopplar identitets-lyssnaren och vad som händer vid bipp/skip.
 *
 * ALLTID klick-igenom: knappen (och Enter/mellanslag) hoppar över utan hårdvara
 * → mock-identitet. Får `identifiedName` när en riktig bipp kommit in → växlar
 * till en kort bekräftelse. Följer CRT-standarden (station-kit-tema).
 */
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { useI18n } from '@/station-kit/i18n'

const props = defineProps<{
  /** Satt när en riktig identitet kommit in (via bipp) → bekräftelse-läge. */
  identifiedName?: string | null
}>()
const emit = defineEmits<{ skip: [] }>()
const { t } = useI18n()

const mounted = ref(false)
const identified = computed(() => !!props.identifiedName)

function skip() {
  emit('skip')
}
function onKey(e: KeyboardEvent) {
  if (identified.value) return
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    skip()
  }
}

onMounted(() => {
  requestAnimationFrame(() => (mounted.value = true))
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="bipp" :data-mounted="mounted" :data-identified="identified">
    <!-- Läsar-glyf: band-kort + pulserande vågor (väntar), bock (identifierad) -->
    <div class="bipp__reader" aria-hidden="true">
      <span class="bipp__wave bipp__wave--1"></span>
      <span class="bipp__wave bipp__wave--2"></span>
      <span class="bipp__wave bipp__wave--3"></span>
      <svg class="bipp__card" viewBox="0 0 64 64" width="72" height="72">
        <rect x="12" y="18" width="40" height="28" rx="4" fill="none"
              stroke="currentColor" stroke-width="2.5" />
        <circle cx="24" cy="32" r="4" fill="currentColor" />
        <path d="M32 26c4 0 7 3 7 6s-3 6-7 6" fill="none"
              stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
        <path class="bipp__check" d="M22 32l7 7 13-14" fill="none"
              stroke="currentColor" stroke-width="3.5"
              stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>

    <p class="bipp__title ink-strong">
      {{ identified ? t('bipp.identified', { name: props.identifiedName }) : t('bipp.title') }}
    </p>
    <p class="bipp__hint">{{ identified ? t('bipp.ok') : t('bipp.hint') }}</p>

    <button v-if="!identified" class="crt-button crt-button--strong bipp__skip" @click="skip">
      {{ t('bipp.skip') }}
    </button>
  </div>
</template>

<style scoped>
.bipp {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.3rem;
  text-align: center;
  /* Mjuk entré (emil: aldrig från scale(0); starta nära slutläget). */
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 240ms var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1)),
    transform 240ms var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1));
}
.bipp[data-mounted='true'] {
  opacity: 1;
  transform: translateY(0);
}

.bipp__reader {
  position: relative;
  width: 140px;
  height: 140px;
  display: grid;
  place-items: center;
  color: var(--color-primary);
}
.bipp__card {
  position: relative;
  z-index: 1;
  filter: drop-shadow(0 0 10px var(--color-primary));
}
.bipp__check {
  opacity: 0;
  transition: opacity 180ms var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1));
}
.bipp[data-identified='true'] .bipp__check {
  opacity: 1;
}
/* Göm kort-symbolens innehåll när vi bekräftar, visa bara bocken + ram */
.bipp[data-identified='true'] .bipp__card > circle,
.bipp[data-identified='true'] .bipp__card > path:not(.bipp__check) {
  opacity: 0;
  transition: opacity 180ms ease;
}

/* Vågor: pulserar utåt medan vi väntar (state-indikator, ej dekor) */
.bipp__wave {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 90px;
  height: 90px;
  border: 2px solid var(--color-primary);
  border-radius: 18px;
  opacity: 0;
  transform: scale(0.8);
  animation: bipp-wave 2.4s var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1)) infinite;
}
.bipp__wave--2 {
  animation-delay: 0.8s;
}
.bipp__wave--3 {
  animation-delay: 1.6s;
}
.bipp[data-identified='true'] .bipp__wave {
  animation: none;
  opacity: 0;
}
@keyframes bipp-wave {
  0% {
    opacity: 0.55;
    transform: scale(0.75);
  }
  80% {
    opacity: 0;
    transform: scale(1.5);
  }
  100% {
    opacity: 0;
    transform: scale(1.5);
  }
}

.bipp__title {
  font-family: var(--font-retro);
  font-size: 2rem;
  letter-spacing: 0.08em;
  margin: 0;
  color: var(--color-ink-strong);
}
.bipp__hint {
  font-family: var(--font-retro);
  font-size: 1.25rem;
  color: var(--color-ink-muted);
  margin: 0;
}
.bipp__skip {
  margin-top: 0.6rem;
}

@media (prefers-reduced-motion: reduce) {
  .bipp {
    transition: opacity 240ms ease;
    transform: none;
  }
  .bipp__wave {
    animation: none;
    opacity: 0.25;
  }
}
</style>
