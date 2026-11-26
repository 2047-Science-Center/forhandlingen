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

/** EN rad per skärm och fas (Josef 2026-11-26: en sak i taget, ingen spridd info). */
function hint(side: Side): string {
  const speaking = side === s.speakerSide
  if (s.phase === 'pick') return speaking ? 'Vem tar headsetet? Tryck på ditt namn.' : ''
  if (s.phase === 'speak') return speaking ? '' : `Vem på ${SIDE_NAME[s.speakerSide]} pratar?`
  return ''
}
/** Facit från den här sidans håll. */
function utfall(side: Side): string {
  const gissade = side !== s.speakerSide
  if (s.correct) return gissade ? 'Ni gissade rätt!' : 'De gissade rätt!'
  return gissade ? 'De lurade er!' : 'Ni lurade dem!'
}
const vannSida = computed<Side>(() => (s.correct ? other(s.speakerSide) : s.speakerSide))
</script>

<template>
  <div class="vem" :class="{ 'vem--split': sides.length > 1 }">
    <LekPanel v-for="side in sides" :key="side" title="VEM DÄR?" :hint="hint(side)">
      <!-- VÄLJ TALARE: talarsidan trycker på sitt namn, motsidan väntar -->
      <template v-if="s.phase === 'pick'">
        <div v-if="side === s.speakerSide" class="vem__names">
          <button
            v-for="p in peopleOn(people, side)"
            :key="p.band_id"
            class="lek-btn lek-btn--big"
            @click="sync.act({ type: 'pick', band_id: p.band_id, name: p.name })"
          >
            {{ p.name }}
          </button>
        </div>
        <div v-else class="vem__fokus">
          <span class="vem__ear" aria-hidden="true">🎧</span>
          <p class="vem__stor">{{ SIDE_NAME[s.speakerSide] }} väljer vem som pratar …</p>
        </div>
      </template>

      <!-- TALA: talaren ser BARA sin tur + raden. GISSA: motsidan ser BARA talarsidans namn. -->
      <template v-else-if="s.phase === 'speak'">
        <template v-if="side === s.speakerSide">
          <div class="vem__tur">
            <span class="vem__tur-namn">{{ s.speakerName }}</span>
            <span class="vem__tur-text">DIN TUR – PRATA I HEADSETET</span>
          </div>
          <div class="vem__card">
            <span class="vem__card-kind">{{ prompt.kind === 'las' ? 'SÄG DET HÄR:' : 'SVARA MED EGNA ORD:' }}</span>
            <span class="vem__card-text">{{ prompt.text }}</span>
          </div>
        </template>
        <div v-else class="vem__names">
          <button
            v-for="p in candidates"
            :key="p.band_id"
            class="lek-btn lek-btn--big"
            @click="sync.act({ type: 'guess', band_id: p.band_id })"
          >
            {{ p.name }}
          </button>
        </div>
      </template>

      <!-- FACIT -->
      <template v-else>
        <div class="vem__reveal">
          <p class="vem__reveal-k">Det var</p>
          <p class="vem__reveal-name">{{ s.speakerName }}!</p>
          <p class="vem__utfall" :class="vannSida === side ? 'vem__utfall--vann' : 'vem__utfall--forlust'">{{ utfall(side) }}</p>
        </div>
      </template>

      <template #foot>
        <span>{{ SIDE_NAME.A }} {{ s.score.A }} – {{ s.score.B }} {{ SIDE_NAME.B }}</span>
        <span v-if="s.phase === 'speak'" class="vem__clock">{{ leftSec }} s</span>
        <button v-if="s.phase === 'pick' && side === s.speakerSide" class="lek-btn lek-btn--ghost" @click="sync.act({ type: 'skip' })">Hoppa över ▸</button>
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
  gap: 1.2rem;
}
.vem__names .lek-btn--big {
  min-width: 11rem;
  font-size: clamp(1.6rem, 3.4vw, 2.4rem);
}
.vem__fokus {
  text-align: center;
}
.vem__ear {
  font-size: 4.5rem;
}
.vem__stor {
  margin: 0.4rem 0 0;
  font-size: clamp(1.6rem, 3.4vw, 2.4rem);
}
/* Vems tur: namnet STORT, så ingen tvekar vem som ska prata */
.vem__tur {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.6rem 1rem;
  border-radius: 14px;
  background: #b48cff;
  color: #1a0d2e;
  box-shadow: 0 0 30px rgba(180, 140, 255, 0.6);
}
.vem__tur-namn {
  font-family: var(--font-retro, monospace);
  font-size: clamp(2.6rem, 7vw, 4.6rem);
  line-height: 1;
}
.vem__tur-text {
  font-size: clamp(1rem, 2vw, 1.4rem);
  font-weight: 700;
  letter-spacing: 0.12em;
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
  font-family: var(--font-retro, monospace);
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
.vem__utfall {
  display: inline-block;
  margin: 0.4rem 0 0;
  padding: 0.2em 0.9em;
  border-radius: 10px;
  font-size: clamp(1.4rem, 3vw, 2rem);
  font-weight: 700;
}
.vem__utfall--vann { background: #7ad14f; color: #0b1a07; }
.vem__utfall--forlust { background: rgba(255, 255, 255, 0.12); color: #f1eaff; }
</style>
