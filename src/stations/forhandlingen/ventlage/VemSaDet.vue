<script setup lang="ts">
/**
 * F1 "Vem sa det?" — Förhandlingens väntläge (vad gruppen gör när den blivit
 * klar och väntar på att de andra valven ska bli klara).
 *
 * En person läser en maskerad rad; resten gissar vem genom att trycka på ett
 * namn (EN gemensam gruppgissning). Loopbar hur många gånger som helst tills
 * det är dags att byta valv → "TILL START" (emit exit → attract).
 *
 * Lek, inte prov: alltid synlig "NI ÄR KLARA — väntar"-banner + "LEK FRITT ·
 * räknas inte"-tagg + lugn amber-idle-puls (skärm-motsvarighet till HatchRow).
 * Palett: endast orange (primär) + mint (positivt) — status via ikon/etikett,
 * aldrig via nya färger.
 */
import { computed } from 'vue'
import { useI18n } from '@/station-kit/i18n'
import { checkedInParticipants } from '@/config'
import Teletype from '@/station-kit/components/Teletype.vue'
import { useVemSaDet } from './vemSaDet'

const emit = defineEmits<{ exit: [] }>()
const { t } = useI18n()

const game = useVemSaDet(checkedInParticipants())

/** Mint-puls-rad (skärm-idle, HatchRow-mönstret) — en prick per deltagare. */
const idlePips = computed(() => game.participants.value.map((_, i) => i))

function toStart() {
  emit('exit')
}
</script>

<template>
  <div class="vem">
    <!-- Alltid synlig status: klara + väntar + "räknas inte" -->
    <header class="vem__status">
      <p class="vem__banner ink-strong" role="status">{{ t('vem.ready_banner') }}</p>
      <div class="vem__status-row">
        <span class="vem__playtag">{{ t('vem.playtag') }}</span>
        <!-- Lugn amber-idle-puls (skärm-LED à la HatchRow) -->
        <span class="vem__pips" aria-hidden="true">
          <span v-for="i in idlePips" :key="i" class="vem__pip" :style="{ animationDelay: `${i * 0.18}s` }" />
        </span>
      </div>
    </header>

    <!-- Attract: vad leken är + starta -->
    <section v-if="game.phase.value === 'attract'" class="vem__panel vem__center">
      <h1 class="vem__title">{{ t('vem.title') }}</h1>
      <p class="vem__sub">{{ t('vem.subtitle') }}</p>
      <button class="crt-button crt-button--strong vem__cta" @click="game.begin()">{{ t('vem.start') }}</button>
    </section>

    <!-- Läsar-val: den som läser tar turen (pilot: tryck eget namn; drift: bipp) -->
    <section v-else-if="game.phase.value === 'reader'" class="vem__panel">
      <p class="vem__round mono">{{ t('vem.round_of', { n: game.roundNumber.value, total: game.totalRounds.value }) }}</p>
      <p class="vem__instruction ink-strong">{{ t('vem.reader_instruction') }}</p>
      <p class="vem__prompt">{{ t('vem.reader_pick') }}</p>
      <p class="vem__hint">{{ t('vem.reader_pick_hint') }}</p>
      <div class="vem__names">
        <button
          v-for="name in game.participants.value"
          :key="name"
          class="crt-button vem__name"
          :disabled="!game.availableReaders.value.includes(name)"
          @click="game.identifyReader(name)"
        >
          <span v-if="!game.availableReaders.value.includes(name)" class="vem__name-done" aria-hidden="true">✓</span>
          {{ name }}
        </button>
      </div>
    </section>

    <!-- Läsning: visa raden (döljer läsarens namn tills reveal) -->
    <section v-else-if="game.phase.value === 'read'" class="vem__panel vem__center">
      <p class="vem__read-label">{{ t('vem.read_now') }}</p>
      <div class="vem__line amber-frame">
        <Teletype :text="game.currentLine.value" :speed="30" />
      </div>
      <button class="crt-button crt-button--strong vem__cta" @click="game.readingDone()">{{ t('vem.read_done') }}</button>
    </section>

    <!-- Gissning: EN gemensam gruppgissning -->
    <section v-else-if="game.phase.value === 'guess'" class="vem__panel vem__center">
      <p class="vem__prompt ink-strong">{{ t('vem.guess_prompt') }}</p>
      <p class="vem__hint">{{ t('vem.guess_hint') }}</p>
      <div class="vem__names">
        <button
          v-for="name in game.participants.value"
          :key="name"
          class="crt-button vem__name"
          @click="game.submitGuess(name)"
        >
          {{ name }}
        </button>
      </div>
    </section>

    <!-- Reveal: rätt/fel + vem det var + er gissning -->
    <section v-else-if="game.phase.value === 'reveal'" class="vem__panel vem__center">
      <div class="vem__verdict" :class="game.lastCorrect.value ? 'vem__verdict--ok' : 'vem__verdict--no'">
        <span class="vem__verdict-icon" aria-hidden="true">{{ game.lastCorrect.value ? '✓' : '✗' }}</span>
        <span class="vem__verdict-text">{{ game.lastCorrect.value ? t('vem.correct') : t('vem.wrong') }}</span>
      </div>
      <p class="vem__it-was ink-strong">{{ t('vem.it_was', { name: game.currentReader.value }) }}</p>
      <p class="vem__guessed">{{ t('vem.you_guessed', { name: game.lastGuess.value }) }}</p>
      <button class="crt-button crt-button--strong vem__cta" @click="game.next()">
        {{ game.availableReaders.value.length === 0 ? t('vem.to_result') : t('vem.next') }}
      </button>
    </section>

    <!-- Resultat: X av N + per-runda-lista; loopa eller till start -->
    <section v-else-if="game.phase.value === 'result'" class="vem__panel">
      <h2 class="vem__title">{{ t('vem.result_title') }}</h2>
      <p class="vem__score ink-strong">{{ t('vem.result_score', { correct: game.score.value.correct, total: game.score.value.total }) }}</p>
      <ol class="vem__list">
        <li v-for="(r, i) in game.rounds.value" :key="i" class="vem__list-row" :class="{ 'vem__list-row--ok': r.correct }">
          <span class="vem__list-icon" aria-hidden="true">{{ r.correct ? '✓' : '✗' }}</span>
          <span class="vem__list-line">"{{ r.line }}"</span>
          <span class="vem__list-meta mono">
            {{ t('vem.col_reader') }}: <strong>{{ r.reader }}</strong>
            · {{ t('vem.col_guess') }}: {{ r.guess }}
          </span>
        </li>
      </ol>
      <div class="vem__result-actions">
        <button class="crt-button crt-button--strong" @click="game.playAgain()">{{ t('vem.play_again') }}</button>
        <button class="crt-button" @click="toStart">{{ t('vem.to_start') }}</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.vem {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
}

