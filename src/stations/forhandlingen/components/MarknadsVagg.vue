<script setup lang="ts">
/**
 * Marknaden som en LUCKVÄGG (ersätter de fem prickarna): fem stålluckor som de fysiska på
 * stationen. Lampan över luckan säger läget i samma färger som underglow —
 *   släckt = kommande · bärnsten = öppen nu · varmvit = sida A tog den · magenta = sida B · grå = ingen köpte.
 * Den öppna luckan står upp och visar varan; avgjorda luckor visar varan i miniatyr + vem och pris.
 */
import type { HatchCell } from '../store/gameStore'
import VaraBild from './VaraBild.vue'

withDefaults(defineProps<{ cells: HatchCell[]; liten?: boolean }>(), { liten: false })
const SIDA = { lag1: 'A', lag2: 'B' } as const
</script>

<template>
  <div class="mv" :class="{ 'mv--liten': liten }" role="list" aria-label="Marknadens luckor">
    <div
      v-for="c in cells"
      :key="c.hatch"
      class="mv__lucka"
      :class="[`mv__lucka--${c.kind}`, c.winner ? `mv__lucka--${SIDA[c.winner]}` : '']"
      role="listitem"
    >
      <i class="mv__lampa" aria-hidden="true" />
      <div class="mv__ram">
        <div class="mv__inne">
          <VaraBild v-if="c.resource && c.kind !== 'upcoming'" :vara="c.resource" :size="liten ? 44 : 62" />
        </div>
        <div class="mv__dorr" />
        <span v-if="c.kind === 'won' && c.winner" class="mv__chip">{{ SIDA[c.winner] }} {{ c.price }}</span>
        <span v-else-if="c.kind === 'nobuy'" class="mv__chip mv__chip--ingen">–</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mv {
  align-self: center;
  display: flex;
  gap: 0.9rem;
  padding: 0.7rem 1.2rem 0.8rem;
  border-radius: 14px;
  background: linear-gradient(180deg, #2b544e 0%, #1f3f3a 100%);
  border: 2px solid #3f6f68;
  box-shadow: inset 0 -12px 24px rgba(0, 0, 0, 0.35);
}
.mv__lucka {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
}
.mv__lampa {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #15231f;
  border: 2px solid #4c7a72;
  transition: background 300ms, box-shadow 300ms;
}
.mv__ram {
  position: relative;
  width: 84px;
  height: 84px;
  border-radius: 8px;
  border: 3px solid #4c7a72;
  background: #0c1714;
  overflow: hidden;
  perspective: 300px;
}
.mv__inne {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mv__dorr {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #3f6d66, #2d524c);
  transform-origin: 0 50%;
  transition: transform 600ms cubic-bezier(0.65, 0, 0.35, 1);
}
.mv__dorr::after {
  content: '';
  position: absolute;
  right: 9px;
  top: 32px;
  width: 8px;
  height: 16px;
  border-radius: 3px;
  background: #8fb3ab;
}
.mv__chip {
  position: absolute;
  left: 50%;
  bottom: 4px;
  transform: translateX(-50%);
  font-family: var(--font-rubrik);
  font-weight: 700;
  font-size: 1.1rem;
  line-height: 1.1;
  padding: 0 0.45em;
  border-radius: 5px;
  white-space: nowrap;
}
/* Öppen nu: dörren svänger upp, varan syns i varmt ljus */
.mv__lucka--active .mv__lampa {
  background: #ff9500;
  box-shadow: 0 0 14px #ff9500;
}
.mv__lucka--active .mv__inne {
  background: radial-gradient(circle at 50% 60%, #ffd894 0%, #b8690f 60%, #3b2408 100%);
}
.mv__lucka--active .mv__dorr {
  transform: rotateY(-82deg);
}
/* Avgjord: dörren stängd men varan anas i miniatyr bakom en glipa */
.mv__lucka--won .mv__dorr,
.mv__lucka--nobuy .mv__dorr {
  transform: rotateY(-35deg);
  filter: brightness(0.85);
}
.mv__lucka--A .mv__lampa { background: #fff1d6; box-shadow: 0 0 12px #fff1d6; }
.mv__lucka--A .mv__chip { background: #fff1d6; color: #1d1a14; }
.mv__lucka--B .mv__lampa { background: #ff3cc8; box-shadow: 0 0 12px #ff3cc8; }
.mv__lucka--B .mv__chip { background: #ff3cc8; color: #1d0a17; }
.mv__lucka--nobuy .mv__lampa { background: #5b6b64; }
.mv__chip--ingen { background: #3a4740; color: #c9d4cc; }
.mv__lucka--upcoming .mv__ram { opacity: 0.8; }

.mv--liten { gap: 0.6rem; padding: 0.5rem 0.8rem; }
.mv--liten .mv__ram { width: 60px; height: 60px; }
.mv--liten .mv__dorr::after { top: 22px; right: 6px; }
@media (prefers-reduced-motion: reduce) {
  .mv__dorr { transition: none; }
}
</style>
