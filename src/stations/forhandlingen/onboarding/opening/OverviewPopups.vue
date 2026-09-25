<script setup lang="ts">
/**
 * Öppningsskärm 3 — tre överblicks-pop-ups (hur man vinner). Klick vidare
 * genom var och en. Minimal text (bara raden), tung visuell — återanvänder
 * animationsvokabulären: resurskort, LIVSVIKTIG-stämpel, kapitalräknare, ×2.
 *   1) Livsviktig resurs → SÄKRAD vs 0 POÄNG (kontrast).
 *   2) Spendera lite → KVAR = POÄNG (snål vs slösig).
 *   3) Gissa rätt på motståndarens livsviktiga → ×2 (och dölj din egen).
 * reduced-motion: keyframes av, allt syns ändå. SFX vid nyckelbeats.
 */
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { RESOURCE_ICONS, resourceIcon } from '../../resources'
import { useI18n } from '@/station-kit/i18n'
import { audio } from '@/station-kit/audio/AudioEngine'

const emit = defineEmits<{ finish: [] }>()
const { t } = useI18n()

const RESOURCES = Object.keys(RESOURCE_ICONS) // 5 resurser
const CRIT = 2 // styrkort = livsviktig i demon
const OPP_CRIT = 3 // motståndarens (radiosändare) i scen 3

const step = ref(0)
const elapsed = ref(0)
let raf = 0
let t0 = 0
const fired = new Set<string>()

function sfxOnce(id: string, at: number, sfx: Parameters<typeof audio.play>[0]) {
  if (elapsed.value >= at && !fired.has(id)) {
    fired.add(id)
    audio.play(sfx)
  }
}

function tick(now: number) {
  elapsed.value = (now - t0) / 1000
  // Per scen: ljud-beats. Steg 0 = marknad, 1 = livsviktig, 2 = spendera, 3 = gissa.
  if (step.value === 0) {
    sfxOnce('s0-cards', 0.15, 'hatch')
    sfxOnce('s0-bid', 1.0, 'blip')
  } else if (step.value === 1) {
    sfxOnce('s1-stamp', 0.6, 'render')
    sfxOnce('s1-ok', 1.3, 'win')
    sfxOnce('s1-zero', 2.3, 'deny')
  } else if (step.value === 2) {
    sfxOnce('s2-buy', 0.8, 'confirm')
    sfxOnce('s2-kvar', 1.6, 'blip')
    sfxOnce('s2-eq', 2.6, 'confirm')
  } else if (step.value === 3) {
    sfxOnce('s3-scan', 0.6, 'blip')
    sfxOnce('s3-right', 1.5, 'win')
    sfxOnce('s3-x2', 2.1, 'win')
  }
  raf = requestAnimationFrame(tick)
}

function restart() {
  cancelAnimationFrame(raf)
  fired.clear()
  t0 = performance.now()
  elapsed.value = 0
  raf = requestAnimationFrame(tick)
}
watch(step, restart)
onMounted(restart)
onUnmounted(() => cancelAnimationFrame(raf))

function next() {
  if (step.value >= 3) emit('finish')
  else step.value += 1
}

// Hjälpare: har elapsed passerat t?
const at = (s: number) => elapsed.value >= s
// Kapitalräknare 100 → 60.
function wallet(): number {
  const e = elapsed.value
  if (e < 0.8) return 100
  if (e > 1.6) return 60
  return Math.round(100 - 40 * ((e - 0.8) / 0.8))
}
</script>

