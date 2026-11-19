<script setup lang="ts">
/**
 * Entrén (Lager A — IDENTISK i alla X&Y-stationer). Fullskärm före stationens eget flöde:
 *   attract (slot "attract", får { start }) → rollval-klippen → valet → (väntar) → utfall.
 * Logik/synk i entre.ts; se types.ts för kontraktet.
 */
import { computed, onUnmounted, ref, watch } from 'vue'
import RoleSelect from '../rollval/RoleSelect.vue'
import Ankomst from './Ankomst.vue'
import StationIntro from './StationIntro.vue'
import RollSekvens from './RollSekvens.vue'
import type { RollvalConfig } from '../rollval/types'
import { useEntre } from './entre'
import type { EntrePerson, EntreRole, SideId } from './types'

const props = withDefaults(
  defineProps<{
    /** Rollvalets klipp (station config ROLLVAL). */
    rollval: RollvalConfig
    showSetToggle?: boolean
  }>(),
  { showSetToggle: false },
)
const emit = defineEmits<{ start: []; done: [] }>()

const entre = useEntre()
const s = entre.state
const cfg = computed(() => entre.config())
const roles = computed(() => cfg.value.roles)

// Steg → appen: lämnar attract = sessionen börjar; klar = appens tutorial.
// flush 'sync': appen avmonterar <Entre> på 'klar' — en vanlig (pre) watcher hinner då aldrig emit:a.
watch(
  () => s.step,
  (n, o) => {
    if (o === 'attract' && n !== 'attract') emit('start')
    if (n === 'klar') emit('done')
  },
  { flush: 'sync' },
)

/* ---------- attract ---------- */
/**
 * entre-v2 (Josef 2026-11-19): attract ÄR "Ställ er på rätt sida" (Ankomst.vue, tredelad sida A | stationen |
 * sida B, med 3D-bilden i mitten). Den gamla förskärmen (stationens attract + namnlistor) och ankomst-steget
 * (samma information en gång till) är borta. Stationens eget attract-innehåll (slot) visas bara om gruppen är tom.
 */
const sideNames = (side: SideId) =>
  entre.members.value.filter((m) => entre.voteSides.value[m.band_id] === side).map((m) => m.name)

/* ---------- rollbilder ---------- */
function clipFor(role: EntreRole): string {
  return props.rollval.clipSets[s.clipSet]?.[role.rollvalRoleId] ?? props.rollval.clipSets[0]?.[role.rollvalRoleId] ?? ''
}
function taglineFor(role: EntreRole): string {
  return role.tagline ?? props.rollval.roles.find((r) => r.id === role.rollvalRoleId)?.tagline ?? ''
}
const notGuaranteed = computed(
  () => cfg.value.notGuaranteed ?? 'Det är inte säkert att du får den roll du väljer — väljer fler samma roll lottas det.',
)

/* ---------- valet (skärm) ---------- */
let nameTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => [s.step, s.turn, s.turnStage, s.voteMode] as const,
  ([step, , stage, mode]) => {
    if (nameTimer) clearTimeout(nameTimer)
    nameTimer = null
    if (step === 'valet' && mode === 'skarm' && stage === 'namn') nameTimer = setTimeout(() => entre.showQuestion(), 2200)
  },
  { immediate: true },
)
onUnmounted(() => nameTimer && clearTimeout(nameTimer))

const voted = (band: string) => !!s.votes[band]

/* ---------- utfall ---------- */
const SIDES = ['A', 'B'] as const
const sideLabel = (side: SideId) => cfg.value.sides?.[side]?.label ?? ''
const sideGroups = computed(() =>
  SIDES.map((side) => ({ side, label: sideLabel(side), people: entre.personer.value.filter((p) => p.side === side) })),
)
const unsided = computed(() => entre.personer.value.filter((p) => p.side == null))
const lottad = (p: EntrePerson) => p.chosen_role != null && p.chosen_role !== p.assigned_role

