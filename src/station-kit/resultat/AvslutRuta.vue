<script setup lang="ts">
/**
 * Avslutets ruta (IDENTISK i alla X&Y-stationsappar). Visar takterna från useAvslut:
 *   uppbyggnad → en rad ("VALDI RÄKNAR …") + ev. #fore (t.ex. personen gruppen pekade ut)
 *   spanning   → #spanning (default: skanner-svep) + ev. kort text
 *   avslojande → rubriken slår in (+ #media)
 *   utfall     → siffra, rad, VALdi-rad, #detalj och knappen
 * Stationen äger innehållet (texterna, siffran); rutan äger rytmen och utseendet.
 * Copy-regler (XY-RESULTAT-OCH-VINST §2.2): prestationen vid stationen får visas — nämn aldrig
 * sortering, valv-tilldelning eller rollval; lyft gruppen/sidan, aldrig en enskild person.
 */
import { computed } from 'vue'
import { minst, type Takt, type UtfallTyp } from './avslut'

const props = withDefaults(
  defineProps<{
    takt: Takt
    typ: UtfallTyp
    uppbyggnad: string
    spanning?: string
    eyebrow?: string
    rubrik: string
    underrubrik?: string
    siffra?: string
    siffraEtikett?: string
    rad?: string
    valdi?: string
    /** Knapptext. null = ingen knapp i det här fönstret (visa `vanta`). */
    knapp?: string | null
    vanta?: string
    kanGaVidare: boolean
  }>(),
  {
    spanning: '',
    eyebrow: '',
    underrubrik: '',
    siffra: '',
    siffraEtikett: '',
    rad: '',
    valdi: '',
    knapp: 'Vi är klara ▸',
    vanta: 'Väntar …',
  },
)
const emit = defineEmits<{ vidare: [] }>()

const visaRubrik = computed(() => minst(props.takt, 'avslojande'))
const visaUtfall = computed(() => minst(props.takt, 'utfall'))
</script>