/* --- Status (alltid synlig) --- */
.vem__status {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}
.vem__banner {
  font-family: var(--font-retro);
  font-size: 1.5rem;
  letter-spacing: 0.1em;
  text-align: center;
  margin: 0;
}
.vem__status-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}
.vem__playtag {
  font-family: var(--font-retro);
  font-size: 1rem;
  letter-spacing: 0.14em;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: 999px;
  padding: 0.15em 0.9em;
  box-shadow: var(--glow-soft);
}
.vem__pips {
  display: inline-flex;
  gap: 0.45rem;
  align-items: center;
}
.vem__pip {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  background: var(--color-primary);
  box-shadow: 0 0 8px var(--color-primary);
  animation: vem-idle 2.4s ease-in-out infinite;
}
@keyframes vem-idle {
  0%, 100% { opacity: 0.25; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1.1); }
}

/* --- Paneler --- */
.vem__panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  overflow: auto;
}
.vem__center {
  align-items: center;
  justify-content: center;
  text-align: center;
}
.vem__title {
  font-family: var(--font-retro);
  font-size: 2.6rem;
  letter-spacing: 0.08em;
  color: var(--color-primary);
  margin: 0;
}
.vem__sub,
.vem__hint {
  font-family: var(--font-retro);
  color: var(--color-ink-muted);
  margin: 0;
}
.vem__sub { font-size: 1.3rem; }
.vem__hint { font-size: 1.1rem; }
.vem__round {
  color: var(--color-ink-muted);
  letter-spacing: 0.1em;
}
.vem__instruction {
  font-family: var(--font-retro);
  font-size: 1.5rem;
  margin: 0;
}
.vem__prompt {
  font-family: var(--font-retro);
  font-size: 1.6rem;
  margin: 0;
}
.vem__cta {
  font-size: 1.5rem;
  margin-top: 0.4rem;
}

/* --- Namn-knappar --- */
.vem__names {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  justify-content: center;
}
.vem__name {
  font-size: 1.5rem;
  min-width: 7rem;
  padding: 0.6em 1.1em;
}
.vem__name-done {
  color: var(--color-lag1);
  margin-right: 0.3em;
}

/* --- Läsning --- */
.vem__read-label {
  font-family: var(--font-retro);
  font-size: 1.3rem;
  color: var(--color-ink-muted);
  margin: 0;
}
.vem__line {
  padding: 1.4rem 1.8rem;
  max-width: 44ch;
}
.vem__line :deep(.teletype) {
  font-size: 2rem;
  color: var(--color-ink-strong);
}

/* --- Reveal --- */
.vem__verdict {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-family: var(--font-retro);
  font-size: 2.4rem;
  letter-spacing: 0.08em;
}
.vem__verdict--ok { color: var(--color-lag1); }
.vem__verdict--no { color: var(--color-primary); opacity: 0.85; }
.vem__verdict-icon { font-size: 2.8rem; }
.vem__it-was {
  font-family: var(--font-retro);
  font-size: 1.8rem;
  margin: 0;
}
.vem__guessed {
  font-family: var(--font-retro);
  font-size: 1.2rem;
  color: var(--color-ink-muted);
  margin: 0;
}

/* --- Resultat --- */
.vem__score {
  font-family: var(--font-retro);
  font-size: 1.8rem;
  margin: 0;
}
.vem__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.vem__list-row {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-areas: 'icon line' 'icon meta';
  gap: 0.1rem 0.7rem;
  padding: 0.6rem 0.9rem;
  border: 1px solid var(--color-primary-dim);
  border-radius: 8px;
  background: var(--color-background-2);
}
.vem__list-row--ok { border-color: var(--color-lag1); }
.vem__list-icon {
  grid-area: icon;
  align-self: center;
  font-family: var(--font-retro);
  font-size: 1.6rem;
  color: var(--color-primary);
}
.vem__list-row--ok .vem__list-icon { color: var(--color-lag1); }
.vem__list-line {
  grid-area: line;
  font-family: var(--font-retro);
  font-size: 1.25rem;
  color: var(--color-ink-strong);
}
.vem__list-meta {
  grid-area: meta;
  font-size: 0.95rem;
  color: var(--color-ink-muted);
}
.vem__result-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 0.6rem;
}
.vem__result-actions .crt-button { font-size: 1.4rem; }

@media (prefers-reduced-motion: reduce) {
  .vem__pip { animation: none; opacity: 0.7; }
}
</style>