/* ---------- 3D-översikt (three.js-sidan, config.illustrationUrl) — annars 2D-illustrationen ---------- */
const illuOk = ref(false)
const illuUrl = computed(() => cfg.value.illustrationUrl ?? '')
if (illuUrl.value && typeof fetch !== 'undefined') {
  // Vite/statisk server svarar index.html på saknade filer → kräv sidans kontraktsmarkör.
  fetch(illuUrl.value)
    .then((r) => (r.ok ? r.text() : ''))
    .then((t) => (illuOk.value = t.includes('xy-sidor')))
    .catch(() => (illuOk.value = false))
}
function src3d(params: Record<string, string>): string {
  const q = new URLSearchParams({ station: cfg.value.station3d ?? '', me: s.screenSide ?? '', bg: 'transparent', ...params })
  return `${illuUrl.value}?${q.toString()}`
}
/** Ankomsten: startsidorna (fasta halvor) med bara namn. */
const arrivalSrc = computed(() =>
  src3d({ lage: 'ankomst', a: sideNames('A').join(','), b: sideNames('B').join(','), la: 'Sida A', lb: 'Sida B' }),
)
/** Utfallet: varje person på sin rollplats med namn + titel (färgen = sidans, standard i 3D). */
const placesSrc = computed(() =>
  src3d({
    lage: 'platser',
    figurer: JSON.stringify(
      entre.personer.value.filter((p) => p.plats).map((p) => ({ namn: p.name, plats: p.plats, titel: p.titel })),
    ),
  }),
)

/* ---------- facilitator ---------- */
const menu = ref(false)
function toggleMode(): void {
  entre.setVoteMode(s.voteMode === 'skarm' ? 'rfid' : 'skarm')
}
</script>

