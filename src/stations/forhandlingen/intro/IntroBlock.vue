<script setup lang="ts">
/**
 * Ett ljudblock i onboardingen: kör AudioSlides med blockets ljud/undertext/cues,
 * och fyller split-sloten (enkel-demo, IntroStage) och negotiate-sloten
 * (förhandlingsdemo, NegotiateDemo). Emit('done') vid slut/överhopp.
 */
import AudioSlides from '@/station-kit/intro/AudioSlides.vue'
import IntroStage from './IntroStage.vue'
import NegotiateDemo from './NegotiateDemo.vue'
import { INTRO_MEDIA } from '@/config'
import type { IntroBlockDef } from '@/station-kit/intro/introTypes'

defineProps<{ block: IntroBlockDef; startEpoch?: number }>()
const emit = defineEmits<{ done: [] }>()
</script>

<template>
  <AudioSlides
    :key="block.id"
    :audio-src="block.audio"
    :subtitle-src="block.subtitles"
    :cues="block.cues"
    :photo-url="INTRO_MEDIA.photo"
    :start-epoch="startEpoch"
    @done="emit('done')"
  >
    <template #split="{ cue, elapsed }">
      <IntroStage :illustration="cue?.illustration ?? null" :elapsed="elapsed" />
    </template>
    <template #negotiate="{ cue, elapsed, photoUrl }">
      <NegotiateDemo
        v-if="cue?.illustration"
        :illustration="cue.illustration"
        :elapsed="elapsed"
        :photo-url="photoUrl"
      />
    </template>
  </AudioSlides>
</template>