<template>
  <div class="avslut" :class="[`avslut--${typ}`, `avslut--${takt}`]" data-avslut>
    <!-- 1 UPPBYGGNAD -->
    <div v-if="takt === 'uppbyggnad'" class="avslut__fore">
      <p class="avslut__upp">{{ uppbyggnad }}</p>
      <slot name="fore" />
    </div>

    <!-- 2 SPÄNNING -->
    <div v-else-if="takt === 'spanning'" class="avslut__spanning">
      <slot name="spanning">
        <div class="avslut__skanner" aria-hidden="true"><span /></div>
      </slot>
      <p v-if="spanning" class="avslut__spanning-text">{{ spanning }}</p>
    </div>

    <!-- 3–4 AVSLÖJANDE + UTFALL -->
    <template v-else-if="visaRubrik">
      <p v-if="eyebrow" class="avslut__eyebrow">{{ eyebrow }}</p>
      <h1 class="avslut__rubrik">{{ rubrik }}</h1>
      <p v-if="underrubrik" class="avslut__underrubrik">{{ underrubrik }}</p>
      <slot name="media" />
      <div class="avslut__utfall" :class="{ 'avslut__utfall--in': visaUtfall }">
        <div v-if="siffra" class="avslut__siffra">
          <span class="avslut__siffra-tal">{{ siffra }}</span>
          <span v-if="siffraEtikett" class="avslut__siffra-etikett">{{ siffraEtikett }}</span>
        </div>
        <p v-if="rad" class="avslut__rad">{{ rad }}</p>
        <slot name="detalj" />
        <p v-if="valdi" class="avslut__valdi">"{{ valdi }}" <span>— VALdi</span></p>
        <button
          v-if="knapp"
          class="crt-button crt-button--strong avslut__knapp"
          :disabled="!kanGaVidare || !visaUtfall"
          @click="emit('vidare')"
        >
          {{ knapp }}
        </button>
        <p v-else class="avslut__vanta">{{ vanta }}</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.avslut {
  --avslut-farg: var(--color-primary);
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  width: 100%;
  min-height: 100%;
  padding: 32px 24px;
  text-align: center;
  box-sizing: border-box;
}
.avslut--vinst,
.avslut--klarat {
  --avslut-farg: #4fd14f;
}
.avslut--oavgjort,
.avslut--delvis {
  --avslut-farg: var(--color-primary);
}
.avslut--missat {
  --avslut-farg: var(--color-danger, #ff5a3c);
}

.avslut__fore {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}
.avslut__upp {
  font-family: var(--font-retro);
  font-size: clamp(32px, 4.4vw, 64px);
  letter-spacing: 0.08em;
  color: var(--color-primary);
  text-shadow: var(--glow-strong);
  margin: 0;
  animation: avslut-andas 1.1s ease-in-out infinite;
}

.avslut__spanning {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  width: min(70%, 760px);
}
.avslut__skanner {
  position: relative;
  width: 100%;
  height: 14px;
  border: 1px solid var(--color-primary-dim);
  border-radius: 7px;
  overflow: hidden;
}
.avslut__skanner span {
  position: absolute;
  inset: 0 auto 0 0;
  width: 28%;
  background: var(--color-primary);
  box-shadow: var(--glow-strong);
  animation: avslut-svep 0.5s cubic-bezier(0.77, 0, 0.175, 1) infinite alternate;
}
.avslut__spanning-text {
  font-family: var(--font-retro);
  font-size: clamp(22px, 2.6vw, 34px);
  color: var(--color-ink-muted);
  margin: 0;
}

.avslut__eyebrow {
  font-family: var(--font-mono);
  font-size: clamp(14px, 1.4vw, 18px);
  letter-spacing: 0.24em;
  color: var(--color-ink-muted);
  margin: 0;
}
.avslut__rubrik {
  font-family: var(--font-retro);
  font-size: clamp(56px, 8vw, 120px);
  line-height: 0.95;
  letter-spacing: 0.04em;
  color: var(--avslut-farg);
  text-shadow: 0 0 18px var(--avslut-farg);
  margin: 0;
  animation: avslut-slag 0.42s cubic-bezier(0.23, 1, 0.32, 1) both;
}
.avslut__underrubrik {
  font-family: var(--font-retro);
  font-size: clamp(26px, 3vw, 40px);
  color: var(--color-ink-strong);
  margin: 0;
}

.avslut__utfall {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  opacity: 0;
  transform: translateY(10px);
  transition:
    opacity 0.5s var(--ease-out),
    transform 0.5s var(--ease-out);
}
.avslut__utfall--in {
  opacity: 1;
  transform: none;
}
.avslut__siffra {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.avslut__siffra-tal {
  font-family: var(--font-retro);
  font-size: clamp(48px, 6vw, 88px);
  color: var(--color-ink-strong);
  line-height: 1;
}
.avslut__siffra-etikett {
  font-family: var(--font-mono);
  font-size: clamp(15px, 1.5vw, 20px);
  color: var(--color-ink-muted);
}
.avslut__rad {
  font-family: var(--font-mono);
  font-size: clamp(18px, 1.9vw, 26px);
  color: var(--color-ink-strong);
  max-width: 40ch;
  margin: 0;
}
.avslut__valdi {
  font-family: var(--font-mono);
  font-style: italic;
  font-size: clamp(15px, 1.5vw, 20px);
  color: var(--color-ink-muted);
  max-width: 48ch;
  margin: 0;
}
.avslut__valdi span {
  font-style: normal;
}
.avslut__knapp {
  margin-top: 10px;
}
.avslut__vanta {
  font-family: var(--font-mono);
  color: var(--color-ink-muted);
  margin: 10px 0 0;
}

@keyframes avslut-svep {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(257%);
  }
}
@keyframes avslut-andas {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}
@keyframes avslut-slag {
  from {
    opacity: 0;
    transform: scale(1.35);
    filter: blur(6px);
  }
  to {
    opacity: 1;
    transform: none;
    filter: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .avslut__rubrik,
  .avslut__upp,
  .avslut__skanner span {
    animation: none;
  }
}
</style>
