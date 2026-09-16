<script setup lang="ts">
/**
 * Enkel-demo-illustrationer (split-höger), tajmade mot `elapsed` = sekunder
 * sedan cue-starten (så samma illustration återanvänds i flera block).
 *  I1  tre kort + pengar dras långsamt från kapitalet + LIVSVIKTIG-stämpel.
 *  I2  budgivning som stegras (färre/långsammare bud) med stegrande ljud.
 *  I4  tre kort + stämpel + bultande "gör er beredda att förhandla".
 *  I4live  som I4 men 5 resurser + 100 kr grundkapital (skarp intro).
 *  roleDiff  skillnaden mellan sändebud och rapportör.
 * DEMO-värden. Reduced-motion: slutläge direkt.
 */
import { computed, watch } from 'vue'
import { resourceIcon } from '../resources'
import { RESOURCES } from '@/config'
import { audio } from '@/station-kit/audio/AudioEngine'
import { useI18n } from '@/station-kit/i18n'

const props = defineProps<{ illustration: string | null; elapsed: number }>()
const { t: tr } = useI18n()

const CARDS3 = ['insulin', 'styrkort', 'membranfilter']
const CARDS5 = RESOURCES.map((r) => r.id)
const CRIT = 0

// ---------- I1 ----------
const I1 = { cards: 1, throws: [3, 6, 9], flyDur: 1.0, stamp: 11 }
const I1_NUMS = [17, 23, 15]
const i1CardsIn = computed(() => props.elapsed >= I1.cards)
const i1Landed = computed(() => I1.throws.filter((x) => props.elapsed >= x + I1.flyDur).length)
const i1Flying = computed(() =>
  I1.throws.findIndex((x) => props.elapsed >= x && props.elapsed < x + I1.flyDur),
)
const i1Capital = computed(() => 60 - I1_NUMS.slice(0, i1Landed.value).reduce((a, b) => a + b, 0))
const i1Stamp = computed(() => props.elapsed >= I1.stamp)

// ---------- I2 ----------
const I2 = { start: 2, dur: 7 }
const I2_BIDS = [5, 15, 25, 35, 45]
const i2Step = computed(() => {
  if (props.elapsed < I2.start) return 0
  const p = Math.min(1, (props.elapsed - I2.start) / I2.dur)
  return Math.min(I2_BIDS.length - 1, Math.floor(p * (I2_BIDS.length - 1) + 0.0001))
})
const i2Bid = computed(() => I2_BIDS[i2Step.value])
const i2Bidder = computed(() => i2Step.value % 2)
watch(i2Step, (n, o) => {
  if (props.illustration === 'I2' && n > o) audio.beep(320 + n * 130, 0.11)
})

// ---------- I4 (block 2): tre kort + stämpel + bubbla ----------
const i4CardsIn = computed(() => props.elapsed >= 0.6)
const i4Stamp = computed(() => props.elapsed >= 1.6)

// ---------- I4live (skarp intro): 100 kr → flyger → 5 resurser → stämpel + ×2 ----------
const L = { moneyFly: 1.5, cardsStart: 2.5, cardStep: 0.4, stamp: 5.0, x2: 5.6 }
const lMoneyCenter = computed(() => props.elapsed < L.cardsStart)
const lMoneyFly = computed(() => props.elapsed >= L.moneyFly && props.elapsed < L.cardsStart)
const lHeader = computed(() => props.elapsed >= L.cardsStart)
const lCardShown = (i: number) => props.elapsed >= L.cardsStart + i * L.cardStep
const lStamp = computed(() => props.elapsed >= L.stamp)
const lX2 = computed(() => props.elapsed >= L.x2)
</script>

