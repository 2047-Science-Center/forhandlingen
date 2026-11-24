<script setup lang="ts">
/**
 * Testvy för mikrofonsynken (?mik=visa): finns det en ingång, vilken, stereo eller mono, och rör sig
 * nivåerna när sändebuden pratar? Visas i ett hörn ovanpå stationen. Inget spelas in.
 */
import { onMounted } from 'vue'
import { startaMik, useMik } from '../mik'

const mik = useMik()
onMounted(() => void startaMik())
</script>

<template>
  <div class="mt">
    <b>MIKROFONSYNK · test</b>
    <p v-if="mik.fel" class="mt__fel">{{ mik.fel }}</p>
    <template v-else-if="mik.aktiv">
      <p>{{ mik.enhet || 'standardingång' }} · {{ mik.stereo ? 'stereo (A vänster, B höger)' : 'mono (gemensam nivå)' }}</p>
      <div v-for="s in (['A', 'B'] as const)" :key="s" class="mt__rad">
        <span>{{ s }}</span>
        <span class="mt__matare"><i :style="{ width: `${mik[s].niva * 100}%` }" :class="{ 'mt__pa': mik[s].pratar }" /></span>
        <span>{{ mik[s].pratar ? 'PRATAR' : '' }}</span>
      </div>
      <details>
        <summary>{{ mik.enheter.length }} ingångar</summary>
        <ul><li v-for="d in mik.enheter" :key="d.id">{{ d.namn }} <small>({{ d.id.slice(0, 8) }})</small></li></ul>
      </details>
    </template>
    <p v-else>Startar …</p>
  </div>
</template>

<style scoped>
.mt {
  position: fixed;
  right: 12px;
  top: 52px;
  z-index: 500;
  width: 340px;
  padding: 10px 12px;
  font-family: var(--font-mono);
  font-size: 13px;
  color: #e6efe9;
  background: rgba(0, 0, 0, 0.85);
  border: 1px solid #3a4a40;
  border-radius: 8px;
}
.mt p { margin: 6px 0; }
.mt__fel { color: #ff9c87; }
.mt__rad {
  display: grid;
  grid-template-columns: 18px 1fr 64px;
  gap: 8px;
  align-items: center;
  margin: 4px 0;
}
.mt__matare {
  height: 10px;
  background: #1b2520;
  border-radius: 5px;
  overflow: hidden;
}
.mt__matare i {
  display: block;
  height: 100%;
  background: #6f8a7e;
  transition: width 60ms linear;
}
.mt__matare i.mt__pa { background: #ff9500; }
</style>
