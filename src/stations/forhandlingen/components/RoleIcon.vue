<script setup lang="ts">
/**
 * Central roll-ikon — ETT ställe att byta SVG på. Agent 2 ersätter de två
 * inline-SVG-platshållarna nedan (sandebud / rapportor) utan att röra något
 * annat; alla vyer som visar en roll gör det via denna komponent, så bytet
 * slår igenom i hela appen på en gång.
 *
 * Rollerna skiljs via FORM (två tydligt olika silhuetter) + storlek, ALDRIG
 * via färg — paletten hålls till orange (skarpt) + mint (tutorial). Ikonerna
 * ärver aktiv accent via `currentColor`, så de följer läges-temat automatiskt.
 * SÄNDEBUD (roll A) ritas FYLLD, RAPPORTÖR (roll B) KONTURAD — en extra
 * form-skillnad som funkar även i gråskala.
 */
const props = withDefaults(defineProps<{ role: 'A' | 'B'; size?: number | string }>(), {
  size: 48,
})
const px = typeof props.size === 'number' ? `${props.size}px` : props.size
</script>

<template>
  <span class="role-icon" :style="{ width: px, height: px }" aria-hidden="true">
    <!-- ======================= SÄNDEBUD (roll A) =======================
         Platshållare: huvud med headset-båge + mikrofon-bom + ljudvågor.
         FYLLD silhuett. Byt hela denna <svg> mot slutgiltig ikon. -->
    <svg
      v-if="role === 'A'"
      class="role-icon__svg role-icon__svg--neg"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- huvud (fyllt) -->
      <circle cx="21" cy="21" r="10" fill="currentColor" />
      <!-- headset-båge -->
      <path d="M9 21a12 12 0 0 1 24 0" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
      <!-- öronkåpa + mikrofon-bom -->
      <rect x="6.5" y="20" width="5" height="9" rx="2.5" fill="currentColor" />
      <path d="M9 29c0 6 6 8 12 8" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
      <circle cx="22" cy="37" r="2.6" fill="currentColor" />
      <!-- ljudvågor (talar) -->
      <path d="M34 15c3 3 3 15 0 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
      <path d="M39 11c5 6 5 20 0 26" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity="0.6" />
    </svg>

    <!-- ======================= RAPPORTÖR (roll B) =======================
         Platshållare: skärm/konsol på fot + ett öga (lyssnar/gissar).
         KONTURAD silhuett. Byt hela denna <svg> mot slutgiltig ikon. -->
    <svg
      v-else
      class="role-icon__svg role-icon__svg--rep"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- skärm (kontur) -->
      <rect x="7" y="9" width="34" height="24" rx="3" stroke="currentColor" stroke-width="2.6" />
      <!-- fot -->
      <path d="M24 33v5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
      <path d="M16 40h16" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
      <!-- öga (lyssnar/gissar) -->
      <path d="M14 21c3-5 17-5 20 0-3 5-17 5-20 0Z" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" />
      <circle cx="24" cy="21" r="3.2" fill="currentColor" />
    </svg>
  </span>
</template>

<style scoped>
.role-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  line-height: 0;
}
.role-icon__svg {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 0 6px rgba(var(--mode-accent-rgb), 0.45));
}
</style>