<template>
  <div class="ov">
    <div class="ov__backdrop" />
    <div class="ov__card" :key="step">
      <!-- SCEN 0: marknad — båda valven budar om samma resurser, ingen äger dem -->
      <section v-if="step === 0" class="ov__scene">
        <span class="ov__market-label">{{ t('overview.market_label') }}</span>
        <div class="ov__market">
          <span class="ov__bidder" :class="{ 'ov__bidder--in': at(1.0) }">VALV SYD ▶ {{ t('overview.bid') }}</span>
          <div class="ov__cards">
            <div
              v-for="(id, i) in RESOURCES"
              :key="id"
              class="ov__mini amber-frame"
              :class="{ 'ov__mini--in': at(0.1) }"
              :style="{ transitionDelay: i * 0.08 + 's' }"
            >
              <span class="ov__icon">{{ resourceIcon(id) }}</span>
            </div>
          </div>
          <span class="ov__bidder" :class="{ 'ov__bidder--in': at(1.0) }">{{ t('overview.bid') }} ◀ VALV NORD</span>
        </div>
        <span class="ov__market-note">{{ t('overview.no_owner') }}</span>
        <p class="ov__text">{{ t('overview.market') }}</p>
      </section>

      <!-- SCEN 1: livsviktig resurs → SÄKRAD vs 0 -->
      <section v-else-if="step === 1" class="ov__scene">
        <div class="ov__cards">
          <div
            v-for="(id, i) in RESOURCES"
            :key="id"
            class="ov__mini amber-frame"
            :class="{ 'ov__mini--in': at(0.1), 'ov__mini--crit': i === CRIT && at(0.6) }"
          >
            <span class="ov__icon">{{ resourceIcon(id) }}</span>
            <span v-if="i === CRIT && at(0.6)" class="ov__stamp">LIVSVIKTIG</span>
          </div>
        </div>
        <div class="ov__outcomes">
          <div class="ov__out ov__out--ok" :class="{ 'ov__out--show': at(1.3) }">
            <span class="ov__out-icon">✓</span>
            <span class="ov__out-label">{{ t('overview.secured') }}</span>
          </div>
          <div class="ov__out ov__out--bad" :class="{ 'ov__out--show': at(2.3) }">
            <span class="ov__out-zero">0</span>
            <span class="ov__out-label">{{ t('overview.zero') }}</span>
          </div>
        </div>
        <div v-if="at(2.3)" class="ov__redflash" aria-hidden="true" />
        <p class="ov__text">{{ t('overview.p1') }}</p>
      </section>

      <!-- SCEN 2: spendera lite → KVAR = POÄNG -->
      <section v-else-if="step === 2" class="ov__scene">
        <div class="ov__wallet">
          <span class="ov__wallet-label">💰</span>
          <span class="ov__wallet-num mono ink-strong">{{ wallet() }}<small> kr</small></span>
          <span v-if="at(0.8) && !at(1.5)" class="ov__coins mono" aria-hidden="true">🪙🪙 −40</span>
        </div>
        <div class="ov__eq" :class="{ 'ov__eq--show': at(2.0) }">
          <span class="ov__eq-part">{{ t('overview.kept') }}</span>
          <span class="ov__eq-sign">=</span>
          <span class="ov__eq-part ink-strong">{{ t('res.points') }}</span>
        </div>
        <div class="ov__compare" :class="{ 'ov__compare--show': at(2.6) }">
          <div class="ov__cmp ov__cmp--good">
            <span class="ov__cmp-top">{{ t('overview.thrifty') }}</span>
            <span class="ov__cmp-num mono ink-strong">80<small> {{ t('overview.points_short') }}</small></span>
          </div>
          <div class="ov__cmp ov__cmp--poor">
            <span class="ov__cmp-top">{{ t('overview.wasteful') }}</span>
            <span class="ov__cmp-num mono">20<small> {{ t('overview.points_short') }}</small></span>
          </div>
        </div>
        <p class="ov__text">{{ t('overview.p2') }}</p>
      </section>

      <!-- SCEN 3: gissa rätt → ×2 (och dölj din egen) -->
      <section v-else class="ov__scene ov__scene--guess">
        <div class="ov__guess">
          <!-- Motståndaren: 5 kort med ? → skanna → RÄTT! -->
          <div class="ov__col">
            <span class="ov__col-title">🎯</span>
            <div class="ov__cards ov__cards--sm">
              <div
                v-for="(id, i) in RESOURCES"
                :key="id"
                class="ov__mini amber-frame"
                :class="{
                  'ov__mini--in': at(0.1),
                  'ov__mini--scan': !at(1.5) && at(0.6),
                  'ov__mini--hit': i === OPP_CRIT && at(1.5),
                }"
              >
                <span class="ov__icon">{{ at(1.5) && i === OPP_CRIT ? resourceIcon(id) : '?' }}</span>
              </div>
            </div>
            <span v-if="at(1.5)" class="ov__right">{{ t('overview.right') }}</span>
            <span v-if="at(2.1)" class="ov__x2">×2</span>
          </div>
          <!-- Din egen: låst/maskerad -->
          <div class="ov__col ov__col--yours">
            <span class="ov__col-title">{{ t('overview.your_critical') }}</span>
            <div class="ov__mini ov__mini--big amber-frame ov__mini--locked" :class="{ 'ov__mini--in': at(0.3) }">
              <span class="ov__icon">{{ resourceIcon(RESOURCES[CRIT]) }}</span>
              <span class="ov__lock">🔒</span>
            </div>
            <span class="ov__hide">{{ t('overview.hide_yours') }}</span>
          </div>
        </div>
        <p class="ov__text">{{ t('overview.p3') }}</p>
      </section>

      <button class="crt-button crt-button--strong ov__btn" @click="next">
        {{ t('onboarding.next') }} ▸
      </button>
      <div class="ov__dots">
        <span v-for="n in 4" :key="n" class="ov__dot" :class="{ 'ov__dot--now': n - 1 === step }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ov {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}
