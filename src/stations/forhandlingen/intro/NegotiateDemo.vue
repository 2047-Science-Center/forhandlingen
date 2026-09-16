<script setup lang="ts">
/**
 * Förhandlingsdemo (Block 1 & 2): bild överst (~70%, beskuren så huvudena kommer
 * med) med TALARMARKERING (talarens halva lyses upp, den andra dämpas — ingen
 * text), och den skriptade settle-UI-kopian under (~30%). Talare + settle drivs
 * av manuset (negotiateScripts) tajmat mot `elapsed`.
 */
import { computed } from 'vue'
import { NEGOTIATE_SCRIPTS, speakerAt } from './negotiateScripts'
import SettleDemo from './SettleDemo.vue'

const props = defineProps<{
  illustration: string
  elapsed: number
  photoUrl: (n: number) => string
}>()

const script = computed(() => NEGOTIATE_SCRIPTS[props.illustration])
const speaker = computed(() => (script.value ? speakerAt(script.value, props.elapsed) : null))
</script>

<template>
  <div class="nd" v-if="script">
    <div
      class="nd__photo amber-frame"
      :class="{ 'nd__photo--left': speaker === 'vanster', 'nd__photo--right': speaker === 'hoger' }"
    >
      <img :src="photoUrl(script.photo)" alt="" />
    </div>
    <div class="nd__settle">
      <SettleDemo :settle="script.settle" :elapsed="elapsed" />
    </div>
  </div>
</template>

<style scoped>
.nd {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.nd__photo {
  flex: 0 0 68%;
  min-height: 0;
  overflow: hidden;
  position: relative;
}
.nd__photo img {
  width: 100%;
  height: 100%;
  /* Beskär så huvudena (övre delen) kommer med. */
  object-fit: cover;
  object-position: center 22%;
  transition: filter 0.4s ease;
}
/* Talarmarkering: dämpa motsatt halva via en mask. */
.nd__photo::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: transparent;
  transition: background 0.45s ease;
}
.nd__photo--left::after {
  background: linear-gradient(90deg, rgba(5, 16, 11, 0) 45%, rgba(5, 16, 11, 0.72) 78%);
}
.nd__photo--right::after {
  background: linear-gradient(90deg, rgba(5, 16, 11, 0.72) 22%, rgba(5, 16, 11, 0) 55%);
}
.nd__settle {
  flex: 1 1 32%;
  min-height: 0;
}
@media (prefers-reduced-motion: reduce) {
  .nd__photo img,
  .nd__photo::after {
    transition: none;
  }
}
</style>
