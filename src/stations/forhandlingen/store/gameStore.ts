/**
 * Pinia-store: tunt lager som binder ihop den rena spelmotorn med adaptrarna
 * och transporten. Håller INGEN spellogik — bara orkestrering (dispatch →
 * reduce → broadcast → sidoeffekter: ljus, ljud, resultat, per-lucka-timer).
 *
 * Rollval/uppdelning sker uppströms: lagen (LAG A/LAG B) seedas deterministiskt
 * vid init så två fönster/skärmar är i synk utan inloggningssteg.
 */

import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'

import { reduce, initialState, hatchLights, opponentOf } from '../engine/gameEngine'
import type { Action } from '../engine/gameEngine'
import type { GameState, TeamId, Phase, BiddingStep, HatchResult } from '../engine/types'
import { personResults } from '../engine/scoring'

import { createAdapters, type Adapters } from '@/station-kit/adapters'
import type { ResultPayload } from '@/station-kit/adapters/result/ResultSink'
import { audio } from '@/station-kit/audio/AudioEngine'
import {
  config,
  DATASETS,
  ALL_DATASETS,
  TRIAL_DATASET,
  TEST1_DATASET,
  LIVE_DATASET_ID,
  ROUND_TIMERS,
  IDLE_RESTART,
  TEAMS,
  defaultRoster,
} from '@/config'

const IDLE_MS = IDLE_RESTART.minutes * 60_000
const IDLE_WARN_MS = IDLE_RESTART.warnSeconds * 1000

export type ViewSide = 'lag1' | 'lag2' | 'shared'

/** Läs vilken sida detta fönster är från URL-hash (#lag1 / #lag2 / #shared). */
function viewFromHash(): ViewSide {
  const h = (typeof window !== 'undefined' ? window.location.hash : '').replace('#', '')
  if (h === 'lag1' || h === 'lag2' || h === 'shared') return h
  return 'shared'
}

export interface HatchCell {
  index: number
  hatch: number
  /** won = vunnen, nobuy = ingen köpte, active = pågår nu, upcoming = ej öppnad. */
  kind: 'won' | 'nobuy' | 'active' | 'upcoming'
  winner: TeamId | null
  /** Resurs avslöjas bara för avgjorda luckor (won/nobuy). null = anonym. */
  resource: string | null
}

