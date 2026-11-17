/**
 * "Vem där?" — Förhandlingens lek-läge (lila). Ren logik (ingen Vue/DOM), testad i vemDar.test.ts.
 *
 * En runda: talarsidan väljer vem som tar headsetet (trycker på sitt namn) → talaren
 * säger en rad / svarar på en fråga genom den maskerade rösten → motsidan trycker på
 * vem de tror pratar (de får ställa EN egen fråga) → facit → sidan byts.
 * Lurar talaren motsidan får talarens valv poäng; gissar de rätt får gissarna poäng.
 * Poängen finns bara i RAM och räknas aldrig (XY-VANTUPPGIFTER.md §0).
 */
import type { LekAction } from '@/station-kit/lek/lekSync'
import { pickIndex } from '@/station-kit/lek/lekSync'

export type Side = 'A' | 'B'
export const SIDE_NAME: Record<Side, string> = { A: 'Valv Syd', B: 'Valv Nord' }
export const other = (s: Side): Side => (s === 'A' ? 'B' : 'A')

export interface VemPerson {
  band_id: string
  name: string
  /** Sidan personen står på (entrén). null = okänd → personen räknas till båda sidor. */
  side: Side | null
}

export interface VemPrompt {
  /** 'las' = läs raden högt · 'svara' = svara på frågan med egna ord. */
  kind: 'las' | 'svara'
  text: string
}

/** Kurerad bank: ofarligt, lite knasigt, funkar för 13–16 år. */
export const VEM_PROMPTS: VemPrompt[] = [
  { kind: 'las', text: 'Jag har aldrig litat på en banan som ler tillbaka.' },
  { kind: 'las', text: 'Månen är egentligen rymdens parkeringsvakt.' },
  { kind: 'las', text: 'Ge mig tre pannkakor och en lagom arg igelkott.' },
  { kind: 'las', text: 'Soppa är en dryck som har gett upp.' },
  { kind: 'las', text: 'Jag förhandlar bara med folk som viker sina strumpor.' },
  { kind: 'las', text: 'Min katt tycker att jag är hennes husdjur.' },
  { kind: 'las', text: 'Jag byter min röst mot en kexchoklad.' },
  { kind: 'las', text: 'Det här är ingen röst. Det är en ostkupa med åsikter.' },
  { kind: 'svara', text: 'Vad åt du till frukost i dag?' },
  { kind: 'svara', text: 'Vilket djur skulle du helst vara en dag — och varför?' },
  { kind: 'svara', text: 'Berätta om din bästa sommardag.' },
  { kind: 'svara', text: 'Vilken superkraft vill du ha?' },
  { kind: 'svara', text: 'Vad är det konstigaste du har ätit?' },
  { kind: 'svara', text: 'Vilken låt skulle du sjunga på karaoke?' },
  { kind: 'svara', text: 'Om du fick bestämma över skolan en dag — vad blir första regeln?' },
  { kind: 'svara', text: 'Vad gör du helst en regnig söndag?' },
  { kind: 'svara', text: 'Vilket är världens bästa godis?' },
  { kind: 'svara', text: 'Vad vill du uppfinna?' },
]

/** Tider (ms). Leken är mikrorundor → allt kort. */
export const VEM_TIMES = {
  /** Max taltid innan rundan avgörs utan gissning (talaren vinner). */
  speakMs: 60_000,
  /** Facit visas så här länge, sedan byts sidan. */
  revealMs: 7_000,
} as const

export type VemPhase = 'pick' | 'speak' | 'reveal'

export interface VemState {
  phase: VemPhase
  /** Sidan som pratar den här rundan. */
  speakerSide: Side
  /** band_id för den som pratar (null tills vald). */
  speaker: string | null
  speakerName: string
  prompt: number
  /** Gissningen (band_id) — null = ingen hann gissa. */
  guess: string | null
  correct: boolean | null
  score: Record<Side, number>
  rounds: number
  /** Ledarens klocka när fasen började. */
  phaseAt: number
}

export function initialVem(now = 0): VemState {
  return {
    phase: 'pick',
    speakerSide: 'A',
    speaker: null,
    speakerName: '',
    prompt: 0,
    guess: null,
    correct: null,
    score: { A: 0, B: 0 },
    rounds: 0,
    phaseAt: now,
  }
}

export function reduceVem(s: VemState, a: LekAction, now: number, rnd: () => number = Math.random): VemState {
  switch (a.type) {
    case 'pick': {
      if (s.phase !== 'pick') return s
      return {
        ...s,
        phase: 'speak',
        speaker: String(a.band_id),
        speakerName: String(a.name ?? ''),
        prompt: pickIndex(VEM_PROMPTS.length, s.prompt, rnd),
        guess: null,
        correct: null,
        phaseAt: now,
      }
    }
    case 'guess': {
      if (s.phase !== 'speak') return s
      const guess = String(a.band_id)
      const correct = guess === s.speaker
      const winner: Side = correct ? other(s.speakerSide) : s.speakerSide
      return {
        ...s,
        phase: 'reveal',
        guess,
        correct,
        score: { ...s.score, [winner]: s.score[winner] + 1 },
        rounds: s.rounds + 1,
        phaseAt: now,
      }
    }
    case 'tick': {
      if (s.phase === 'speak' && now - s.phaseAt >= VEM_TIMES.speakMs) {
        return {
          ...s,
          phase: 'reveal',
          guess: null,
          correct: false,
          score: { ...s.score, [s.speakerSide]: s.score[s.speakerSide] + 1 },
          rounds: s.rounds + 1,
          phaseAt: now,
        }
      }
      if (s.phase === 'reveal' && now - s.phaseAt >= VEM_TIMES.revealMs) return next(s, now)
      return s
    }
    case 'next':
      return s.phase === 'reveal' ? next(s, now) : s
    case 'skip':
      // Talarsidan har ingen som vill/kan — byt sida utan poäng.
      return s.phase === 'pick' ? { ...s, speakerSide: other(s.speakerSide), phaseAt: now } : s
    default:
      return s
  }
}

function next(s: VemState, now: number): VemState {
  return {
    ...s,
    phase: 'pick',
    speakerSide: other(s.speakerSide),
    speaker: null,
    speakerName: '',
    guess: null,
    correct: null,
    phaseAt: now,
  }
}

/** Personerna på en sida (okänd sida → med på båda). Tom sida → alla (fallback). */
export function peopleOn(people: VemPerson[], side: Side): VemPerson[] {
  const on = people.filter((p) => p.side === side || p.side == null)
  return on.length ? on : people
}