<template>
  <div class="en" :class="`en--${s.step}`">
    <!-- ATTRACT = "STÄLL ER PÅ RÄTT SIDA": tredelad sida A | stationen (+3D) | sida B -->
    <Ankomst v-if="s.step === 'attract' && entre.members.value.length" :illu-src="illuOk ? arrivalSrc : ''" />

    <!-- ATTRACT utan grupp (tom roster): stationens eget attract-innehåll -->
    <div v-else-if="s.step === 'attract'" class="en__attract">
      <div class="en__attract-slot">
        <slot name="attract" :start="entre.start">
          <div class="en__stage en__tap" role="button" tabindex="0" @click="entre.start()" @keydown.enter="entre.start()">
            <h1 class="en__title ink-strong">{{ cfg.stationTitle }}</h1>
            <p class="en__cta">Tryck för att börja ▸</p>
          </div>
        </slot>
      </div>
    </div>

    <!-- STATIONSINTRO: hype-klippet (~5–6 s), ett tryck hoppar över -->
    <StationIntro v-else-if="s.step === 'intro' && cfg.introClip" :src="cfg.introClip" @done="entre.introDone()" />

    <!-- ROLLVAL-KLIPPEN -->
    <!-- ROLLSEKVENSEN (inga klick): brygga1 → kort A → klipp A → brygga2 → kort B → klipp B → valet -->
    <RollSekvens
      v-else-if="s.step === 'rollval' && cfg.rollkort"
      :rollnamn="[cfg.rollkort.A, cfg.rollkort.B]"
      :klipp="[clipFor(roles[0]), clipFor(roles[1])]"
      :valvfarg="cfg.rollkort.valvfarg"
      :sprak="cfg.rollkort.sprak"
      @done="entre.clipsDone()"
    />

    <RoleSelect
      v-else-if="s.step === 'rollval'"
      :config="rollval"
      :start-set="s.clipSet"
      :show-set-toggle="showSetToggle"
      clips-only
      @clips-done="entre.clipsDone()"
      @skip="entre.clipsDone()"
    />

    <!-- VALET, skärm-läge: JÄTTESTORT namn → frågan -->
    <template v-else-if="s.step === 'valet' && s.voteMode === 'skarm' && entre.currentVoter.value">
      <div
        v-if="s.turnStage === 'namn'"
        :key="'n' + s.turn"
        class="en__stage en__tap en__name-stage"
        role="button"
        tabindex="0"
        @click="entre.showQuestion()"
        @keydown.enter="entre.showQuestion()"
      >
        <p class="en__eyebrow">{{ s.turn + 1 }} av {{ entre.myVoters.value.length }}</p>
        <h1 class="en__giant ink-strong">{{ entre.currentVoter.value.name }}</h1>
        <p class="en__muted">Din tur att välja</p>
      </div>
      <div v-else :key="'q' + s.turn" class="en__stage en__decide">
        <p class="en__who">{{ entre.currentVoter.value.name }}</p>
        <h2 class="en__question ink-strong">Vilken roll vill du ha?</h2>
        <div class="en__split">
          <button v-for="r in roles" :key="r.letter" class="en__choice amber-frame" @click="entre.vote(r.letter)">
            <img v-if="r.image" :src="r.image" :alt="r.name" class="en__img" />
            <video v-else-if="clipFor(r)" :src="clipFor(r) + '#t=1'" class="en__img" muted playsinline preload="metadata" />
            <div v-else class="en__img en__img--ph">{{ r.name }}</div>
            <span class="en__choice-name ink-strong">{{ r.name }}</span>
            <span v-if="taglineFor(r)" class="en__choice-tag">{{ taglineFor(r) }}</span>
          </button>
        </div>
        <p class="en__warn">{{ notGuaranteed }}</p>
      </div>
    </template>

    <!-- VALET, rfid-läge: två bilder, NEJ-läsaren = vänster, JA-läsaren = höger -->
    <div v-else-if="s.step === 'valet' && s.voteMode === 'rfid'" class="en__stage en__decide">
      <h2 class="en__question ink-strong">Vilken roll vill du ha?</h2>
      <p class="en__muted">Bippa ditt band på läsaren under den roll du vill ha.</p>
      <div class="en__split">
        <div v-for="(r, i) in roles" :key="r.letter" class="en__choice amber-frame">
          <img v-if="r.image" :src="r.image" :alt="r.name" class="en__img" />
          <video v-else-if="clipFor(r)" :src="clipFor(r) + '#t=1'" class="en__img" muted playsinline preload="metadata" />
          <div v-else class="en__img en__img--ph">{{ r.name }}</div>
          <span class="en__choice-name ink-strong">{{ r.name }}</span>
          <span class="en__reader">{{ i === 0 ? '◀ vänster läsare (NEJ)' : 'höger läsare (JA) ▶' }}</span>
        </div>
      </div>
      <ul class="en__voters">
        <li v-for="m in entre.members.value" :key="m.band_id" :class="{ 'en__voters--on': voted(m.band_id) }">
          {{ voted(m.band_id) ? '✓' : '·' }} {{ m.name }}
        </li>
      </ul>
      <p class="en__warn">{{ notGuaranteed }}</p>
      <p v-if="s.unknownBeep" class="en__muted">Okänt band ({{ s.unknownBeep.uid }}) — inte med i gruppen.</p>
    </div>

    <!-- VÄNTAR på andra sidan -->
    <div v-else-if="s.step === 'valet' || s.step === 'vantar'" class="en__stage">
      <h2 class="en__question ink-strong">Väntar på andra sidan…</h2>
      <p class="en__muted">{{ entre.votedCount.value }} av {{ entre.members.value.length }} har valt</p>
    </div>

    <!-- UTFALL: överblick sida A / sida B med namnskyltar över gubbarna -->
    <div v-else-if="s.step === 'utfall'" class="en__stage en__outcome">
      <h2 class="en__question ink-strong">Så här blev det</h2>
      <iframe v-if="illuOk" :src="placesSrc" class="en__illu3d" title="Så här ska ni stå" />
      <div v-else class="en__floor">
        <section
          v-for="g in sideGroups"
          :key="g.side"
          class="en__zone"
          :class="[`en__zone--${g.side}`, { 'en__zone--mine': s.screenSide === g.side, 'en__zone--dim': s.screenSide && s.screenSide !== g.side }]"
        >
          <span class="en__zone-letter" aria-hidden="true">{{ g.side }}</span>
          <header class="en__zone-head">
            <span class="en__zone-title">SIDA {{ g.side }}</span>
            <span v-if="g.label" class="en__zone-label">{{ g.label }}</span>
          </header>
          <div class="en__crowd">
            <figure v-for="(p, i) in g.people" :key="p.band_id" class="en__fig" :style="{ '--d': `${0.25 + i * 0.4}s` }">
              <span class="en__bubble">{{ p.name }}</span>
              <svg class="en__body" viewBox="0 0 60 100" aria-hidden="true">
                <circle cx="30" cy="18" r="13" />
                <path d="M8 98 V60 Q8 38 30 38 Q52 38 52 60 V98 Z" />
              </svg>
              <figcaption class="en__fig-role">
                {{ p.titel }}<span v-if="lottad(p)" class="en__lottad">lottad</span>
              </figcaption>
            </figure>
          </div>
        </section>
      </div>
      <p v-if="unsided.length" class="en__muted">Stanna här: {{ unsided.map((p) => p.name).join(', ') }}</p>
      <button class="crt-button crt-button--strong en__cta-btn" @click="entre.finish()">Vi står på rätt sida ▸</button>
    </div>

    <!-- Facilitator: röstläge + lotta nu (diskret) -->
    <button class="en__fac-btn" @click.stop="menu = !menu">
      Röst: {{ s.voteMode === 'rfid' ? 'RFID' : 'skärm' }}{{ s.bandlost ? ' · bandlöst' : '' }} ▾
    </button>
    <div v-if="menu" class="en__fac" @click.stop>
      <button class="en__fac-item" @click="toggleMode">Byt till {{ s.voteMode === 'rfid' ? 'skärm' : 'RFID' }}</button>
      <button
        v-if="s.step === 'rollval' || s.step === 'valet' || s.step === 'vantar'"
        class="en__fac-item"
        @click="entre.skipVote(); menu = false"
      >
        Lotta nu (resten utan val)
      </button>
      <span v-if="s.voteMode === 'rfid'" class="en__muted">{{ s.mqttConnected ? 'läsare: ansluten' : 'läsare: ingen broker' }}</span>
    </div>
  </div>
