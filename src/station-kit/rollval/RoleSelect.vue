<script setup lang="ts">
/**
 * Rollval-flödet (Lager A — IDENTISK i alla X&Y-stationer).
 *
 * Steg (attract-skärmen äger stationen och kommer FÖRE detta):
 *   1. intro   — stationen + de två rollerna presenteras, tryck för att börja.
 *   2. clipA   — "Se hur en dag i livet ser ut som {roll A}" → klipp, klicka play.
 *   3. clipB   — "... som {roll B}" → klipp, klicka play.
 *   4. decide  — SPLIT SCREEN: båda rollerna sida vid sida → välj på skärmen.
 *
 * Allt innehåll kommer via `config` (stationens config.ts). Aktivt KLIPPSET
 * väljs av `startSet` (wiring alternerar per körning); en diskret SET-växel
 * finns för granskning. Emit:ar `pick(roleId)` eller `skip`.
 *
 * `clipsOnly` (entrén, station-kit/entre): stanna efter klipp B och emit:a
 * `clipsDone` — valet görs då av entrén (person för person / RFID).
 */
import { ref, computed } from 'vue'
import type { RollvalConfig } from './types'
import { useHoppa } from '../kiosk/kioskSkip'

const props = withDefaults(
  defineProps<{
    config: RollvalConfig
    /** Vilket klippset som är aktivt vid start (0-indexerat). */
    startSet?: number
    /** Visa den diskreta SET 1/2-växeln (granskning). Av som default. */
    showSetToggle?: boolean
    /** Bara intro + klipp; valet sköts av entrén (emit clipsDone efter klipp B). */
    clipsOnly?: boolean
  }>(),
  { startSet: 0, showSetToggle: false, clipsOnly: false },
)

const emit = defineEmits<{ pick: [roleId: string]; skip: []; clipsDone: [] }>()
useHoppa(() => emit('skip')) // hörngesten (kioskSkip)

type Stage = 'intro' | 'clipA' | 'clipB' | 'decide'
const stage = ref<Stage>('intro')

const roleA = computed(() => props.config.roles[0])
const roleB = computed(() => props.config.roles[1])

const setCount = computed(() => Math.max(1, props.config.clipSets.length))
const activeSet = ref(clampSet(props.startSet))
function clampSet(n: number): number {
  const c = Math.max(1, props.config.clipSets.length)
  return ((n % c) + c) % c
}
function setSet(n: number): void {
  activeSet.value = clampSet(n)
}

/** Klipp-url för en roll i det aktiva setet (tom sträng → placeholder-ruta). */
function clipFor(roleId: string): string {
  return props.config.clipSets[activeSet.value]?.[roleId] ?? ''
}

function begin(): void {
  stage.value = 'clipA'
}
function next(): void {
  if (stage.value === 'clipA') stage.value = 'clipB'
  else if (stage.value === 'clipB') {
    if (props.clipsOnly) emit('clipsDone')
    else stage.value = 'decide'
  }
}
function pick(roleId: string): void {
  emit('pick', roleId)
}
</script>

