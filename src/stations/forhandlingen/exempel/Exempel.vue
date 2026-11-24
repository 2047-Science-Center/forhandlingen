<script setup lang="ts">
/**
 * EXEMPELFÖRHANDLINGEN (~1 min, docs/FORSLAG-EXEMPELFORHANDLING.md): en förinspelad runda som visar HUR man tänker —
 * bluffen, samrådet mellan sändebud och rapportör, och rapportörens resonemang i gissningen. Kommer EFTER bildreglerna,
 * som "så här ser det ut". Josef 2026-11-24:
 *
 *   ┌──────── 3D (vänster) ────────┬──── SIDA A:s SKÄRM (höger) ────┐
 *   │ fast vid kamera, alla fyra   │ LUCKA 2 / 3 · BRÄNSLECELL       │
 *   │ sändebud bärnsten,           │ PENGAR | luckväggen | LIVSVIKTIG│
 *   │ rapportör cyan, golvring     │ SÅLD-stämpeln, gissningen       │
 *   │ i sidfärgen                  │                                  │
 *   │ [ repliken som bubbla ]      │                                  │
 *   └──────────────────────────────┴──────────────────────────────────┘
 *
 * Rutan till höger är den riktiga skärmens uppbyggnad (som ReporterConsole) så man ser VAD som förhandlas just nu
 * och när de går vidare till nästa sak. Båda skärmarna räknar samma läge ur samma starttid (schema.ts);
 * rösten spelas bara från ledaren.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { audio } from '@/station-kit/audio/AudioEngine'
import { useI18n } from '@/station-kit/i18n'
import manus from './manus.json'
import { byggSchema, lageVid } from './schema'
import MarknadsVagg from '../components/MarknadsVagg.vue'
import VaraBild from '../components/VaraBild.vue'
import MyntStapel from '../components/MyntStapel.vue'
import type { HatchCell } from '../store/gameStore'

const props = defineProps<{ startAt: number; leader: boolean }>()
const emit = defineEmits<{ done: []; skip: [] }>()
const { t } = useI18n()

const BAS = import.meta.env.BASE_URL
const schema = byggSchema()
type RollInfo = { namn: string; sida?: 'A' | 'B'; roll?: string }
const roller = (manus as unknown as { roller: Record<string, RollInfo> }).roller
const LIVS_A = manus.livsviktig.A
const LIVS_B = manus.livsviktig.B

const nu = ref(Date.now())
// Starttiden låses vid mount: en reserv-Date.now() i föräldern får inte nollställa tidslinjen vid omrendering.
const start = props.startAt
const tid = computed(() => Math.max(0, (nu.value - start) / 1000))
const lage = computed(() => lageVid(schema, tid.value))
// Klockan på en timer (inte rAF): tidslinjen och rösten ska gå vidare även om fönstret inte ritas just då.
let klocka: ReturnType<typeof setInterval> | undefined

// --- 3D-scenen: vem som pratar (kameran står still) ---
const scen3d = ref<HTMLIFrameElement | null>(null)
function styr3d() {
  const r = lage.value.replik
  const roll = r ? roller[r.vem] : null
  const talar = roll?.sida ? { sida: roll.sida, vem: r!.vem.startsWith('sandebud') ? 'sandebud' : 'rapportor' } : null
  scen3d.value?.contentWindow?.postMessage({ type: 'exempel', talar, viskar: !!r?.viskar }, '*')
}
watch(() => lage.value.replik?.id, styr3d)
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

// --- Sida A:s skärm ---
const SIDA = { A: 'lag1', B: 'lag2' } as const
const cells = computed<HatchCell[]>(() =>
  schema.luckor.map((l, i) => {
    const k = lage.value.klubbat.find((x) => x.lucka === i)
    if (k) return { index: i, hatch: i + 1, kind: 'won', winner: SIDA[k.vinnare], resource: l.vara, price: k.pris }
    if (i === lage.value.lucka && lage.value.oppen) return { index: i, hatch: i + 1, kind: 'active', winner: null, resource: l.vara, price: null }
    return { index: i, hatch: i + 1, kind: 'upcoming', winner: null, resource: null, price: null }
  }),
)
/** Luckan som rubriken gäller (den senast öppnade), och om den just öppnats (rubriken blinkar till). */
const lucka = computed(() => (lage.value.lucka >= 0 && !lage.value.gissar ? lage.value.lucka : null))
const luckaVara = computed(() => (lucka.value != null ? schema.luckor[lucka.value].vara : null))
const nyLucka = computed(() => lucka.value != null && tid.value - schema.luckor[lucka.value].oppnas < 1.6)
const luckaSald = computed(() => (lucka.value != null ? (lage.value.klubbat.find((k) => k.lucka === lucka.value) ?? null) : null))
const livsUppe = computed(() => lage.value.oppen && luckaVara.value === LIVS_A)
/** Under VALdis inledning pekar skärmen på A:s livsviktiga ("Sida A behövde insulin"). */
const ram = computed(() => lage.value.lucka < 0)

