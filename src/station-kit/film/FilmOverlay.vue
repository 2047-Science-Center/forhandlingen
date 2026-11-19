<script setup lang="ts">
/**
 * Helskärms-overlay för regis filmer (station-kit/film). Lägg i appens rot — i varje fönster.
 * Medan filmen visas täcker den hela appen (inga klick når stationen) och stationens eget ljud
 * tystas (ljudet är master i centralhögtalaren); efteråt återställs ljudläget.
 */
import { watch } from 'vue'
import { useFilm } from './stationFilm'
import { audio } from '../audio/AudioEngine'

const film = useFilm()
let varTyst: boolean | null = null

watch(
  film.synlig,
  (on) => {
    if (on && varTyst === null) {
      varTyst = audio.muted
      audio.setMuted(true)
    } else if (!on && varTyst !== null) {
      audio.setMuted(varTyst)
      varTyst = null
    }
  },
  { immediate: true },
)
</script>

<template>
  <Teleport to="body">
    <div v-if="film.synlig.value" class="xy-film-overlay">
      <iframe :key="film.src.value" :src="film.src.value" allow="autoplay; fullscreen" title="Film" />
    </div>
  </Teleport>
</template>

<style scoped>
.xy-film-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  background: #000;
  cursor: none;
}
.xy-film-overlay iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: #000;
}
</style>