</template>

<style scoped>
.en {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 0.4rem;
}
.en__stage {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.1rem;
  text-align: center;
}
.en__tap {
  cursor: pointer;
}
.en__title {
  margin: 0;
  font-size: clamp(2.6rem, 8vw, 5rem);
  letter-spacing: 0.08em;
}
.en__cta {
  font-size: 1.6rem;
  color: var(--color-primary);
}
.en__muted {
  color: var(--color-ink-muted);
  margin: 0;
}
.en__eyebrow {
  margin: 0;
  font-size: 1.1rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}

/* attract */
.en__attract {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.en__attract-slot {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.en__attract-slot > * {
  flex: 1;
  min-height: 0;
}
.en__group {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 0.8rem 1rem 1rem;
  border-top: 1px solid var(--color-primary-dim);
  text-align: center;
  cursor: pointer;
  font-size: 1.25rem;
}
.en__group p {
  margin: 0;
}
.en__group-head {
  display: flex;
  gap: 1rem;
  align-items: baseline;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}
.en__group-name {
  font-size: 1.9rem;
  color: var(--color-primary);
  text-shadow: var(--glow-soft);
}
.en__sides {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  width: min(100%, 76rem);
}
.en__sides--one {
  grid-template-columns: 1fr;
  width: min(100%, 60rem);
}
.en__side-block {
  --zone: var(--entre-side-a, #fff1d6);
  display: flex;
  align-items: stretch;
  gap: 0.8rem;
  padding: 0.6rem;
  border: 2px solid var(--zone);
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.35);
}
.en__side-block--B {
  --zone: var(--entre-side-b, #ff3cc8);
}
.en__side-letter {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2.2em;
  padding: 0 0.3em;
  border-radius: 10px;
  background: var(--zone);
  color: #0b0b0b;
  font-family: var(--font-retro, monospace);
  font-size: clamp(2.4rem, 5vw, 3.6rem);
  font-weight: 700;
  line-height: 1;
}
.en__name-blocks {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
  gap: 0.5rem;
}
.en__name-block {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.45em 0.6em;
  border-radius: 10px;
  border: 2px solid var(--zone, var(--color-primary));
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-ink-strong);
  font-family: var(--font-retro, monospace);
  font-size: clamp(1.6rem, 3.6vw, 2.8rem);
  letter-spacing: 0.04em;
  text-align: center;
  overflow-wrap: anywhere;
}
.en__group-hint {
  font-size: 1.15rem;
  color: var(--color-ink-strong);
  text-transform: none;
}

/* valet */
.en__name-stage {
  gap: 0.6rem;
}
.en__giant {
  margin: 0;
  font-size: clamp(5rem, 22vw, 16rem);
  line-height: 1;
  letter-spacing: 0.04em;
  overflow-wrap: anywhere;
  animation: en-pop 0.35s var(--ease-out, ease-out);
}
@keyframes en-pop {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: none; }
}
.en__who {
  margin: 0;
  font-size: clamp(2rem, 5vw, 3.2rem);
  color: var(--color-primary);
  letter-spacing: 0.06em;
}
.en__question {
  margin: 0;
  font-size: clamp(1.8rem, 4.5vw, 3rem);
  letter-spacing: 0.04em;
}
.en__split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.2rem;
  width: min(100%, 64rem);
  flex: 1;
  min-height: 0;
}
.en__choice {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  min-height: 0;
  font: inherit;
  color: inherit;
  background: transparent;
  cursor: pointer;
  transition: background 0.14s ease, transform 0.14s var(--ease-out, ease-out);
}
div.en__choice {
  cursor: default;
}
button.en__choice:hover {
  background: rgba(var(--mode-accent-rgb, 255, 180, 60), 0.08);
}
button.en__choice:active {
  transform: scale(0.98);
}
.en__img {
  width: 100%;
  flex: 1;
  min-height: 0;
  max-height: 46vh;
  object-fit: cover;
  border-radius: var(--radius, 8px);
  background: #0a0a0a;
  pointer-events: none;
}
.en__img--ph {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--color-primary-dim);
  color: var(--color-ink-muted);
  font-size: 1.4rem;
}
.en__choice-name {
  font-size: clamp(1.5rem, 3.6vw, 2.3rem);
  letter-spacing: 0.04em;
}
.en__choice-tag {
  color: var(--color-primary);
  font-size: 1.05rem;
}
.en__reader {
  font-family: var(--font-mono, monospace);
  color: var(--color-ink-muted);
  letter-spacing: 0.06em;
}
.en__warn {
  margin: 0;
  max-width: 52ch;
  font-size: 1.25rem;
  color: var(--color-ink-strong);
  border: 1px solid var(--color-primary-dim);
  border-radius: 999px;
  padding: 0.35em 1.2em;
}
.en__voters {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.4rem 1.4rem;
  font-size: 1.4rem;
  color: var(--color-ink-muted);
}
.en__voters--on {
  color: var(--color-primary);
}

