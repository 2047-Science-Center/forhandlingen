<script setup lang="ts">
/**
 * TESTRUNDANS GENOMGÅNG (Josef 2026-11-26): efter testrundan klickar sidan sig igenom vad som hände, så att det
 * man just försökt lära sig förstärks:
 *   en takt per lucka  — vem som klubbade och för hur mycket, hur mycket ni har kvar, och TYDLIG markering när
 *                        det var er livsviktiga (fick ni den eller inte → 0 poäng i skarpt läge)
 *   gissningen         — vad ni gissade, vad som var rätt, ×2 eller inte
 *   poängen            — vad testrundan hade gett, och att den inte räknas → KÖR SKARPT
 * Självtempo per skärm (NÄSTA/TILLBAKA). Läser bara det synkade spelläget — rör inget.
 */
import { computed, ref } from 'vue'
import type { TeamId } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { scoreTeam } from '../engine/scoring'
import { useI18n } from '@/station-kit/i18n'
import { audio } from '@/station-kit/audio/AudioEngine'
import VaraBild from '../components/VaraBild.vue'
import MyntStapel from '../components/MyntStapel.vue'

const props = defineProps<{ team: TeamId }>()
const emit = defineEmits<{ klar: [] }>()
const store = useGameStore()
const { t } = useI18n()

const s = computed(() => store.state)
const mot = computed<TeamId>(() => (props.team === 'lag1' ? 'lag2' : 'lag1'))
const sidaNamn = (team: TeamId) => `SIDA ${team === 'lag1' ? 'A' : 'B'}`
const kapital = computed(() => s.value.capital[props.team] + Object.values(s.value.results).reduce((n, r) => n + (r.winner === props.team ? r.price : 0), 0))

type Takt =
  | { typ: 'lucka'; nr: number; vara: string; vinnare: TeamId | null; pris: number; kvar: number; livs: boolean }
  | { typ: 'gissning'; val: string | null; facit: string; ratt: boolean }
  | { typ: 'poang' }

const takter = computed<Takt[]>(() => {
  const ut: Takt[] = []
  let kvar = kapital.value
  s.value.order.forEach((vara, i) => {
    const r = s.value.results[i]
    const vinnare = r?.winner ?? null
    const pris = r?.price ?? 0
    if (vinnare === props.team) kvar -= pris
    ut.push({ typ: 'lucka', nr: i + 1, vara, vinnare, pris, kvar, livs: vara === s.value.critical[props.team] })
  })
  const val = s.value.guesses[props.team]
  const facit = s.value.critical[mot.value]
  ut.push({ typ: 'gissning', val, facit, ratt: val === facit })
  ut.push({ typ: 'poang' })
  return ut
})
const poang = computed(() => scoreTeam(s.value, props.team))

const steg = ref(0)
const takt = computed(() => takter.value[steg.value])
const sista = computed(() => steg.value === takter.value.length - 1)
function nasta() {
  audio.play('blip')
  if (sista.value) emit('klar')
  else steg.value += 1
}
function tillbaka() {
  audio.play('blip')
  if (steg.value > 0) steg.value -= 1
}
</script>

<template>
  <div class="pg">
    <p class="pg__rubrik">{{ t('genomgang.rubrik') }}</p>

    <Transition name="pg-takt" mode="out-in">
      <!-- En lucka -->
      <section v-if="takt.typ === 'lucka'" :key="`l${takt.nr}`" class="pg__takt" :class="{ 'pg__takt--livs': takt.livs }">
        <p class="pg__nr">{{ t('genomgang.lucka', { n: takt.nr, antal: s.order.length }) }}</p>
        <div class="pg__rad">
          <div class="pg__vara">
            <span v-if="takt.livs" class="pg__tagg">{{ t('critical.tagg') }}</span>
            <VaraBild :vara="takt.vara" :size="130" />
            <b>{{ t('resource.' + takt.vara) }}</b>
          </div>
          <div class="pg__text">
            <p v-if="takt.vinnare === team" class="pg__vad">{{ t('genomgang.ni_klubbade', { pris: takt.pris }) }}</p>
            <p v-else-if="takt.vinnare" class="pg__vad">{{ t('genomgang.de_klubbade', { sida: sidaNamn(takt.vinnare), pris: takt.pris }) }}</p>
            <p v-else class="pg__vad">{{ t('genomgang.ingen') }}</p>
            <div class="pg__pengar">
              <MyntStapel :kr="takt.kvar" liten />
              <span>{{ t('genomgang.kvar', { kr: takt.kvar }) }}</span>
            </div>
            <p v-if="takt.livs" class="pg__livs" :class="takt.vinnare === team ? 'pg__livs--ok' : 'pg__livs--miss'">
              {{ takt.vinnare === team ? t('genomgang.livs_fick') : t('genomgang.livs_miss') }}
            </p>
          </div>
        </div>
      </section>

      <!-- Gissningen -->
      <section v-else-if="takt.typ === 'gissning'" key="g" class="pg__takt">
        <p class="pg__nr">{{ t('genomgang.gissning') }}</p>
        <div class="pg__rad">
          <div class="pg__kort" :class="takt.ratt ? 'pg__kort--ok' : 'pg__kort--miss'">
            <small>{{ t('genomgang.ni_gissade') }}</small>
            <VaraBild v-if="takt.val" :vara="takt.val" :size="100" />
            <b>{{ takt.val ? t('resource.' + takt.val) : t('genomgang.ingen_gissning') }}</b>
          </div>
          <div class="pg__kort pg__kort--facit">
            <small>{{ t('genomgang.facit', { sida: sidaNamn(mot) }) }}</small>
            <VaraBild :vara="takt.facit" :size="100" />
            <b>{{ t('resource.' + takt.facit) }}</b>
          </div>
        </div>
        <p class="pg__livs" :class="takt.ratt ? 'pg__livs--ok' : 'pg__livs--miss'">
          {{ takt.ratt ? t('genomgang.gissa_ratt') : t('genomgang.gissa_fel') }}
        </p>
      </section>

      <!-- Poängen -->
      <section v-else key="p" class="pg__takt">
        <p class="pg__nr">{{ t('genomgang.poang') }}</p>
        <p class="pg__summa">{{ poang.teamScore }}<small> {{ t('genomgang.p') }}</small></p>
        <p class="pg__formel">
          <template v-if="!poang.securedCritical">{{ t('genomgang.formel_noll') }}</template>
          <template v-else-if="poang.guessedRight">{{ t('genomgang.formel_x2', { kr: poang.capitalLeft }) }}</template>
          <template v-else>{{ t('genomgang.formel', { kr: poang.capitalLeft }) }}</template>
        </p>
        <p class="pg__rakna">{{ t('genomgang.raknas_inte') }}</p>
      </section>
    </Transition>

    <div class="pg__nav">
      <button class="crt-button pg__btn" :disabled="steg === 0" @click="tillbaka">◂ {{ t('onboarding.back') }}</button>
      <div class="pg__dots"><span v-for="(_, i) in takter" :key="i" class="pg__dot" :class="{ 'pg__dot--nu': i === steg }" /></div>
      <button class="crt-button crt-button--strong pg__btn" @click="nasta">{{ sista ? t('prov.kor') : t('onboarding.next') }} ▸</button>
    </div>
  </div>
