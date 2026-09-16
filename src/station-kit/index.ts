/** Gemensamt stations-kit (Lager A) — importeras av alla fyra X&Y-stationer. */

export { default as CrtScreen } from './components/CrtScreen.vue'
export { default as Teletype } from './components/Teletype.vue'
export { default as CrtImage } from './components/CrtImage.vue'
export { default as TeamPanel } from './components/TeamPanel.vue'
export { default as AttractScreen } from './components/AttractScreen.vue'
export { default as MuteButton } from './components/MuteButton.vue'

export { audio } from './audio/AudioEngine'
export type { Sfx } from './audio/AudioEngine'

export { useI18n, t, setLang, getLang } from './i18n'
export type { Lang } from './i18n'

export * from './adapters'
