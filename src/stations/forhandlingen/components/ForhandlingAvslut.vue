<script setup lang="ts">
/**
 * Förhandlingens avslut i skarpt läge (station-kit/resultat, XY-RESULTAT-OCH-VINST §2.3).
 * Ersätter den klickstyrda ResultWalkthrough i skarpt läge (testläget behåller den).
 *
 *  1 UPPBYGGNAD "DOMAREN RÄKNAR …" — båda sidornas rader tänds av sig själva:
 *               säkrad ✓/✗ → pengar kvar → gissning ×2 (stamp / blip / confirm)
 *  2 SPÄNNING   båda sidornas poäng räknar upp samtidigt (virveln)
 *  3 AVSLÖJANDE "SIDA A VANN!" — vinnarsidan grön chase, den andra dämpad (aldrig rött)
 *  4 UTFALL     "A 80 – 0 B" + varför. "Vi är klara ▸" (min 8 s, auto 45 s → done → lek)
 *
 * Båda fönstren kör samma takter när avslöjandet börjar (samma NUC → samma ögonblick), så
 * ingen skärm kan dras in i leken innan den sett vinnaren. Ljuset skrivs av skrivaren (lag1/
 * delad); ljudet spelas i varje fönster (varje sida har egna headset/högtalare).
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { TeamId } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { scoreAll } from '../engine/scoring'
import VaraBild from './VaraBild.vue'
import SidFigur from './SidFigur.vue'
import MyntStapel from './MyntStapel.vue'
import { useI18n } from '@/station-kit/i18n'
import { audio } from '@/station-kit/audio/AudioEngine'
import { useLjus } from '@/station-kit/ljus'
import { AvslutRuta, useAvslut } from '@/station-kit/resultat'
import { useRotation } from '@/station-kit/rotation/rotation'
import { arSkrivare, resultatLjud, utfallForResultat, SIDA_FOR_LAG } from '../ljus'
import { SIDA_NAMN, rubrik, varfor, vinnare, ingenVann, utfallTypFor } from '../avslutText'

const emit = defineEmits<{ finish: [] }>()
const store = useGameStore()
const { t } = useI18n()
const ljus = useLjus()
const rotation = useRotation()

const scores = computed(() => scoreAll(store.state))
const teams: TeamId[] = ['lag1', 'lag2']
const v = computed(() => vinnare(scores.value))
const skrivare = computed(() => arSkrivare(store.view))
const egnaLag = computed<TeamId[]>(() => (store.view === 'shared' ? teams : [store.view as TeamId]))

/** Uppbyggnadens rader: 0 = inget, 1 = säkrad, 2 = pengar, 3 = gissning. */
const STEG_MS = 1700
const steg = ref(0)
/** Spänningens räkneverk (0 → lagpoäng). */
const raknat = ref<Record<TeamId, number>>({ lag1: 0, lag2: 0 })
let timers: ReturnType<typeof setTimeout>[] = []
let raf = 0

function stegUpp(): void {
  const ljud = ['stamp', 'blip', 'confirm'] as const
  for (let i = 1; i <= 3; i++) {
    timers.push(
      setTimeout(() => {
        steg.value = i
        audio.play(ljud[i - 1])
      }, (i - 1) * STEG_MS + 300),
    )
  }
}