</template>

<style scoped>
.pg {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem 1.4rem 0.8rem;
}
.pg__rubrik {
  margin: 0;
  text-align: center;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 2.2rem;
  letter-spacing: 0.06em;
  color: var(--color-primary);
}
.pg__takt {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.2rem;
  padding: 1rem;
  border-radius: 18px;
  border: 2px solid rgba(var(--mode-accent-rgb), 0.35);
}
.pg__takt--livs {
  border: 4px solid var(--color-danger);
  box-shadow: 0 0 40px rgba(255, 90, 60, 0.45), inset 0 0 60px rgba(255, 90, 60, 0.18);
}
.pg__nr {
  margin: 0;
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 1.3rem;
  letter-spacing: 0.14em;
  color: var(--color-primary);
}
.pg__rad {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3rem;
}
.pg__vara {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}
.pg__vara b,
.pg__kort b {
  font-family: var(--font-rubrik);
  font-size: 1.8rem;
  color: var(--color-ink-strong);
}
.pg__tagg {
  position: absolute;
  top: -0.8rem;
  left: 50%;
  transform: translateX(-50%) rotate(-5deg);
  z-index: 1;
  white-space: nowrap;
  padding: 0.05em 0.6em;
  border-radius: 6px;
  background: var(--color-danger);
  color: #fff;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 1.2rem;
}
.pg__text {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  max-width: 30rem;
}
.pg__vad {
  margin: 0;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 2.2rem;
  line-height: 1.15;
  color: var(--color-ink-strong);
}
.pg__pengar {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-family: var(--font-retro);
  font-size: 1.5rem;
  color: var(--color-ink-muted);
}
.pg__livs {
  margin: 0;
  padding: 0.35em 0.8em;
  border-radius: 10px;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 1.6rem;
  line-height: 1.2;
  animation: pg-in 360ms 250ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.pg__livs--ok { background: #7ad14f; color: #0b1a07; }
.pg__livs--miss { background: var(--color-danger); color: #fff; }
.pg__kort {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 0.8rem 1.4rem;
  border-radius: 14px;
  border: 3px solid rgba(255, 255, 255, 0.25);
}
.pg__kort small {
  font-family: var(--font-mono);
  font-size: 0.95rem;
  letter-spacing: 0.12em;
  color: var(--color-ink-muted);
}
.pg__kort--ok { border-color: #7ad14f; box-shadow: 0 0 24px rgba(122, 209, 79, 0.45); }
.pg__kort--miss { border-color: var(--color-danger); }
.pg__kort--facit { border-style: dashed; border-color: #7ad14f; }
.pg__summa {
  margin: 0;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 5rem;
  line-height: 1;
  color: var(--color-ink-strong);
}
.pg__summa small {
  font-size: 1.6rem;
  color: var(--color-ink-muted);
}
.pg__formel {
  margin: 0;
  font-family: var(--font-retro);
  font-size: 1.6rem;
  color: var(--color-ink-strong);
  text-align: center;
}
.pg__rakna {
  margin: 0;
  font-family: var(--font-retro);
  font-size: 1.3rem;
  color: var(--color-primary);
  text-align: center;
}
.pg__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.pg__btn {
  font-size: 1.4rem;
  padding: 0.4em 1.4em;
}
.pg__dots {
  display: flex;
  gap: 0.5rem;
}
.pg__dot {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  border: 2px solid var(--color-primary);
}
.pg__dot--nu {
  background: var(--color-primary);
}
.pg-takt-enter-active {
  transition: opacity 220ms ease-out, transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
}
.pg-takt-leave-active {
  transition: opacity 120ms ease-in;
}
.pg-takt-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.pg-takt-leave-to {
  opacity: 0;
}
@keyframes pg-in {
  from { opacity: 0; transform: scale(0.9); }
}
@media (prefers-reduced-motion: reduce) {
  .pg__livs { animation: none; }
}
</style>
