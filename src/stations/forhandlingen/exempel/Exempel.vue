<script setup lang="ts">
/**
 * EXEMPELFÖRHANDLINGEN (~1 min, docs/FORSLAG-EXEMPELFORHANDLING.md): en förinspelad runda som visar HUR man tänker —
 * bluffen, samrådet mellan sändebud och rapportör, och rapportörens resonemang i gissningen. Tre lager:
 *   3D-scenen (public/entre/exempel-3d.html): kameran går till den som pratar, sidfärger A/B.
 *   Scenbilden: fyra fasta ungdomar (genererade med Förhandlingens bildbank som stilreferens).
 *   HUD: luckorna, A:s och B:s pengar, LIVSVIKTIG — så att det syns att bluffen lönade sig.
 * Båda skärmarna räknar samma läge ur samma starttid (schema.ts); rösten spelas bara från ledaren.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { audio } from '@/station-kit/audio/AudioEngine'
import { useI18n } from '@/station-kit/i18n'
import manus from './manus.json'
import { byggSchema, lageVid } from './schema'
import MarknadsVagg from '../components/MarknadsVagg.vue'
import VaraBild from '../components/VaraBild.vue'
import type { HatchCell } from '../store/gameStore'

const props = defineProps<{ startAt: number; leader: boolean }>()
const emit = defineEmits<{ done: []; skip: [] }>()
const { t } = useI18n()

const BAS = import.meta.env.BASE_URL
const schema = byggSchema()
const roller = (manus as unknown as { roller: Record<string, { namn: string; sida?: 'A' | 'B'; roll?: string }> }).roller
const LIVS_A = (manus as unknown as { livsviktig: { A: string } }).livsviktig.A

const nu = ref(Date.now())
// Starttiden låses vid mount: en reserv-Date.now() i föräldern får inte nollställa tidslinjen vid omrendering.
const start = props.startAt
const tid = computed(() => Math.max(0, (nu.value - start) / 1000))
const lage = computed(() => lageVid(schema, tid.value))
// Klockan på en timer (inte rAF): tidslinjen och rösten ska gå vidare även om fönstret inte ritas just då.
let klocka: ReturnType<typeof setInterval> | undefined

// --- 3D-scenen styrs replik för replik ---
const scen3d = ref<HTMLIFrameElement | null>(null)
function styr3d() {
  const r = lage.value.replik
  const roll = r ? roller[r.vem] : null
  const talar = roll?.sida ? { sida: roll.sida, vem: r!.vem.startsWith('sandebud') ? 'sandebud' : 'rapportor' } : null
  const kamera = lage.value.gissar && !talar ? 'bred' : undefined
  scen3d.value?.contentWindow?.postMessage({ type: 'exempel', talar, viskar: !!r?.viskar, kamera }, '*')
}
watch(() => [lage.value.replik?.id, lage.value.gissar], styr3d)
function onMeddelande(e: MessageEvent) {
  if (e.data?.type === 'exempel-3d-redo') styr3d()
}

// --- Rösten: bara ledaren, en gång per replik ---
let spelad = ''
let rost: HTMLAudioElement | null = null
watch(
  () => lage.value.replik?.id,
  (id) => {
    if (!id || id === spelad || !props.leader || audio.muted) return
    spelad = id
    rost?.pause()
    rost = new Audio(`${BAS}exempel/vo/${id}.mp3`)
    const r = lage.value.replik!
    // Kommer vi in sent (följare eller omladdning) — hoppa till rätt ställe i repliken.
    rost.currentTime = Math.max(0, tid.value - r.t)
    void rost.play().catch(() => {})
  },
)
// Klubbslag och lucka: stationens egna ljud (bara ledaren, så de inte dubbleras).
watch(
  () => lage.value.klubbat.length,
  (n, gammal) => {
    if (props.leader && n > (gammal ?? 0)) audio.play('klubba')
  },
)
watch(
  () => lage.value.lucka,
  (n, gammal) => {
    if (props.leader && n > (gammal ?? -1)) audio.play('hatch')
  },
)
watch(
  () => lage.value.klar,
  (k) => {
    if (k) emit('done')
  },
)

// --- HUD ---
const SIDA = { A: 'lag1', B: 'lag2' } as const
const cells = computed<HatchCell[]>(() =>
  schema.luckor.map((l, i) => {
    const k = lage.value.klubbat.find((x) => x.lucka === i)
    if (k) return { index: i, hatch: i + 1, kind: 'won', winner: SIDA[k.vinnare], resource: l.vara, price: k.pris }
    if (i === lage.value.lucka && lage.value.oppen) return { index: i, hatch: i + 1, kind: 'active', winner: null, resource: l.vara, price: null }
    return { index: i, hatch: i + 1, kind: 'upcoming', winner: null, resource: null, price: null }
  }),
)
const aktivVara = computed(() => (lage.value.lucka >= 0 && lage.value.oppen ? schema.luckor[lage.value.lucka].vara : null))
const livsUppe = computed(() => aktivVara.value === LIVS_A)

const talare = computed(() => {
  const r = lage.value.replik
  if (!r) return null
  const roll = roller[r.vem]
  return { ...r, namn: roll?.namn ?? '', sida: roll?.sida ?? null, roll: roll?.roll ?? '' }
})
const kanHoppa = computed(() => tid.value > 15)

onMounted(() => {
  window.addEventListener('message', onMeddelande)
  klocka = setInterval(() => (nu.value = Date.now()), 80)
})
onUnmounted(() => {
  clearInterval(klocka)
  window.removeEventListener('message', onMeddelande)
  rost?.pause()
})
</script>

<template>
  <div class="ex">
    <iframe ref="scen3d" class="ex__3d" :src="`${BAS}entre/exempel-3d.html`" title="Exempelförhandlingen i 3D" />
    <div class="ex__dimma" />

    <div class="ex__rec"><i />{{ t('exempel.inspelning') }}</div>

    <!-- Scenbilden: känslan -->
    <Transition name="ex-foto" mode="out-in">
      <figure v-if="lage.bild" :key="lage.bild" class="ex__foto">
        <img :src="`${BAS}exempel/scen/${lage.bild}.jpg`" alt="" />
      </figure>
    </Transition>

    <!-- Repliken -->
    <Transition name="ex-bubbla" mode="out-in">
      <div
        v-if="talare"
        :key="talare.id"
        class="ex__bubbla"
        :class="[talare.vem === 'valdi' ? 'ex__bubbla--valdi' : `ex__bubbla--${talare.sida}`, { 'ex__bubbla--viskar': talare.viskar }]"
      >
        <small>
          {{ talare.vem === 'valdi' ? 'VALDI' : `${talare.namn} · ${talare.roll} ${talare.sida}` }}<template v-if="talare.viskar"> · {{ t('exempel.viskar') }}</template>
        </small>
        {{ talare.text }}
      </div>
    </Transition>

    <!-- Stämpeln vid klubbslaget -->
    <div v-if="lage.stampel" :key="`st${lage.stampel.lucka}`" class="ex__stampel">
      {{ t('klubba.sald', { sida: `SIDA ${lage.stampel.vinnare}`, pris: lage.stampel.pris }) }}
    </div>

    <!-- Utfallet i gissningen -->
    <div v-if="lage.utfall" class="ex__utfall">
      <div class="ex__utfallkort"><VaraBild vara="styrkort" :size="70" />{{ t('exempel.a_gissar') }} <b class="ok">{{ t('exempel.ratt') }}</b></div>
      <div class="ex__utfallkort ex__utfallkort--b"><VaraBild vara="branslecell" :size="70" />{{ t('exempel.b_gissar') }} <b class="bad">{{ t('exempel.lurade') }}</b></div>
    </div>

    <!-- HUD: pengarna, luckorna, LIVSVIKTIG -->
    <div class="ex__hud">
      <span class="ex__pengar ex__pengar--A"><i />{{ lage.pengar.A }}<small> kr · SIDA A</small></span>
      <span class="ex__mitt">
        <MarknadsVagg :cells="cells" liten />
        <span class="ex__livs" :class="{ 'ex__livs--uppe': livsUppe }"><VaraBild :vara="LIVS_A" :size="44" />{{ t('exempel.a_livs') }}</span>
      </span>
      <span class="ex__pengar ex__pengar--B"><small>SIDA B · </small>{{ lage.pengar.B }}<small> kr</small><i /></span>
    </div>

    <button v-if="kanHoppa" class="ex__hoppa" @click="emit('skip')">{{ t('exempel.hoppa') }}</button>
  </div>
</template>

<style scoped>
.ex {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  background: #141518;
}
.ex__3d {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}
.ex__dimma {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(90deg, rgba(5, 16, 11, 0.1), rgba(5, 16, 11, 0.45));
}
.ex__rec {
  position: absolute;
  left: 1.2rem;
  top: 1rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 1rem;
  letter-spacing: 0.18em;
  color: #ff8a73;
}
.ex__rec i {
  width: 0.8rem;
  height: 0.8rem;
  border-radius: 50%;
  background: #ff5a3c;
  box-shadow: 0 0 10px #ff5a3c;
  animation: ex-rec 1.2s ease-in-out infinite;
}
@keyframes ex-rec {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
.ex__foto {
  position: absolute;
  right: 2.5%;
  top: 6%;
  width: 38%;
  margin: 0;
  padding: 0.6rem 0.6rem 1.6rem;
  background: #f3efe6;
  transform: rotate(-2deg);
  box-shadow: 14px 18px 0 rgba(0, 0, 0, 0.45);
}
.ex__foto img {
  display: block;
  width: 100%;
}
.ex-foto-enter-active {
  transition: opacity 260ms ease-out, transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}
.ex-foto-leave-active {
  transition: opacity 180ms ease-in, transform 180ms ease-in;
}
.ex-foto-enter-from {
  opacity: 0;
  transform: rotate(-6deg) translateY(30px) scale(0.92);
}
.ex-foto-leave-to {
  opacity: 0;
  transform: rotate(2deg) translateY(-14px);
}
.ex__bubbla {
  position: absolute;
  left: 3%;
  top: 22%;
  max-width: 44%;
  padding: 0.7em 1.1em 0.8em;
  border-radius: 22px;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 2.1rem;
  line-height: 1.15;
}
.ex__bubbla small {
  display: block;
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.75;
  margin-bottom: 0.2rem;
}
.ex__bubbla--A {
  background: #fff1d6;
  color: #1d1a14;
}
.ex__bubbla--B {
  left: auto;
  right: 44%;
  background: #ff3cc8;
  color: #1d0a17;
}
.ex__bubbla--viskar {
  background: rgba(5, 16, 11, 0.94);
  color: #fff1d6;
  border: 3px dashed #fff1d6;
  font-weight: 400;
  font-style: italic;
}
.ex__bubbla--valdi {
  top: auto;
  bottom: 22%;
  left: 50%;
  max-width: 80%;
  transform: translateX(-50%);
  text-align: center;
  background: rgba(0, 0, 0, 0.82);
  border: 2px solid var(--color-primary);
  color: #ffcf8a;
}
.ex-bubbla-enter-active {
  transition: opacity 160ms ease-out, scale 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ex-bubbla-leave-active {
  transition: opacity 120ms ease-in;
}
.ex-bubbla-enter-from {
  opacity: 0;
  scale: 0.85;
}
.ex-bubbla-leave-to {
  opacity: 0;
}
.ex__stampel {
  position: absolute;
  left: 38%;
  top: 46%;
  transform: translate(-50%, -50%) rotate(-6deg);
  padding: 0.25em 0.6em 0.3em;
  border: 0.14em solid var(--color-primary);
  border-radius: 0.18em;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 3.2rem;
  color: var(--color-primary);
  background: rgba(5, 16, 11, 0.86);
  animation: ex-slag 240ms cubic-bezier(0.55, 0, 1, 0.45) both;
}
@keyframes ex-slag {
  from { opacity: 0; transform: translate(-50%, -50%) rotate(-12deg) scale(2.2); }
}
.ex__utfall {
  position: absolute;
  left: 3%;
  top: 50%;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}
.ex__utfallkort {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.5em 1em;
  border-radius: 14px;
  background: rgba(5, 16, 11, 0.92);
  border: 2px solid #fff1d6;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 1.6rem;
  animation: ex-in 300ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.ex__utfallkort--b {
  border-color: #ff3cc8;
  animation-delay: 500ms;
}
.ex__utfallkort b {
  padding: 0 0.4em;
  border-radius: 6px;
  color: #fff;
}
.ex__utfallkort b.ok { background: #7ad14f; color: #0b1a07; }
.ex__utfallkort b.bad { background: var(--color-danger); }
@keyframes ex-in {
  from { opacity: 0; transform: translateX(-20px); }
}
.ex__hud {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.4rem 1.4rem 0.8rem;
  background: linear-gradient(180deg, rgba(5, 16, 11, 0), rgba(5, 16, 11, 0.95) 40%);
}
.ex__pengar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 2.2rem;
}
.ex__pengar small {
  font-family: var(--font-mono);
  font-size: 0.9rem;
  letter-spacing: 0.1em;
}
.ex__pengar i {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: radial-gradient(circle at 40% 35%, #ffe08a, #d79a1c 70%, #8a5b07);
  border: 2px solid #6b4504;
}
.ex__pengar--A { color: #fff1d6; }
.ex__pengar--B { color: #ff3cc8; }
.ex__mitt {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.ex__livs {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.06em;
  color: #fff;
  background: var(--color-danger);
  padding: 0.15em 0.6em 0.15em 0.2em;
  border-radius: 8px;
  transition: box-shadow 300ms, transform 300ms;
}
.ex__livs--uppe {
  box-shadow: 0 0 26px rgba(255, 90, 60, 0.8);
  transform: scale(1.1);
}
.ex__hoppa {
  position: absolute;
  right: 1rem;
  top: 0.8rem;
  font-family: var(--font-retro);
  font-size: 1rem;
  color: var(--color-ink-muted);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 0.2em 0.8em;
  cursor: pointer;
}
@media (prefers-reduced-motion: reduce) {
  .ex__rec i, .ex__stampel, .ex__utfallkort { animation: none; }
}
</style>
