<script setup lang="ts">
/**
 * "Vem där?" — Förhandlingens lek (lila). Logik: vemDar.ts. Synk: station-kit/lek (ledaren
 * = lag1/delad vy). Varje skärm visar SIN sida; delad vy (pilot) visar båda sida vid sida.
 * Avmonteras när leken tar slut (ny grupp/byte) → allt i RAM försvinner.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import LekPanel from '@/station-kit/lek/LekPanel.vue'
import { createLekSync, type LekTransport } from '@/station-kit/lek/lekSync'
import { audio } from '@/station-kit/audio/AudioEngine'
import { useLjus } from '@/station-kit/ljus'
import {
  initialVem,
  reduceVem,
  peopleOn,
  other,
  SIDE_NAME,
  VEM_PROMPTS,
  VEM_TIMES,
  type Side,
  type VemPerson,
  type VemState,
} from './vemDar'

const props = defineProps<{
  people: VemPerson[]
  /** Den här skärmens sida. null = delad vy (båda). */
  mySide: Side | null
  leader: boolean
  transport?: LekTransport | null
}>()

const sync = createLekSync<VemState>({
  channel: 'vemdar',
  initial: initialVem(Date.now()),
  reduce: (s, a, now) => reduceVem(s, a, now),
  leader: props.leader,
  transport: props.transport,
})
const s = sync.state

const sides = computed<Side[]>(() => (props.mySide ? [props.mySide] : ['A', 'B']))
const prompt = computed(() => VEM_PROMPTS[s.prompt] ?? VEM_PROMPTS[0])
const candidates = computed(() => peopleOn(props.people, s.speakerSide))
const guessed = computed(() => props.people.find((p) => p.band_id === s.guess)?.name ?? '')

// Lokal klocka för nedräkningen (ledaren avgör tidsgränsen).
const now = ref(Date.now())
const leftSec = computed(() => Math.max(0, Math.ceil((VEM_TIMES.speakMs - (now.value - s.phaseAt)) / 1000)))
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now()
    if (props.leader) sync.act({ type: 'tick' })
  }, 500)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
  sync.dispose()
})

// Ljud lokalt per skärm. Ljus: gissarsidan får rätt/fel på lila bas (§5.1) — leken är
// synkad, så bara ledaren skickar gesten (annars dubbleras blinket); ljudet finns redan.
const ljus = useLjus()
watch(
  () => s.phase,
  (p) => {
    if (p === 'speak') audio.play('headset')
    else if (p === 'reveal') {
      audio.play(s.correct ? 'confirm' : 'deny')
      if (props.leader) ljus.gest(s.correct ? 'ratt' : 'fel', [other(s.speakerSide)], { tyst: true })
    }
  },
)

function hint(side: Side): string {
  const speaking = side === s.speakerSide
  if (s.phase === 'pick') return speaking ? 'Vem tar headsetet? Tryck på ditt namn.' : 'Motsidan väljer vem som pratar …'
  if (s.phase === 'speak') return speaking ? 'Prata i headsetet — låt som någon annan!' : 'Vem pratar? Tryck på namnet.'
  return s.correct ? 'Rätt gissat!' : 'Lurade!'
}
</script>