/* utfall — "golvet" med sida A / sida B */
.en__outcome,
.en__arrival {
  gap: 0.8rem;
}
.en__arrival .en__illu3d {
  flex: 1;
}
.en__arrival .en__name-block {
  font-size: clamp(1.3rem, 3vw, 2.2rem);
}
.en__illu3d {
  width: min(100%, 72rem);
  flex: 1;
  min-height: 0;
  border: 0;
  background: transparent;
}
.en__floor {
  flex: 1;
  min-height: 0;
  width: min(100%, 72rem);
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: minmax(0, 1fr);
  gap: 0;
  border-radius: 18px;
  overflow: hidden;
  border: 2px solid var(--color-primary-dim);
}
.en__zone {
  --zone: var(--entre-side-a, #fff1d6);
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 1rem 1rem 0.6rem;
  min-height: 0;
  overflow: hidden;
  background:
    linear-gradient(to bottom, transparent 55%, rgba(255, 255, 255, 0.04)),
    repeating-linear-gradient(90deg, transparent 0 46px, rgba(255, 255, 255, 0.025) 46px 48px);
  transition: opacity 0.3s ease;
}
.en__zone--B {
  --zone: var(--entre-side-b, #ff3cc8);
  border-left: 3px dashed var(--color-primary-dim);
}
.en__zone--mine {
  box-shadow: inset 0 0 0 3px var(--zone), inset 0 0 60px rgba(255, 255, 255, 0.06);
}
.en__zone--dim {
  opacity: 0.45;
}
.en__zone-letter {
  position: absolute;
  left: 50%;
  bottom: 4%;
  transform: translateX(-50%) perspective(400px) rotateX(55deg);
  font-family: var(--font-retro, monospace);
  font-size: clamp(8rem, 22vw, 16rem);
  line-height: 1;
  color: var(--zone);
  opacity: 0.16;
  pointer-events: none;
}
.en__zone-head {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
}
.en__zone-title {
  font-family: var(--font-retro, monospace);
  font-size: clamp(1.8rem, 4.5vw, 3rem);
  letter-spacing: 0.12em;
  color: var(--zone);
  text-shadow: 0 0 18px var(--zone);
}
.en__zone-label {
  font-size: 1.2rem;
  color: var(--color-ink-strong);
  letter-spacing: 0.06em;
}
.en__crowd {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: clamp(0.6rem, 2.5vw, 2rem);
  padding-bottom: 0.4rem;
}
.en__fig {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  animation: en-rise 0.5s var(--ease-out, ease-out) both;
  animation-delay: var(--d);
}
.en__bubble {
  position: relative;
  padding: 0.3em 0.8em;
  border-radius: 12px;
  background: var(--zone);
  color: #0b0b0b;
  font-family: var(--font-retro, monospace);
  font-size: clamp(1.3rem, 3vw, 2.1rem);
  font-weight: 700;
  white-space: nowrap;
  animation: en-pop 0.4s var(--ease-out, ease-out) both;
  animation-delay: calc(var(--d) + 0.25s);
}
.en__bubble::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -9px;
  transform: translateX(-50%);
  border: 10px solid transparent;
  border-bottom: 0;
  border-top-color: var(--zone);
}
.en__body {
  height: clamp(3.5rem, 16vh, 10rem);
  width: auto;
  fill: var(--zone);
  opacity: 0.9;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.5));
}
.en__fig-role {
  font-size: 1rem;
  color: var(--color-ink-muted);
  text-align: center;
}
.en__lottad {
  display: inline-block;
  margin-left: 0.4em;
  padding: 0 0.4em;
  border: 1px solid currentColor;
  border-radius: 6px;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
}
@keyframes en-rise {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: none; }
}
.en__cta-btn {
  font-size: 1.5rem;
  padding: 0.5em 2em;
}