function raknaUpp(ms: number): void {
  const t0 = performance.now()
  const mal = { lag1: scores.value.lag1.teamScore, lag2: scores.value.lag2.teamScore }
  const tick = (nu: number) => {
    const k = Math.min(1, (nu - t0) / ms)
    const e = 1 - Math.pow(1 - k, 3)
    raknat.value = { lag1: Math.round(mal.lag1 * e), lag2: Math.round(mal.lag2 * e) }
    if (k < 1) raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
}

const avslut = useAvslut({
  tider: { uppbyggnadMs: 3 * STEG_MS + 500 },
  ljud: true,
  ljus: { skrivare: () => skrivare.value, ids: ['A', 'B'] },
  onTakt: (takt) => {
    if (takt === 'spanning') raknaUpp(avslut.tider.spanningMs - 200)
  },
  onAvslojande: () => {
    raknat.value = { lag1: scores.value.lag1.teamScore, lag2: scores.value.lag2.teamScore }
    if (skrivare.value) {
      if (ingenVann(scores.value)) ljus.utfall('forlorarsida', ['A', 'B'], { tyst: true })
      else {
        for (const u of utfallForResultat(v.value)) ljus.utfall(u.utfall, u.ids, { tyst: true })
        // Vinnarsidan: grön chase när antändningen (3 blink) är klar.
        if (v.value !== 'draw') {
          const sida = SIDA_FOR_LAG[v.value]
          timers.push(setTimeout(() => ljus.lage('vinnare', [sida]), 1300))
        }
      }
    }
    // Den här sidans ljud efter slaget: egen sida vann → vinst, annars neutral.
    timers.push(setTimeout(() => ljus.ljud(resultatLjud(v.value, store.view)), 650))
  },
  // Bara skrivaren auto-avslutar (annars skickar båda fönstren done); den andra följer via done.
  onAuto: () => {
    if (skrivare.value) emit('finish')
  },
})

onMounted(() => {
  stegUpp()
  avslut.start()
})
onBeforeUnmount(() => {
  timers.forEach(clearTimeout)
  timers = []
  cancelAnimationFrame(raf)
})

const inRotation = computed(() => rotation.state.phase === 'running')
const knapp = computed(() => (inRotation.value ? 'Vi är klara ▸' : t('reveal.play_again')))
const typ = computed(() => utfallTypFor(scores.value, egnaLag.value))
const poang = computed(() => `${scores.value.lag1.teamScore} – ${scores.value.lag2.teamScore}`)
</script>

<template>
  <div class="fa">
    <AvslutRuta
      :takt="avslut.takt.value"
      :typ="typ"
      uppbyggnad="DOMAREN RÄKNAR …"
      eyebrow="FÖRHANDLINGEN"
      :rubrik="rubrik(scores)"
      :siffra="poang"
      :siffra-etikett="`poäng · ${SIDA_NAMN.lag1} – ${SIDA_NAMN.lag2}`"
      :rad="varfor(scores)"
      :knapp="knapp"
      :kan-ga-vidare="avslut.kanGaVidare.value"
      @vidare="emit('finish')"
    >
      <template #fore>
        <div class="fa__lag">
          <section v-for="id in teams" :key="id" class="fa__sida amber-frame">
            <header class="fa__namn"><SidFigur :sida="SIDA_FOR_LAG[id]" :size="44" :headset="false" />{{ SIDA_NAMN[id] }}</header>
            <div class="fa__bilder">
              <!-- 1 · livsviktig säkrad? -->
              <div class="fa__steg">
                <span class="fa__kort" :class="{ 'fa__kort--bort': steg >= 1 && !scores[id].securedCritical }">
                  <VaraBild :vara="store.state.critical[id]" :size="72" />
                  <b v-if="steg >= 1" class="fa__stampel" :class="scores[id].securedCritical ? 'ok' : 'bad'">{{ scores[id].securedCritical ? '✓' : '0' }}</b>
                </span>
              </div>
              <!-- 2 · mynt kvar = poäng -->
              <div v-if="steg >= 2 && scores[id].securedCritical" class="fa__steg fa__in">
                <MyntStapel :kr="scores[id].capitalLeft" liten />
              </div>
              <!-- 3 · rätt gissning ×2 -->
              <div v-if="steg >= 3 && scores[id].securedCritical" class="fa__steg fa__in">
                <span class="fa__x2" :class="{ 'fa__x2--miss': !scores[id].guessedRight }">×2</span>
              </div>
            </div>
          </section>
        </div>
      </template>
      <template #spanning>
        <div class="fa__rakna">
          <div v-for="id in teams" :key="id" class="fa__rakna-sida">
            <span class="fa__rakna-namn">{{ SIDA_NAMN[id] }}</span>
            <span class="fa__rakna-tal">{{ raknat[id] }}</span>
          </div>
        </div>
      </template>
    </AvslutRuta>
  </div>
</template>

<style scoped>
.fa {
  height: 100%;
  display: flex;
  overflow-y: auto;
}
.fa__lag {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  width: min(92vw, 900px);
}
.fa__sida {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  background: var(--color-background-2);
  text-align: left;
}
.fa__namn {
  font-family: var(--font-retro);
  font-size: clamp(26px, 2.8vw, 38px);
  color: var(--color-primary);
}
.fa__namn {
  display: flex;
  align-items: center;
  gap: 10px;
}
.fa__bilder {
  display: flex;
  align-items: flex-end;
  gap: 18px;
  min-height: 110px;
}
.fa__steg {
  display: flex;
  align-items: flex-end;
}
.fa__in {
  animation: fa-in 0.35s var(--ease-out) both;
}
.fa__kort {
  position: relative;
  display: inline-flex;
  padding: 6px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  transition: opacity 300ms, filter 300ms;
}
.fa__kort--bort {
  opacity: 0.45;
  filter: grayscale(1);
}
.fa__stampel {
  position: absolute;
  right: -10px;
  bottom: -8px;
  font-family: var(--font-rubrik);
  font-size: 34px;
  line-height: 1;
  padding: 2px 10px 4px;
  border-radius: 10px;
  transform: rotate(-8deg);
  animation: fa-stampel 220ms cubic-bezier(0.55, 0, 1, 0.45) both;
}
.fa__stampel.ok { background: #7ad14f; color: #0b1a07; }
.fa__stampel.bad { background: var(--color-danger); color: #fff; }
.fa__x2 {
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 46px;
  line-height: 1;
  color: #ff3cc8;
}
.fa__x2--miss {
  color: var(--color-ink-muted);
  text-decoration: line-through;
  opacity: 0.6;
}
@keyframes fa-stampel {
  from { opacity: 0; transform: rotate(-14deg) scale(2); }
}
.fa__rakna {
  display: flex;
  gap: clamp(40px, 8vw, 120px);
  justify-content: center;
}
.fa__rakna-sida {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.fa__rakna-namn {
  font-family: var(--font-mono);
  letter-spacing: 0.2em;
  color: var(--color-ink-muted);
}
.fa__rakna-tal {
  font-family: var(--font-retro);
  font-size: clamp(64px, 9vw, 130px);
  color: var(--color-primary);
  text-shadow: var(--glow-strong);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
@keyframes fa-in {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
}
</style>