// --- Repliken ---
const talare = computed(() => {
  const r = lage.value.replik
  if (!r) return null
  const roll = roller[r.vem]
  const typ = r.vem === 'valdi' ? 'valdi' : r.vem.startsWith('sandebud') ? 'sandebud' : 'rapportor'
  return { ...r, namn: roll?.namn ?? '', sida: roll?.sida ?? null, typ }
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
    <!-- ===== Vänster: 3D-scenen + repliken ===== -->
    <section class="ex__scen">
      <iframe ref="scen3d" class="ex__3d" :src="`${BAS}entre/exempel-3d.html`" title="Exempelförhandlingen i 3D" />
      <div class="ex__rec"><i />{{ t('exempel.inspelning') }}</div>
      <span class="ex__bpengar"><small>SIDA B</small> {{ lage.pengar.B }}<small> kr</small></span>

      <Transition name="ex-bubbla" mode="out-in">
        <div
          v-if="talare"
          :key="talare.id"
          class="ex__bubbla"
          :class="[`ex__bubbla--${talare.typ}`, { 'ex__bubbla--viskar': talare.viskar }]"
        >
          <small v-if="talare.typ === 'valdi'">VALDI</small>
          <small v-else>
            {{ talare.namn }} · {{ t(`exempel.roll_${talare.typ}`) }}
            <span class="ex__sidtagg" :class="`ex__sidtagg--${talare.sida}`">SIDA {{ talare.sida }}</span>
            <template v-if="talare.viskar"> · {{ t('exempel.viskar') }}</template>
          </small>
          {{ talare.text }}
        </div>
      </Transition>
    </section>

    <!-- ===== Höger: sida A:s skärm ===== -->
    <section class="ex__skarm">
      <p class="ex__skarm-etikett">{{ t('exempel.skarm') }}</p>

      <!-- Rubriken: vilken lucka, vilken vara — eller gissningen -->
      <Transition name="ex-rubrik" mode="out-in">
        <div v-if="lage.gissar" key="gissa" class="ex__rubrik ex__rubrik--gissa">
          <span class="ex__rubrik-nr">{{ t('exempel.gissning') }}</span>
          <b>{{ t('exempel.gissa_fraga') }}</b>
        </div>
        <div v-else-if="lucka != null" :key="`l${lucka}`" class="ex__rubrik" :class="{ 'ex__rubrik--ny': nyLucka, 'ex__rubrik--livs': livsUppe }">
          <span class="ex__rubrik-nr">{{ t('exempel.lucka', { n: lucka + 1, antal: schema.luckor.length }) }}</span>
          <b>{{ t('resource.' + luckaVara) }}</b>
          <span v-if="luckaVara === LIVS_A" class="ex__rubrik-livs">{{ t('exempel.livs_er') }}</span>
        </div>
        <div v-else key="snart" class="ex__rubrik ex__rubrik--snart">
          <span class="ex__rubrik-nr">{{ t('exempel.snart') }}</span>
        </div>
      </Transition>

      <!-- Konsolen i miniatyr: PENGAR | marknaden | LIVSVIKTIG -->
      <div class="ex__k">
        <aside class="ex__kol">
          <span class="ex__etikett">{{ t('pek.pengar_etikett') }}</span>
          <MyntStapel :kr="lage.pengar.A" liten />
          <p class="ex__regel">{{ t('fast.pengar') }}</p>
        </aside>

        <main class="ex__mitt">
          <template v-if="!lage.gissar">
            <MarknadsVagg :cells="cells" liten />
            <div class="ex__varan">
              <VaraBild v-if="luckaVara && lage.oppen" :key="luckaVara" :vara="luckaVara" :size="110" class="ex__varabild" />
              <div v-if="luckaSald" :key="`st${luckaSald.lucka}`" class="ex__stampel">
                {{ t('klubba.sald', { sida: `SIDA ${luckaSald.vinnare}`, pris: luckaSald.pris }) }}
              </div>
            </div>
          </template>
          <!-- Gissningen: B köpte styrkortet och bränslecellen — vilken var den livsviktiga? -->
          <div v-else class="ex__gissa">
            <div class="ex__gkort" :class="{ 'ex__gkort--ratt': lage.utfall }">
              <VaraBild :vara="LIVS_B" :size="80" />
              <span>{{ t('resource.' + LIVS_B) }}</span>
              <b v-if="lage.utfall" class="ok">{{ t('exempel.ratt') }}</b>
            </div>
            <div class="ex__gkort ex__gkort--av">
              <VaraBild vara="branslecell" :size="80" />
              <span>{{ t('resource.branslecell') }}</span>
            </div>
            <p v-if="lage.utfall" class="ex__bgissar">
              {{ t('exempel.b_gissar') }} <b class="bad">{{ t('exempel.lurade') }}</b>
            </p>
          </div>
        </main>

        <aside class="ex__kol ex__kol--livs" :class="{ 'ex__kol--fokus': livsUppe || ram }">
          <span class="ex__tagg">{{ t('critical.tagg') }}</span>
          <VaraBild :vara="LIVS_A" :size="70" />
          <span class="ex__namn">{{ t('resource.' + LIVS_A) }}</span>
          <p class="ex__regel">{{ t('fast.livs') }}</p>
        </aside>
      </div>
    </section>

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
  display: grid;
  grid-template-columns: 54% 46%;
}

/* ---------- Vänster: 3D ---------- */
.ex__scen {
  position: relative;
  min-width: 0;
}
.ex__3d {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
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
/* B:s pengar som en liten skylt på B:s sida — så att det syns att bluffen kostade dem */
.ex__bpengar {
  position: absolute;
  right: 1rem;
  top: 0.8rem;
  padding: 0.1em 0.6em;
  border: 2px solid #ff3cc8;
  border-radius: 8px;
  background: rgba(5, 16, 11, 0.85);
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 1.6rem;
  color: #ff3cc8;
}
.ex__bpengar small {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  letter-spacing: 0.1em;
}

.ex__bubbla {
  position: absolute;
  left: 3%;
  right: 3%;
  bottom: 3%;
  padding: 0.6em 1em 0.7em;
  border-radius: 18px;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 2rem;
  line-height: 1.15;
  box-shadow: 0 10px 0 rgba(0, 0, 0, 0.35);
}
.ex__bubbla small {
  display: flex;
  align-items: center;
  gap: 0.4em;
  flex-wrap: wrap;
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 0.9rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}
/* Rollfärgerna (samma som figurerna i 3D): sändebud bärnsten, rapportör cyan */
.ex__bubbla--sandebud {
  background: #ff9500;
  color: #1d1205;
}
.ex__bubbla--rapportor {
  background: #35e0d0;
  color: #04201d;
}
.ex__bubbla--viskar {
  background: rgba(5, 16, 11, 0.95);
  border: 3px dashed currentColor;
  font-weight: 400;
  font-style: italic;
}
.ex__bubbla--viskar.ex__bubbla--sandebud { color: #ff9500; }
.ex__bubbla--viskar.ex__bubbla--rapportor { color: #35e0d0; }
.ex__bubbla--valdi {
  text-align: center;
  background: rgba(0, 0, 0, 0.88);
  border: 2px solid var(--color-primary);
  color: #ffcf8a;
}
.ex__bubbla--valdi small {
  justify-content: center;
}
/* Sidtaggen i sidfärgen */
.ex__sidtagg {
  padding: 0 0.5em;
  border-radius: 5px;
  font-weight: 700;
  color: #1a1014;
}
.ex__sidtagg--A { background: #fff1d6; }
.ex__sidtagg--B { background: #ff3cc8; }
.ex-bubbla-enter-active {
  transition: opacity 160ms ease-out, transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ex-bubbla-leave-active {
  transition: opacity 120ms ease-in;
}
.ex-bubbla-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.ex-bubbla-leave-to {
  opacity: 0;
}

/* ---------- Höger: sida A:s skärm ---------- */
.ex__skarm {
  position: relative;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 0.9rem 1rem 1rem;
  background: var(--color-background);
  border-left: 3px solid #fff1d6;
  box-shadow: inset 12px 0 30px rgba(0, 0, 0, 0.5);
}
.ex__skarm-etikett {
  margin: 0;
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 0.95rem;
  letter-spacing: 0.16em;
  color: #fff1d6;
}

.ex__rubrik {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.2rem 0.8rem;
  padding: 0.5rem 0.9rem;
  border-radius: 12px;
  border: 2px solid rgba(var(--mode-accent-rgb), 0.5);
  background: rgba(var(--mode-accent-rgb), 0.08);
  transition: box-shadow 400ms, background 400ms;
}
.ex__rubrik-nr {
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 1.1rem;
  letter-spacing: 0.12em;
  color: var(--color-primary);
}
.ex__rubrik b {
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 2.3rem;
  line-height: 1;
  color: var(--color-ink-strong);
}
.ex__rubrik--ny {
  background: rgba(var(--mode-accent-rgb), 0.28);
  box-shadow: 0 0 30px rgba(var(--mode-accent-rgb), 0.5);
}
.ex__rubrik--livs {
  border-color: var(--color-danger);
  background: rgba(255, 90, 60, 0.14);
}
.ex__rubrik-livs {
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 1.1rem;
  color: #fff;
  background: var(--color-danger);
  padding: 0.05em 0.5em;
  border-radius: 6px;
  transform: rotate(-3deg);
}
.ex__rubrik--snart .ex__rubrik-nr {
  color: var(--color-ink-muted);
}
.ex__rubrik--gissa b {
  font-size: 1.7rem;
}
.ex-rubrik-enter-active {
  transition: opacity 220ms ease-out, transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
}
.ex-rubrik-leave-active {
  transition: opacity 140ms ease-in;
}
.ex-rubrik-enter-from {
  opacity: 0;
  transform: translateX(24px);
}
.ex-rubrik-leave-to {
  opacity: 0;
}

.ex__k {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 29% 1fr 29%;
  gap: 0.6rem;
}
.ex__kol {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.6rem 0.4rem;
  border-radius: 14px;
  border: 2px solid rgba(255, 255, 255, 0.08);
  text-align: center;
  transition: border-color 300ms, box-shadow 300ms;
}
.ex__kol--fokus {
  border-color: var(--color-danger);
  box-shadow: 0 0 30px rgba(255, 90, 60, 0.45);
}
.ex__kol :deep(.ms) {
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}
.ex__kol :deep(.ms__summa) {
  font-size: 2rem;
}
.ex__etikett {
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.14em;
  color: var(--color-ink-muted);
}
.ex__tagg {
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 0.95rem;
  letter-spacing: 0.06em;
  color: #fff;
  background: var(--color-danger);
  padding: 0.05em 0.5em;
  border-radius: 6px;
  transform: rotate(-4deg);
}
.ex__namn {
  font-family: var(--font-retro);
  font-size: 1.3rem;
  color: var(--color-ink-strong);
}
.ex__regel {
  margin: 0;
  font-family: var(--font-retro);
  font-size: 1rem;
  line-height: 1.2;
  color: var(--color-ink-strong);
}

.ex__mitt {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}
.ex__varan {
  position: relative;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ex__varabild {
  animation: ex-in 380ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.ex__stampel {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) rotate(-6deg);
  white-space: nowrap;
  padding: 0.2em 0.5em 0.25em;
  border: 0.14em solid var(--color-primary);
  border-radius: 0.18em;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 1.25rem;
  color: var(--color-primary);
  background: rgba(5, 16, 11, 0.9);
  animation: ex-slag 240ms cubic-bezier(0.55, 0, 1, 0.45) both;
}
@keyframes ex-slag {
  from { opacity: 0; transform: translate(-50%, -50%) rotate(-12deg) scale(2.2); }
}
@keyframes ex-in {
  from { opacity: 0; transform: translateY(16px) scale(0.9); }
}

.ex__gissa {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.8rem;
}
.ex__gkort {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 0.6rem 0.8rem;
  border-radius: 12px;
  border: 2px solid rgba(255, 255, 255, 0.25);
  font-family: var(--font-retro);
  font-size: 1.1rem;
  color: var(--color-ink-strong);
  transition: border-color 300ms, box-shadow 300ms;
}
.ex__gkort--ratt {
  border-color: #7ad14f;
  box-shadow: 0 0 26px rgba(122, 209, 79, 0.5);
}
.ex__gkort--av {
  opacity: 0.5;
}
.ex__gkort b,
.ex__bgissar b {
  padding: 0 0.4em;
  border-radius: 6px;
  font-family: var(--font-rubrik);
}
.ok { background: #7ad14f; color: #0b1a07; }
.bad { background: var(--color-danger); color: #fff; }
.ex__bgissar {
  flex-basis: 100%;
  margin: 0;
  text-align: center;
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 1.2rem;
  color: #ff3cc8;
  animation: ex-in 300ms 500ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.ex__hoppa {
  position: absolute;
  right: 1rem;
  bottom: 0.8rem;
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
  .ex__rec i, .ex__stampel, .ex__varabild, .ex__bgissar { animation: none; }
}
</style>