/* facilitator */
.en__fac-btn {
  position: absolute;
  right: 0.6rem;
  bottom: 0.4rem;
  font-family: var(--font-mono, monospace);
  font-size: 0.8rem;
  color: var(--color-ink-muted);
  background: transparent;
  border: 1px solid currentColor;
  border-radius: 6px;
  padding: 0.2em 0.6em;
  opacity: 0.45;
  cursor: pointer;
  z-index: 2;
}
.en__fac {
  position: absolute;
  right: 0.6rem;
  bottom: 2.2rem;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.7rem;
  background: rgba(0, 0, 0, 0.88);
  border: 1px solid var(--color-primary-dim);
  border-radius: 10px;
  font-size: 0.9rem;
}
.en__fac-item {
  font-family: var(--font-retro, monospace);
  color: var(--color-primary);
  background: transparent;
  border: 1px solid var(--color-primary-dim);
  border-radius: 6px;
  padding: 0.35em 0.8em;
  cursor: pointer;
}
@media (max-width: 900px) {
  .en__split {
    grid-template-columns: 1fr;
  }
  .en__sides,
  .en__floor {
    grid-template-columns: 1fr;
  }
}
@media (prefers-reduced-motion: reduce) {
  .en__giant,
  .en__fig,
  .en__bubble { animation: none; }
}
</style>