export const useGameStore = defineStore('forhandlingen', () => {
  const state = ref<GameState>(initialState(defaultRoster()))
  const view = ref<ViewSide>(viewFromHash())
  const now = ref<number>(Date.now())
  /** Epoch-ms när intro-klippet startades (delas mellan skärmar → synkat ljud). */
  const introStartedAt = ref<number | null>(null)
  /** Facilitator-paus (synkad). Fryser nedräkningen och lägger paus-overlay. */
  const paused = ref(false)
  /** Epoch-ms när pausen startade (för att förskjuta nedräkningen vid resume). */
  const pausedSince = ref(0)
  /** Räknare som tickar upp vid varje reset → UI kan återgå till attract. */
  const resetSignal = ref(0)
  /** Epoch-ms för senaste aktivitet (lokal ELLER från andra skärmen) → idle-återstart. */
  const lastActivityAt = ref(Date.now())
  let lastActivityBroadcast = 0
  /** Sant när stationen är i en körning (efter attract) → idle-återstart aktiv. */
  const sessionActive = ref(false)
  const selectedDataset = ref<string>(DATASETS[0].id)
  /** Efter ett köp hålls nästa lucka släckt ~1 s innan den tänds (§4.5). */
  const holdActiveUntil = ref(0)

  const adapters = shallowRef<Adapters | null>(null)
  let unsub: (() => void) | null = null
  let timerHandle: ReturnType<typeof setInterval> | null = null

  // --- Härledda värden ---
  const phase = computed<Phase>(() => state.value.phase)
  const step = computed<BiddingStep>(() => state.value.step)
  const lights = computed(() => {
    const base = hatchLights(state.value)
    if (now.value < holdActiveUntil.value) {
      return base.map((l) => (l.state === 'active' ? { ...l, state: 'off' as const } : l))
    }
    return base
  })
  const currentResource = computed(() =>
    state.value.currentHatch >= 0 && state.value.currentHatch < state.value.order.length
      ? state.value.order[state.value.currentHatch]
      : null,
  )
  const doneCount = computed(() => Object.keys(state.value.results).length)

  /** Sekunder kvar i AKTUELL förhandling. null när timern inte är igång. */
  const secondsLeft = computed<number | null>(() => {
    if (state.value.hatchTimerEndsAt == null) return null
    // Under paus fryses den visade tiden vid pausögonblicket.
    const ref_ = paused.value ? pausedSince.value : now.value
    return Math.max(0, Math.round((state.value.hatchTimerEndsAt - ref_) / 1000))
  })

  /** Idle-återstart: sant när varningen ska visas (strax före auto-reset). */
  const idleWarn = computed(
    () => sessionActive.value && IDLE_MS > 0 && now.value - lastActivityAt.value >= IDLE_MS - IDLE_WARN_MS,
  )
  /** Sekunder kvar till auto-reset (för varningens nedräkning). */
  const idleSecondsLeft = computed(() =>
    Math.max(0, Math.ceil((IDLE_MS - (now.value - lastActivityAt.value)) / 1000)),
  )

  /** Luckrad som anonyma thumbnails: resurs avslöjas bara för avgjorda luckor. */
  const hatchCells = computed<HatchCell[]>(() =>
    state.value.order.map((res, i) => {
      const r: HatchResult | undefined = state.value.results[i]
      if (r?.winner) return { index: i, hatch: i + 1, kind: 'won', winner: r.winner, resource: res }
      if (r) return { index: i, hatch: i + 1, kind: 'nobuy', winner: null, resource: res }
      if (state.value.phase === 'bidding' && i === state.value.currentHatch)
        return { index: i, hatch: i + 1, kind: 'active', winner: null, resource: null }
      return { index: i, hatch: i + 1, kind: 'upcoming', winner: null, resource: null }
    }),
  )

  // --- Sidoeffekter efter varje state-ändring ---
  let prevPhase: Phase = 'intro'
  let prevStep: BiddingStep = 'negotiating'
  let prevResultCount = 0
  let resultSent = false

  function applyEffects() {
    const s = state.value
    adapters.value?.lights.set(lights.value)

    if (s.phase !== prevPhase) {
      if (s.phase === 'bidding' && prevPhase === 'intro') audio.play('hatch')
      if (s.phase === 'reveal') audio.play('win')
      prevPhase = s.phase
    }
    if (s.step !== prevStep) {
      if (s.step === 'negotiating') audio.play('hatch')
      if (s.step === 'confirm') audio.play('confirm')
      prevStep = s.step
    }

    const rc = Object.keys(s.results).length
    if (rc > prevResultCount) {
      const last = s.results[Math.max(...Object.keys(s.results).map(Number))]
      if (last?.winner) audio.play('hatch')
      prevResultCount = rc
    }

    if (s.phase === 'reveal' && !resultSent) {
      sendResult()
      resultSent = true
    }
    if (s.phase !== 'reveal') resultSent = false
  }

  // --- Transport ---
  function plainState(): GameState {
    return JSON.parse(JSON.stringify(state.value)) as GameState
  }
  function broadcast() {
    adapters.value?.transport.send({ kind: 'snapshot', payload: plainState() })
  }
  function onMessage(msg: { kind: string; payload: unknown }) {
    if (msg.kind === 'snapshot') {
      state.value = reduce(state.value, { type: 'sync', state: msg.payload as GameState })
      applyEffects()
    } else if (msg.kind === 'hello') {
      broadcast()
      // Sen-anslutande skärm: dela pågående intro-start + onboarding-stage.
      if (introStartedAt.value != null) {
        adapters.value?.transport.send({ kind: 'introStart', payload: introStartedAt.value })
      }
      if (onbStage.value !== 'headset') {
        adapters.value?.transport.send({
          kind: 'onbStage',
          payload: { stage: onbStage.value, epoch: onbEpoch.value },
        })
      }
      if (paused.value) {
        adapters.value?.transport.send({ kind: 'pause', payload: { paused: true, since: pausedSince.value } })
      }
    } else if (msg.kind === 'introStart') {
      const ts = msg.payload as number
      if (introStartedAt.value == null || ts < introStartedAt.value) introStartedAt.value = ts
    } else if (msg.kind === 'onbStage') {
      const p = msg.payload as { stage: string; epoch: number | null }
      if (onbStage.value !== p.stage) {
        onbStage.value = p.stage
        onbEpoch.value = p.epoch
        onbReady.value = { lag1: false, lag2: false }
      }
    } else if (msg.kind === 'onbReady') {
      const p = msg.payload as { vault: TeamId }
      onbReady.value = { ...onbReady.value, [p.vault]: true }
    } else if (msg.kind === 'pause') {
      const p = msg.payload as { paused: boolean; since: number }
      paused.value = p.paused
      pausedSince.value = p.since
    } else if (msg.kind === 'sessionReset') {
      reset(false)
    } else if (msg.kind === 'activity') {
      notifyActivity(false)
    } else if (msg.kind === 'quit') {
      closeWindow()
    }
  }

  /** Stäng detta webbläsarfönster (fungerar i kiosk-/app-fönster). */
  function closeWindow() {
    try {
      window.close()
    } catch {
      /* i vanlig flik gör webbläsaren inget — ofarligt */
    }
  }
  /** Facilitator "Avsluta": stäng BÅDA valvens fönster → tillbaka till skrivbordet. */
  function quitStation() {
    adapters.value?.transport.send({ kind: 'quit', payload: null })
    setTimeout(closeWindow, 150)
  }

  /** Registrera aktivitet (för idle-återstart). Lokala anrop pingas till andra
   *  skärmen (strypt) så aktivitet på ETT valv håller BÅDA vakna. */
  function notifyActivity(local = true) {
    lastActivityAt.value = Date.now()
    if (local && Date.now() - lastActivityBroadcast > 3000) {
      lastActivityBroadcast = Date.now()
      adapters.value?.transport.send({ kind: 'activity', payload: null })
    }
  }
  /** App markerar att en körning pågår (efter attract) → idle-återstart aktiv. */
  function setSessionActive(v: boolean) {
    sessionActive.value = v
    if (v) lastActivityAt.value = Date.now()
  }

  /** Starta intro-klippet synkat på BÅDA skärmarna (delad starttid). */
  function beginIntro() {
    if (introStartedAt.value == null) introStartedAt.value = Date.now()
    adapters.value?.transport.send({ kind: 'introStart', payload: introStartedAt.value })
  }

  // --- Onboarding-koordinator (synkad mellan valv) ---
  const onbStage = ref<string>('headset')
  /** Delad starttid för aktuellt ljudblock (epoch-ms), eller null. */
  const onbEpoch = ref<number | null>(null)
  /** Vilka valv som är klara med aktuellt test (barriär). */
  const onbReady = ref<{ lag1: boolean; lag2: boolean }>({ lag1: false, lag2: false })

  /** Gå till ett nytt stage (synkat). Nollställer barriären. Idempotent. */
  function onbGoto(stage: string, epoch: number | null = null) {
    if (onbStage.value === stage) return
    onbStage.value = stage
    onbEpoch.value = epoch
    onbReady.value = { lag1: false, lag2: false }
    adapters.value?.transport.send({ kind: 'onbStage', payload: { stage, epoch } })
  }
  /** Markera ett valv som klart med aktuellt test. */
  function onbMarkReady(vault: TeamId) {
    if (onbReady.value[vault]) return
    onbReady.value = { ...onbReady.value, [vault]: true }
    adapters.value?.transport.send({ kind: 'onbReady', payload: { vault } })
  }

  /** Facilitator-paus (synkad). Vid resume förskjuts aktiv nedräkning framåt så
   *  ingen tid gått förlorad. */
  function setPaused(p: boolean) {
    if (p === paused.value) return
    if (p) {
      paused.value = true
      pausedSince.value = Date.now()
    } else {
      const delta = Date.now() - pausedSince.value
      if (delta > 0) dispatch({ type: 'shiftTimer', deltaMs: delta })
      paused.value = false
    }
    adapters.value?.transport.send({
      kind: 'pause',
      payload: { paused: paused.value, since: pausedSince.value },
    })
  }
  function togglePause() {
    setPaused(!paused.value)
  }

  /** Dispatch: applicera lokalt, broadcasta, kör sidoeffekter. */
  function dispatch(action: Action) {
    const next = reduce(state.value, action)
    if (next === state.value) return
    state.value = next
    applyEffects()
    broadcast()
  }

  // --- Publika spelhandlingar ---
  interface StartOpts {
    getReadyFirst: number | null
    getReady: number | null
    negotiation: number | null
    /** 0 = ingen reveal-popup (popupar visas av test-vyn); >0 timad; null klick. */
    reveal: number | null
  }
  function start(datasetId: string, opts: StartOpts) {
    const dataset = ALL_DATASETS.find((d) => d.id === datasetId) ?? DATASETS[0]
    dispatch({
      type: 'start',
      dataset,
      negotiationSeconds: opts.negotiation,
      getReadyFirstSeconds: opts.getReadyFirst,
      getReadySeconds: opts.getReady,
      revealSeconds: opts.reveal,
      now: Date.now(),
    })
  }
  /** Test 1: 1 resurs, 50 kr. Startar PAUSAD (popupar visas över UI:t) → armas. */
  function startTest1() {
    const tm = ROUND_TIMERS.test1
    start(TEST1_DATASET.id, { getReadyFirst: null, getReady: tm.getReady, negotiation: tm.negotiation, reveal: 0 })
  }
  /** Test 2: 3 resurser, 60 kr. Startar PAUSAD → armas efter popupar. */
  function startTest2() {
    const tm = ROUND_TIMERS.test2
    start(TRIAL_DATASET.id, { getReadyFirst: null, getReady: tm.getReady, negotiation: tm.negotiation, reveal: 0 })
  }
  /** Starta den pausade getready-nedräkningen (efter test-popuparna). */
  function armGetReady(seconds: number) {
    dispatch({ type: 'armGetReady', seconds, now: Date.now() })
  }
  /** Skarp körning: 5 resurser, 100 kr. */
  function startLive() {
    const tm = ROUND_TIMERS.live
    start(LIVE_DATASET_ID, {
      getReadyFirst: tm.getReadyFirst,
      getReady: tm.getReady,
      negotiation: tm.negotiation,
      reveal: 0,
    })
  }
  const isTrial = computed(() => state.value.datasetId === 'trial')
  const isTest = computed(() => ['test1', 'trial'].includes(state.value.datasetId))
  function finishReveal() {
    dispatch({ type: 'finishReveal', now: Date.now() })
  }
  function beginNegotiation() {
    dispatch({ type: 'beginNegotiation', now: Date.now() })
  }
  function finishNegotiation() {
    dispatch({ type: 'finishNegotiation', now: Date.now() })
  }
  function chooseWinner(winner: TeamId) {
    dispatch({ type: 'chooseWinner', winner })
  }
  function enterPrice(price: number) {
    dispatch({ type: 'enterPrice', price })
  }
  function noBuy() {
    dispatch({ type: 'noBuy', now: Date.now() })
  }
  function cancelEntry() {
    audio.play('deny')
    dispatch({ type: 'cancelEntry' })
  }
  function confirmPurchase() {
    holdActiveUntil.value = Date.now() + config.nextHatchDelayMs
    dispatch({ type: 'confirmPurchase', now: Date.now() })
  }
  function submitGuess(team: TeamId, resource: string) {
    dispatch({ type: 'submitGuess', team, resource })
  }
  /** Nollställ hela sessionen (spel + onboarding + paus). `broadcastReset`
   *  false när anropet kommer FRÅN en peer (undviker eko-loop). */
  function reset(broadcastReset = true) {
    resultSent = false
    prevPhase = 'intro'
    prevStep = 'negotiating'
    prevResultCount = 0
    adapters.value?.lights.reset()
    introStartedAt.value = null
    paused.value = false
    pausedSince.value = 0
    sessionActive.value = false
    onbStage.value = 'headset'
    onbEpoch.value = null
    onbReady.value = { lag1: false, lag2: false }
    dispatch({ type: 'reset', members: defaultRoster() })
    lastActivityAt.value = Date.now()
    resetSignal.value += 1
    if (broadcastReset) adapters.value?.transport.send({ kind: 'sessionReset', payload: null })
  }

  function setView(v: ViewSide) {
    view.value = v
    if (typeof window !== 'undefined') window.location.hash = v
  }

  // --- Lag-hjälp ---
  function teamName(id: TeamId): string {
    return `VALV ${TEAMS[id].name}`
  }
  function teamConfig(id: TeamId) {
    return TEAMS[id]
  }

  // --- Resultat (§5.3) ---
  function buildResultPayload(): ResultPayload {
    const pr = personResults(state.value)
    const all = [...pr.lag1, ...pr.lag2]
    const sum = (role: 'A' | 'B') =>
      all.filter((p) => p.assigned_role === role).reduce((a, p) => a + p.result_value, 0)
    return {
      grupp: 'pilot',
      rollresultat_A: sum('A'),
      rollresultat_B: sum('B'),
      personer: all,
    }
  }
  function sendResult() {
    adapters.value?.result.send(buildResultPayload())
  }

  // --- Livscykel ---
  function init() {
    adapters.value = createAdapters()
    unsub = adapters.value.transport.subscribe(onMessage)
    adapters.value.transport.send({ kind: 'hello', payload: null })

    timerHandle = setInterval(() => {
      now.value = Date.now()
      if (adapters.value) adapters.value.lights.set(lights.value)
      const s = state.value
      // Nedräkningar: reveal → getready → förhandling → avräkning. Fryst vid paus.
      if (!paused.value && s.phase === 'bidding' && s.hatchTimerEndsAt != null && now.value >= s.hatchTimerEndsAt) {
        if (s.step === 'reveal') finishReveal()
        else if (s.step === 'getready') beginNegotiation()
        else if (s.step === 'negotiating') finishNegotiation()
      }
      // Idle-återstart: ingen aktivitet på länge → ledaren nollställer (synkat).
      const leaderView = view.value === 'shared' || view.value === 'lag1'
      if (sessionActive.value && !paused.value && IDLE_MS > 0 && leaderView && now.value - lastActivityAt.value >= IDLE_MS) {
        reset()
      }
    }, 250)
  }
  function dispose() {
    unsub?.()
    if (timerHandle) clearInterval(timerHandle)
    adapters.value?.transport.close()
  }

  return {
    // state
    state,
    view,
    selectedDataset,
    phase,
    step,
    lights,
    hatchCells,
    currentResource,
    doneCount,
    secondsLeft,
    // helpers
    opponentOf,
    teamName,
    teamConfig,
    isTrial,
    isTest,
    introStartedAt,
    onbStage,
    onbEpoch,
    onbReady,
    paused,
    resetSignal,
    now,
    lastActivityAt,
    idleWarn,
    idleSecondsLeft,
    // actions
    beginIntro,
    onbGoto,
    onbMarkReady,
    setPaused,
    togglePause,
    notifyActivity,
    setSessionActive,
    quitStation,
    start,
    startTest1,
    startTest2,
    startLive,
    armGetReady,
    finishReveal,
    beginNegotiation,
    finishNegotiation,
    chooseWinner,
    enterPrice,
    noBuy,
    cancelEntry,
    confirmPurchase,
    submitGuess,
    reset,
    setView,
    buildResultPayload,
    // lifecycle
    init,
    dispose,
  }
})
