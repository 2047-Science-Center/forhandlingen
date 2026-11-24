<script setup lang="ts">
/**
 * Pengarna som en myntstapel (1 mynt = 10 kr, påbörjad tia = ett mynt) med beloppet ovanpå.
 * Mynt som försvinner lyfter och tonar ut, så ett köp SYNS i stället för att bara vara en siffra.
 */
import { computed } from 'vue'
const props = withDefaults(defineProps<{ kr: number; liten?: boolean }>(), { liten: false })
const antal = computed(() => Math.max(0, Math.ceil(props.kr / 10)))
</script>

<template>
  <div class="ms" :class="{ 'ms--liten': liten }">
    <span class="ms__summa mono">{{ kr }}<small> kr</small></span>
    <TransitionGroup tag="div" name="ms-mynt" class="ms__stapel">
      <i v-for="n in antal" :key="n" class="ms__mynt" :style="{ bottom: `${(n - 1) * (liten ? 5 : 8)}px` }" />
    </TransitionGroup>
  </div>
</template>

<style scoped>
.ms {
  display: flex;
  align-items: flex-end;
  gap: 0.8rem;
}
.ms__summa {
  font-size: 2.6rem;
  line-height: 1;
  color: var(--color-ink-strong);
  text-shadow: var(--glow-soft);
}
.ms__summa small {
  font-size: 1.1rem;
  color: var(--color-ink-muted);
}
.ms__stapel {
  position: relative;
  width: 64px;
  height: 104px;
}
.ms__mynt {
  position: absolute;
  left: 0;
  width: 64px;
  height: 20px;
  border-radius: 50%;
  background: radial-gradient(ellipse at 40% 35%, #ffe08a, #d79a1c 70%, #8a5b07);
  border: 2px solid #6b4504;
}
.ms--liten .ms__summa { font-size: 2rem; }
.ms--liten .ms__stapel { width: 40px; height: 64px; }
.ms--liten .ms__mynt { width: 40px; height: 13px; }
.ms-mynt-leave-active {
  transition: transform 600ms cubic-bezier(0.55, 0, 1, 0.45), opacity 600ms ease-in;
}
.ms-mynt-leave-to {
  transform: translateY(-60px) scale(0.8);
  opacity: 0;
}
.ms-mynt-enter-active {
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms;
}
.ms-mynt-enter-from {
  transform: translateY(-20px);
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .ms-mynt-leave-active,
  .ms-mynt-enter-active { transition: none; }
}
</style>