<template>
  <div class="rv">
    <!-- Diskret topprad: SET-växel (granskning) + hoppa över -->
    <div class="rv__top">
      <div v-if="showSetToggle && setCount > 1" class="rv__sets" role="group" aria-label="Klippset">
        <span class="rv__sets-label">SET</span>
        <button
          v-for="n in setCount"
          :key="n"
          class="rv__set"
          :class="{ 'rv__set--on': activeSet === n - 1 }"
          @click="setSet(n - 1)"
        >
          {{ n }}
        </button>
      </div>
      <span v-else />
    </div>

    <!-- 1. INTRO — stationen + de två rollerna -->
    <div v-if="stage === 'intro'" class="rv__stage rv__intro">
      <h1 class="rv__title ink-strong">{{ config.stationTitle }}</h1>
      <p class="rv__lead">{{ config.intro }}</p>
      <div class="rv__pair">
        <div v-for="r in config.roles" :key="r.id" class="rv__card amber-frame">
          <p class="rv__card-name ink-strong">{{ r.name }}</p>
          <p class="rv__card-tag">{{ r.tagline }}</p>
        </div>
      </div>
      <button class="crt-button crt-button--strong rv__cta" @click="begin">
        Utforska rollerna ▸
      </button>
    </div>

    <!-- 2 & 3. KLIPP per roll -->
    <div v-else-if="stage === 'clipA' || stage === 'clipB'" class="rv__stage rv__clip">
      <p class="rv__eyebrow">Se hur en dag i livet ser ut som</p>
      <h2 class="rv__role ink-strong">{{ (stage === 'clipA' ? roleA : roleB).name }}</h2>

      <div class="rv__video amber-frame">
        <video
          v-if="clipFor((stage === 'clipA' ? roleA : roleB).id)"
          :key="(stage === 'clipA' ? roleA : roleB).id + '-' + activeSet"
          class="rv__video-el"
          :src="clipFor((stage === 'clipA' ? roleA : roleB).id)"
          controls
          playsinline
          preload="metadata"
        />
        <div v-else class="rv__video-ph">
          <span class="rv__video-ph-tag">[KLIPP SAKNAS — placeholder]</span>
          <span class="rv__video-ph-sub">en dag i livet som {{ (stage === 'clipA' ? roleA : roleB).name }}</span>
        </div>
      </div>

      <button class="crt-button crt-button--strong rv__cta" @click="next">Nästa ▸</button>
    </div>

    <!-- 4. SPLIT SCREEN — välj roll -->
    <div v-else class="rv__stage rv__decide">
      <h2 class="rv__question ink-strong">{{ config.question }}</h2>
      <div class="rv__split">
        <div
          v-for="r in config.roles"
          :key="r.id"
          class="rv__choice amber-frame"
          role="button"
          tabindex="0"
          @click="pick(r.id)"
          @keydown.enter="pick(r.id)"
        >
          <p class="rv__choice-name ink-strong">{{ r.name }}</p>
          <p class="rv__choice-tag">{{ r.tagline }}</p>
          <p class="rv__choice-desc">{{ r.description }}</p>
          <span class="crt-button crt-button--strong rv__choice-btn">Jag väljer {{ r.name }} ▸</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rv {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 0.8rem;
  padding: 0.4rem;
}
.rv__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 2rem;
}
.rv__sets {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.rv__sets-label {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  color: var(--color-ink-muted);
}
.rv__set {
  font-family: var(--font-retro);
  font-size: 1rem;
  width: 1.9em;
  height: 1.9em;
  color: var(--color-ink-muted);
  background: transparent;
  border: 1px solid var(--color-primary-dim);
  border-radius: 6px;
  cursor: pointer;
}
.rv__set--on {
  color: var(--color-ink-strong);
  border-color: var(--color-primary);
  box-shadow: var(--glow-soft);
}
.rv__skip {
  font-family: var(--font-retro);
  font-size: 0.95rem;
  color: var(--color-ink-muted);
  background: transparent;
  border: 1px solid var(--color-primary-dim);
  border-radius: 6px;
  padding: 0.2em 0.8em;
  cursor: pointer;
}
.rv__skip:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.rv__stage {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.1rem;
  text-align: center;
}

/* --- intro --- */
.rv__title {
  font-size: clamp(2.4rem, 7vw, 4.5rem);
  letter-spacing: 0.08em;
  margin: 0;
}
.rv__lead {
  max-width: 52ch;
  margin: 0;
  font-size: 1.25rem;
  color: var(--color-primary);
  line-height: 1.4;
}
.rv__pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  width: min(100%, 48rem);
}
.rv__card {
  padding: 1.1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.rv__card-name {
  font-size: clamp(1.3rem, 3.4vw, 1.9rem);
  letter-spacing: 0.04em;
  margin: 0;
  overflow-wrap: break-word;
  max-width: 100%;
}
.rv__card-tag {
  margin: 0;
  font-size: 1.05rem;
  color: var(--color-ink-muted);
}

/* --- klipp --- */
.rv__eyebrow {
  margin: 0;
  font-size: 1.1rem;
  letter-spacing: 0.14em;
  color: var(--color-ink-muted);
  text-transform: uppercase;
}
.rv__role {
  margin: 0;
  font-size: clamp(2.2rem, 6vw, 3.8rem);
  letter-spacing: 0.05em;
}
.rv__video {
  width: min(100%, 60rem);
  aspect-ratio: 16 / 9;
  max-height: 58vh;
  overflow: hidden;
  background: #0a0a0a;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rv__video-el {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.rv__video-ph {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 1.5rem;
  border: 2px dashed var(--color-primary-dim);
  border-radius: var(--radius);
  color: var(--color-ink-muted);
  width: 100%;
  height: 100%;
  justify-content: center;
}
.rv__video-ph-tag {
  font-family: var(--font-mono);
  color: var(--color-primary);
  letter-spacing: 0.06em;
}

/* --- decide / split screen --- */
.rv__question {
  margin: 0;
  font-size: clamp(1.8rem, 5vw, 3rem);
  letter-spacing: 0.04em;
  max-width: 40ch;
}
.rv__split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.2rem;
  width: min(100%, 60rem);
  flex: 1;
  min-height: 0;
}
.rv__choice {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 1.4rem 1.2rem;
  cursor: pointer;
  transition: background 0.14s ease, transform 0.14s var(--ease-out);
}
.rv__choice:hover {
  background: rgba(var(--mode-accent-rgb), 0.08);
}
.rv__choice:active {
  transform: scale(0.99);
}
.rv__choice-name {
  margin: 0;
  font-size: clamp(1.4rem, 3.6vw, 2.1rem);
  letter-spacing: 0.04em;
  overflow-wrap: break-word;
  max-width: 100%;
}
.rv__choice-tag {
  margin: 0;
  font-size: 1.15rem;
  color: var(--color-primary);
}
.rv__choice-desc {
  margin: 0;
  font-size: 1.05rem;
  color: var(--color-ink-muted);
  line-height: 1.4;
  max-width: 34ch;
}
.rv__choice-btn {
  margin-top: 0.4rem;
  pointer-events: none;
  font-size: 1.2rem;
}

.rv__cta {
  font-size: 1.5rem;
  padding: 0.5em 2em;
}

@media (max-width: 900px) {
  .rv__pair,
  .rv__split {
    grid-template-columns: 1fr;
  }
}
</style>