<template>
  <div class="stage amber-frame">
    <!-- I1 -->
    <template v-if="illustration === 'I1'">
      <div class="stage__head">
        <span class="stage__label">KAPITAL</span>
        <span :key="i1Capital" class="stage__cap mono ink-strong">{{ i1Capital }}<small> kr</small></span>
      </div>
      <div class="cards">
        <div
          v-for="(id, i) in CARDS3"
          :key="id"
          class="card amber-frame"
          :class="{ 'card--in': i1CardsIn }"
          :style="{ transitionDelay: i * 100 + 'ms' }"
        >
          <span class="card__icon">{{ resourceIcon(id) }}</span>
          <span class="card__name">{{ tr('resource.' + id) }}</span>
          <span v-if="i1Landed > i" class="card__price mono">−{{ I1_NUMS[i] }} kr</span>
          <span v-if="i1Flying === i" :key="'fly' + i" class="card__fly mono">−{{ I1_NUMS[i] }}</span>
          <template v-if="i1Stamp && i === CRIT">
            <span class="card__stamp">LIVSVIKTIG</span>
            <span class="card__help">{{ tr('intro.must_win') }}</span>
          </template>
        </div>
      </div>
    </template>

    <!-- I2 -->
    <template v-else-if="illustration === 'I2'">
      <div class="cards cards--one">
        <div class="card card--big amber-frame">
          <span class="card__icon">{{ resourceIcon(CARDS3[0]) }}</span>
          <span class="card__name">{{ tr('resource.' + CARDS3[0]) }}</span>
          <span :key="i2Bid" class="card__bid mono" :class="i2Bidder === 0 ? 'bid--a' : 'bid--b'">{{ i2Bid }} kr</span>
          <span class="card__bidders">▲ budgivning ▲</span>
        </div>
      </div>
    </template>

    <!-- I4 (block 2): tre kort + stämpel + bubbla -->
    <template v-else-if="illustration === 'I4'">
      <div class="bubble">{{ tr('intro.get_ready') }}</div>
      <div class="cards">
        <div
          v-for="(id, i) in CARDS3"
          :key="id"
          class="card amber-frame"
          :class="{ 'card--in': i4CardsIn }"
          :style="{ transitionDelay: i * 100 + 'ms' }"
        >
          <span class="card__icon">{{ resourceIcon(id) }}</span>
          <span class="card__name">{{ tr('resource.' + id) }}</span>
          <span v-if="i4Stamp && i === CRIT" class="card__stamp">LIVSVIKTIG</span>
        </div>
      </div>
    </template>

    <!-- I4live (skarp intro): 100 kr → flyger → 5 resurser → stämpel + ×2 -->
    <template v-else-if="illustration === 'I4live'">
      <!-- 100 kr i mitten som sedan flyger till sidan -->
      <div v-if="lMoneyCenter" class="lmoney mono ink-strong" :class="{ 'lmoney--fly': lMoneyFly }">
        100<small> kr</small>
      </div>
      <!-- Header-kapital (dit pengarna flög) + 5 resurser + stämpel/×2 -->
      <template v-if="lHeader">
        <div class="stage__head">
          <span class="stage__label">KAPITAL</span>
          <span class="stage__cap mono ink-strong">100<small> kr</small></span>
        </div>
        <div class="cards cards--five">
          <div v-for="(id, i) in CARDS5" :key="id" class="card amber-frame" :class="{ 'card--in': lCardShown(i) }">
            <span class="card__icon">{{ resourceIcon(id) }}</span>
            <span class="card__name">{{ tr('resource.' + id) }}</span>
            <span v-if="lStamp && i === CRIT" class="card__stamp">LIVSVIKTIG</span>
            <span v-if="lX2 && i === CRIT" class="card__x2">×2</span>
          </div>
        </div>
        <p v-if="lX2" class="lx2text">{{ tr('intro.double_on_right_guess') }}</p>
      </template>
    </template>

    <!-- roleDiff -->
    <template v-else-if="illustration === 'roleDiff'">
      <div class="roles">
        <div class="role amber-frame" :class="{ 'role--in': elapsed >= 0.5 }">
          <span class="role__icon">🎧</span>
          <span class="role__name">{{ tr('role.A') }}</span>
          <span class="role__desc">{{ tr('onboarding.roles.negotiator_desc') }}</span>
        </div>
        <div class="role amber-frame" :class="{ 'role--in': elapsed >= 1.2 }">
          <span class="role__icon">👂</span>
          <span class="role__name">{{ tr('role.B') }}</span>
          <span class="role__desc">{{ tr('onboarding.roles.reporter_desc') }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stage {
  height: 100%;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  justify-content: center;
}
.stage__head { display: flex; flex-direction: column; line-height: 1; }
.stage__label { font-size: 0.75rem; color: var(--color-ink-muted); letter-spacing: 0.06em; }
.stage__cap { font-size: 2.6rem; color: var(--color-primary); animation: pulse 0.6s ease-out; }
@keyframes pulse {
  0% { transform: scale(1); }
  35% { transform: scale(1.4); color: var(--color-danger); }
  100% { transform: scale(1); }
}
.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
.cards--one { grid-template-columns: 1fr; place-items: center; }
.cards--five { grid-template-columns: repeat(5, 1fr); gap: 0.4rem; }
.card {
  position: relative;
  display: flex; flex-direction: column; align-items: center; gap: 0.3rem;
  padding: 0.8rem 0.35rem; min-height: 5.5rem;
  transition: transform 0.5s ease, opacity 0.5s ease;
}
.card--in { animation: card-in 0.5s ease-out both; }
@keyframes card-in {
  from { transform: translateY(16px) scale(0.9); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}
.card--big { min-width: 13rem; }
.card__icon { font-size: 1.9rem; line-height: 1; }
.card__name { font-size: 0.85rem; color: var(--color-ink-muted); }
.card__price { font-size: 1.5rem; color: var(--color-ink-strong); animation: pulse 0.5s ease-out; }
.card__fly {
  position: absolute; top: -2.2rem; font-size: 2.4rem; color: var(--color-danger);
  text-shadow: 0 0 12px var(--color-danger); animation: fly-down 1s cubic-bezier(0.4,0.1,0.4,1) forwards;
}
@keyframes fly-down {
  0% { transform: translateY(-6rem) scale(1.6); opacity: 0; }
  25% { opacity: 1; }
  100% { transform: translateY(3.2rem) scale(1); opacity: 0; }
}
.card__bid { font-size: 2.6rem; }
.bid--a { color: var(--color-primary); }
.bid--b { color: var(--color-lag1); }
.card__bidders { color: var(--color-ink-muted); letter-spacing: 0.15em; font-size: 0.85rem; }
.card__stamp {
  position: absolute; top: 42%; left: 50%;
  transform: translate(-50%, -50%) rotate(-12deg);
  border: 3px solid var(--color-danger); color: var(--color-danger);
  font-size: 0.95rem; letter-spacing: 0.06em; padding: 0.1em 0.35em; border-radius: 6px;
  animation: stamp 0.4s cubic-bezier(0.4,1.6,0.5,1) both;
}
@keyframes stamp {
  from { transform: translate(-50%, -50%) rotate(-12deg) scale(2.6); opacity: 0; }
  to { transform: translate(-50%, -50%) rotate(-12deg) scale(1); opacity: 1; }
}
.card__help {
  position: absolute; bottom: -2.4rem; width: 130%; font-size: 0.8rem; line-height: 1.3;
  color: var(--color-ink-muted); text-align: center;
}
.bubble {
  align-self: center; border: 1px solid var(--color-primary); border-radius: 12px;
  padding: 0.6rem 1.1rem; font-size: 1.3rem; color: var(--color-ink-strong);
  background: var(--color-background-2); box-shadow: var(--glow-soft);
  animation: bubble-throb 1.3s ease-in-out infinite;
}
@keyframes bubble-throb {
  0%, 100% { transform: scale(1); box-shadow: 0 0 8px rgba(255,149,0,0.3); }
  50% { transform: scale(1.06); box-shadow: 0 0 22px rgba(255,149,0,0.6); }
}
/* I4live */
.lmoney {
  align-self: center;
  font-size: 5rem;
  line-height: 1;
  text-shadow: var(--glow-strong);
  transition: transform 0.9s cubic-bezier(0.5, 0, 0.3, 1), opacity 0.9s ease;
}
.lmoney small { font-size: 1.4rem; }
.lmoney--fly {
  transform: translate(-42%, -32vh) scale(0.4);
  opacity: 0;
}
.card__x2 {
  position: absolute;
  top: -0.6rem;
  right: -0.4rem;
  font-family: var(--font-retro);
  font-size: 1.6rem;
  color: var(--color-danger);
  text-shadow: 0 0 12px var(--color-danger);
  animation: x2-throb 0.7s ease-in-out infinite;
}
@keyframes x2-throb {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.4); }
}
.lx2text {
  align-self: center;
  margin: 0.4rem 0 0;
  font-size: 1rem;
  color: var(--color-ink-strong);
  text-align: center;
}
.roles { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.role {
  display: flex; flex-direction: column; align-items: center; gap: 0.4rem; padding: 1.2rem 0.8rem;
  opacity: 0; transform: translateY(14px);
  transition: opacity 0.5s ease, transform 0.5s ease;
  text-align: center;
}
.role--in { opacity: 1; transform: translateY(0); }
.role__icon { font-size: 2.6rem; line-height: 1; }
.role__name { font-size: 1.3rem; color: var(--color-primary); }
.role__desc { font-size: 0.9rem; color: var(--color-ink-muted); }

@media (prefers-reduced-motion: reduce) {
  .stage__cap, .card--in, .card__price, .card__fly, .card__stamp, .bubble, .role,
  .lmoney, .card__x2 {
    animation: none !important; transition: none !important; opacity: 1; transform: none;
  }
  .card__fly, .lmoney--fly { display: none; }
}
</style>
