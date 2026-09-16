/**
 * De fyra ljudblocken i onboardingen (svenska). Tider = sekunder på VARJE blocks
 * egen ljudklocka. Illustrationernas sub-tider ligger relativt cue-starten i
 * IntroStage/SettleDemo (elapsed = t − cue.time), så samma illustration kan
 * återanvändas i flera block. Redigerbart per språk (byt audio + .vtt + tider).
 *
 * Block 1 & 2 använder förhandlingsdemon ('negotiate'); Block 2 återanvänder
 * illustrationerna I1/I2/I4 (enkel-demo). Block 3 = bara ljud. Block 4 = roll-
 * skillnad + Bild 10-illustration med 100 kr / 5 resurser.
 */
import type { IntroBlockDef } from '@/station-kit/intro/introTypes'
import { encodeAudio } from '@/config'

export const BLOCKS: Record<'block1' | 'block2' | 'block3' | 'block4', IntroBlockDef> = {
  block1: {
    id: 'block1',
    audio: encodeAudio('ljud 1.1.mp3'),
    subtitles: '/subtitles/block1.vtt',
    cues: [
      { time: 0, photo: 1, mode: 'center' },
      { time: 9.24, photo: 5, mode: 'negotiate', illustration: 'B1' },
    ],
  },
  block2: {
    id: 'block2',
    audio: encodeAudio('Ljud 1.2.mp3'),
    subtitles: '/subtitles/block2.vtt',
    cues: [
      { time: 0, photo: 6, mode: 'split', illustration: 'I1' },
      { time: 14, photo: 7, mode: 'center' },
      { time: 18, photo: 8, mode: 'split', illustration: 'I2' },
      { time: 32.18, photo: 9, mode: 'negotiate', illustration: 'B2' },
      { time: 48.11, photo: 10, mode: 'split', illustration: 'I4' },
    ],
  },
  block3: {
    id: 'block3',
    audio: encodeAudio('ljud 1.3.mp3'),
    subtitles: '/subtitles/block3.vtt',
    cues: [{ time: 0, photo: 8, mode: 'center' }],
  },
  block4: {
    id: 'block4',
    audio: encodeAudio('ljud 1.4.mp3'),
    subtitles: '/subtitles/block4.vtt',
    cues: [
      { time: 0, photo: 2, mode: 'split', illustration: 'roleDiff' },
      { time: 11.01, photo: 10, mode: 'split', illustration: 'I4live' },
    ],
  },
}