<template>
  <div class="vem" :class="{ 'vem--split': sides.length > 1 }">
    <LekPanel v-for="side in sides" :key="side" title="VEM DÄR?" :hint="hint(side)">
      <!-- VÄLJ TALARE -->
      <template v-if="s.phase === 'pick'">
        <template v-if="side === s.speakerSide">
          <div class="vem__names">
            <button
              v-for="p in peopleOn(people, side)"
              :key="p.band_id"
              class="lek-btn lek-btn--big"
              @click="sync.act({ type: 'pick', band_id: p.band_id, name: p.name })"
            >
              {{ p.name }}
            </button>
          </div>
          <p class="vem__note">Viska i mikrofonen — de ska bara höra dig genom headsetet.</p>
          <button class="lek-btn lek-btn--ghost vem__skip" @click="sync.act({ type: 'skip' })">Hoppa över ▸</button>
        </template>
        <div v-else class="vem__wait">
          <span class="vem__ear" aria-hidden="true">🎧</span>
          <p>Snart pratar någon från <b>{{ SIDE_NAME[other(side)] }}</b>.<br />Gissa vem!</p>
        </div>
      </template>

      <!-- TALA / GISSA -->
      <template v-else-if="s.phase === 'speak'">
        <template v-if="side === s.speakerSide">
          <p class="vem__who">{{ s.speakerName }}, det är din tur</p>
          <div class="vem__card">
            <span class="vem__card-kind">{{ prompt.kind === 'las' ? 'SÄG DET HÄR:' : 'SVARA MED EGNA ORD:' }}</span>
            <span class="vem__card-text">{{ prompt.text }}</span>
          </div>
          <p class="vem__note">Motsidan får ställa EN egen fråga till dig. Svara ärligt, men förställ rösten.</p>
        </template>
        <template v-else>
          <div class="vem__names">
            <button
              v-for="p in candidates"
              :key="p.band_id"
              class="lek-btn lek-btn--big"
              @click="sync.act({ type: 'guess', band_id: p.band_id })"
            >
              {{ p.name }}
            </button>
          </div>
          <p class="vem__note">Ni får ställa EN fråga till den som pratar.</p>
        </template>
        <p class="vem__clock">{{ leftSec }} s</p>
      </template>

      <!-- FACIT -->
      <template v-else>
        <div class="vem__reveal">
          <p class="vem__reveal-k">Det var</p>
          <p class="vem__reveal-name">{{ s.speakerName }}!</p>
          <p class="vem__reveal-sub">
            {{ s.guess ? (s.correct ? `${SIDE_NAME[other(s.speakerSide)]} gissade rätt.` : `${SIDE_NAME[other(s.speakerSide)]} gissade på ${guessed}.`) : 'Ingen hann gissa.' }}
          </p>
        </div>
      </template>

      <template #foot>
        <span>{{ SIDE_NAME.A }} {{ s.score.A }} – {{ s.score.B }} {{ SIDE_NAME.B }}</span>
        <button v-if="s.phase === 'reveal'" class="lek-btn lek-btn--ghost" @click="sync.act({ type: 'next' })">Nästa ▸</button>
      </template>
    </LekPanel>
  </div>
</template>

<style scoped>
.vem {
  height: 100%;
  min-height: 0;
  display: grid;
  gap: 1rem;
}
.vem--split {
  grid-template-columns: 1fr 1fr;
}
.vem__names {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
}
.vem__note {
  margin: 0;
  text-align: center;
  font-size: 1.1rem;
  color: var(--color-ink-muted, #b9a8d8);
}
.vem__skip {
  align-self: center;
  font-size: 1rem;
}
.vem__wait {
  text-align: center;
  font-size: clamp(1.3rem, 2.8vw, 2rem);
}
.vem__ear {
  font-size: 4rem;
}
.vem__who {
  margin: 0;
  text-align: center;
  font-size: 1.4rem;
  color: #b48cff;
}
.vem__card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1.2rem 1.4rem;
  border: 2px dashed #b48cff;
  border-radius: 14px;
  text-align: center;
}
.vem__card-kind {
  font-size: 1rem;
  letter-spacing: 0.14em;
  color: #b48cff;
}
.vem__card-text {
  font-size: clamp(1.6rem, 3.6vw, 2.6rem);
  line-height: 1.25;
}
.vem__clock {
  margin: 0;
  text-align: center;
  font-family: var(--font-retro, monospace);
  font-size: 2rem;
  color: #b48cff;
}
.vem__reveal {
  text-align: center;
}
.vem__reveal-k {
  margin: 0;
  font-size: 1.4rem;
}
.vem__reveal-name {
  margin: 0.2rem 0;
  font-family: var(--font-retro, monospace);
  font-size: clamp(3rem, 9vw, 6rem);
  color: #b48cff;
  text-shadow: 0 0 22px rgba(180, 140, 255, 0.8);
}
.vem__reveal-sub {
  margin: 0;
  font-size: 1.3rem;
}
</style>