.ov__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(3, 12, 8, 0.82);
}
.ov__card {
  position: relative;
  width: min(56rem, 92%);
  min-height: 26rem;
  padding: 2rem;
  border: 1px solid var(--color-primary);
  border-radius: 14px;
  background: var(--color-background-2, rgba(8, 20, 14, 0.96));
  box-shadow: var(--glow-soft, 0 0 24px rgba(255, 149, 0, 0.25));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.4rem;
}
.ov__scene {
  position: relative;
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.4rem;
}
.ov__text {
  font-family: var(--font-retro);
  font-size: 1.3rem;
  line-height: 1.35;
  color: var(--color-ink-strong);
  text-align: center;
  max-width: 44rem;
  margin: 0;
}
/* Kort-vokabulär */
.ov__cards {
  display: flex;
  gap: 0.7rem;
  flex-wrap: wrap;
  justify-content: center;
}
.ov__cards--sm .ov__mini { width: 3.2rem; height: 4rem; }
.ov__mini {
  position: relative;
  width: 4.2rem;
  height: 5.2rem;
  border-radius: 8px;
  background: rgba(5, 16, 11, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.4s ease, transform 0.4s ease, box-shadow 0.3s ease;
}
.ov__mini--in { opacity: 1; transform: none; }
.ov__mini--big { width: 5.4rem; height: 6.6rem; }
.ov__icon { font-size: 1.9rem; }
.ov__mini--crit {
  transform: scale(1.5) translateY(-6px);
  z-index: 2;
  box-shadow: 0 0 22px rgba(255, 149, 0, 0.6);
}
.ov__stamp {
  position: absolute;
  bottom: -0.5rem;
  font-family: var(--font-retro);
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  color: var(--color-ink-strong);
  background: var(--color-background, #05100b);
  border: 1px solid var(--color-ink-strong);
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
  transform: rotate(-6deg);
}
.ov__mini--scan {
  box-shadow: 0 0 16px rgba(255, 149, 0, 0.5);
  animation: ov-scan 0.9s ease-in-out infinite;
}
.ov__mini--hit {
  transform: scale(1.35);
  box-shadow: 0 0 26px rgba(120, 255, 160, 0.8);
  border-color: #78ffa0;
}
.ov__mini--locked { filter: saturate(0.4) brightness(0.7); }
.ov__lock {
  position: absolute;
  font-size: 1.8rem;
  filter: drop-shadow(0 0 6px rgba(0, 0, 0, 0.7));
}
/* Scen 1 utfall */
.ov__outcomes { display: flex; gap: 1.4rem; }
.ov__out {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 0.7rem 1.2rem;
  border-radius: 10px;
  opacity: 0;
  transform: scale(0.9);
  transition: opacity 0.4s ease, transform 0.4s ease;
}
.ov__out--show { opacity: 1; transform: none; }
.ov__out--ok { border: 1px solid #78ffa0; box-shadow: 0 0 18px rgba(120, 255, 160, 0.4); }
.ov__out--bad { border: 1px solid var(--color-danger, #ff5a5a); box-shadow: 0 0 18px rgba(255, 90, 90, 0.4); }
.ov__out-icon { font-size: 1.8rem; color: #78ffa0; }
.ov__out-zero { font-family: var(--font-retro); font-size: 2.4rem; color: var(--color-danger, #ff5a5a); }
.ov__out-label {
  font-family: var(--font-retro);
  font-size: 1rem;
  letter-spacing: 0.1em;
}
.ov__out--ok .ov__out-label { color: #78ffa0; }
.ov__out--bad .ov__out-label { color: var(--color-danger, #ff5a5a); }
.ov__redflash {
  position: absolute;
  inset: -2rem;
  background: radial-gradient(circle, rgba(255, 60, 60, 0.28), transparent 70%);
  pointer-events: none;
  animation: ov-redflash 0.5s ease-out 2;
}
/* Scen 2 plånbok */
.ov__wallet { display: flex; align-items: center; gap: 0.8rem; position: relative; }
.ov__wallet-label { font-size: 2.4rem; }
.ov__wallet-num { font-size: 3rem; }
.ov__coins {
  position: absolute;
  right: -3rem;
  color: var(--color-primary);
  animation: ov-coinfly 0.7s ease-out forwards;
}
.ov__eq {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  opacity: 0;
  transition: opacity 0.4s ease;
}
.ov__eq--show { opacity: 1; }
.ov__eq-part {
  font-family: var(--font-retro);
  font-size: 1.4rem;
  letter-spacing: 0.08em;
  color: var(--color-primary);
}
.ov__eq-sign { font-family: var(--font-retro); font-size: 1.8rem; color: var(--color-ink-strong); }
.ov__compare { display: flex; gap: 1.4rem; opacity: 0; transition: opacity 0.4s ease; }
.ov__compare--show { opacity: 1; }
.ov__cmp {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.6rem 1.1rem;
  border-radius: 10px;
  border: 1px solid var(--color-primary);
}
.ov__cmp--good { box-shadow: 0 0 16px rgba(120, 255, 160, 0.35); border-color: #78ffa0; }
.ov__cmp--poor { opacity: 0.75; }
.ov__cmp-top { font-family: var(--font-retro); font-size: 0.95rem; letter-spacing: 0.08em; }
.ov__cmp-num { font-size: 1.8rem; }
.ov__cmp--good .ov__cmp-num { color: #78ffa0; }
/* Scen 3 gissning */
/* Scen 0: marknad */
.ov__market-label {
  font-family: var(--font-retro);
  font-size: 0.95rem;
  letter-spacing: 0.18em;
  color: var(--color-primary);
  opacity: 0.85;
}
.ov__market {
  display: flex;
  align-items: center;
  gap: 1.4rem;
  flex-wrap: wrap;
  justify-content: center;
}
.ov__bidder {
  font-family: var(--font-retro);
  font-size: 1rem;
  letter-spacing: 0.06em;
  color: var(--color-ink-strong);
  white-space: nowrap;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.4s ease, transform 0.4s ease;
}
.ov__bidder--in {
  opacity: 1;
  transform: none;
  animation: ov-bid 1.3s ease-in-out infinite;
}
.ov__market-note {
  font-family: var(--font-retro);
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-primary);
  opacity: 0.85;
}
@keyframes ov-bid {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}
.ov__scene--guess { justify-content: flex-start; padding-top: 0.5rem; }
.ov__guess { display: flex; gap: 2.2rem; align-items: flex-start; }
.ov__col { display: flex; flex-direction: column; align-items: center; gap: 0.6rem; position: relative; }
.ov__col-title { font-family: var(--font-retro); font-size: 1rem; letter-spacing: 0.08em; color: var(--color-primary); }
.ov__col--yours { border-left: 1px dashed rgba(255, 149, 0, 0.4); padding-left: 2rem; }
.ov__right {
  font-family: var(--font-retro);
  font-size: 1.3rem;
  color: #78ffa0;
  letter-spacing: 0.1em;
}
.ov__x2 {
  font-family: var(--font-retro);
  font-size: 2.6rem;
  color: var(--color-ink-strong);
  text-shadow: 0 0 16px var(--color-primary);
  animation: ov-pop 0.5s ease-out both;
}
.ov__hide { font-family: var(--font-retro); font-size: 0.9rem; color: var(--color-primary); opacity: 0.85; }
/* Knapp + dots */
.ov__btn { font-size: 1.2rem; }
.ov__dots { display: flex; gap: 0.5rem; }
.ov__dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  border: 1px solid var(--color-primary);
}
.ov__dot--now { background: var(--color-primary); box-shadow: 0 0 8px var(--color-primary); }
@keyframes ov-scan {
  0%, 100% { box-shadow: 0 0 10px rgba(255, 149, 0, 0.3); }
  50% { box-shadow: 0 0 22px rgba(255, 149, 0, 0.7); }
}
@keyframes ov-redflash {
  0% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes ov-coinfly {
  0% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(-40px) translateX(10px); opacity: 0; }
}
@keyframes ov-pop {
  0% { transform: scale(0.3); opacity: 0; }
  60% { transform: scale(1.25); opacity: 1; }
  100% { transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .ov__mini, .ov__out, .ov__eq, .ov__compare { transition: none; }
  .ov__mini--scan, .ov__redflash, .ov__coins, .ov__x2 { animation: none; }
  .ov__bidder--in { animation: none; }
}
</style>
