/**
 * F1 "Vem sa det?" — logik för Förhandlingens väntläge.
 *
 * Väntlek (räknas INTE, matar aldrig sorteringen): en person i taget läser en
 * kort rad genom det maskerade headsetet, resten gissar vem som pratade genom
 * att trycka på ett namn. En gemensam gruppgissning per runda. Ett "varv" =
 * varje incheckad har läst en gång; sedan resultat, och leken är loopbar.
 *
 * Den här filen håller den RENA, testbara logiken (rad-bank, blandning, poäng)
 * + en tunn Vue-composable som binder ihop den med reaktivitet och ljud. Ingen
 * DOM — allt UI bor i VemSaDet.vue.
 */
import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { audio } from '@/station-kit/audio/AudioEngine'

/** En avklarad runda i resultatlistan. */
export interface VemRound {
  /** Raden som lästes upp. */
  line: string
  /** Vem som faktiskt läste (facit). */
  reader: string
  /** Gruppens gemensamma gissning. */
  guess: string
  /** Gissade gruppen rätt? */
  correct: boolean
}

/**
 * Rad-bank: korta, absurda svenska rader att läsa högt genom masken. Masken
 * gör alla lika löjliga → att gissa fel är hela poängen. Lätt att utöka —
 * lägg bara till fler strängar. (Medvetet INTE i i18n: innehåll, inte chrome,
 * och ljudleken körs bara på svenska i piloten.)
 */
export const VEM_LINES: string[] = [
  'Jag har aldrig litat på en banan som ler tillbaka.',
  'Min teori är att månen är rymdens parkeringsvakt.',
  'Ge mig tre pilkastningspokaler och en lagom arg igelkott.',
  'Sanningen är att soppa egentligen är en dryck man gett upp om.',
  'Jag förhandlar bara med folk som viker sina strumpor rätt.',
  'En gång åt jag frukost så snabbt att tisdagen tog slut.',
  'Alla mina bästa idéer kommer från en groda jag kallar Direktören.',
  'Det här valvet luktar som en dammsugares semesterminnen.',
  'Jag kräver en reservplanet, och den ska vara turkos.',
  'Egentligen är jag tre ekorrar i en förhandlingskostym.',
  'Min farmor sa alltid: lita aldrig på en hiss som nynnar.',
  'Jag byter min röst mot en kexchoklad och ett vänligt ord.',
  'Vattnet smakar misstänkt mycket som ett olöst brott.',
  'Om ni inte går med på mitt bud släpper jag lös gelefanterna.',
  'Jag har räknat alla stjärnor och två av dem fuskar.',
  'Hemligheten med framgång är att alltid skylla på en vindpust.',
]

/** Fisher–Yates: en blandad kopia (muterar inte indatan). `rng` för test. */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Räkna rätt/totalt över avklarade rundor. */
export function scoreRounds(rounds: readonly VemRound[]): { correct: number; total: number } {
  return { correct: rounds.filter((r) => r.correct).length, total: rounds.length }
}

export type VemPhase = 'attract' | 'reader' | 'read' | 'guess' | 'reveal' | 'result'

export interface VemSaDet {
  phase: Ref<VemPhase>
  participants: ComputedRef<string[]>
  /** Läsare som ännu INTE läst detta varv (för att gråa ut i läsarvalet). */
  availableReaders: ComputedRef<string[]>
  currentReader: Ref<string | null>
  currentLine: Ref<string>
  lastGuess: Ref<string | null>
  lastCorrect: Ref<boolean>
  rounds: Ref<VemRound[]>
  roundNumber: ComputedRef<number>
  totalRounds: ComputedRef<number>
  score: ComputedRef<{ correct: number; total: number }>
  /** Attract → första varvet. */
  begin: () => void
  /** SÖM för läsar-identifiering: pilot = tryck eget namn, drift = band-bipp.
   *  Byt anroparen (RFID-bipp → denna funktion) utan att röra resten. */
  identifyReader: (name: string) => void
  /** Läsaren är klar med att läsa högt → gruppen gissar. */
  readingDone: () => void
  /** EN gemensam gruppgissning per runda. */
  submitGuess: (name: string) => void
  /** Reveal → nästa runda, eller resultat när varvet är slut. */
  next: () => void
  /** Resultat → nytt varv (loopbar hur många gånger som helst). */
  playAgain: () => void
}

/**
 * Composable: driver F1-flödet för EN session.
 * @param names  incheckade deltagare (hela gruppen) — från `checkedInParticipants()`.
 */
export function useVemSaDet(names: string[]): VemSaDet {
  const participants = computed(() => names)

  const phase = ref<VemPhase>('attract')
  /** Läsare kvar att ta turen detta varv (blandad ordning). */
  const readerPool = ref<string[]>([])
  /** Rad-"kortlek" för varvet så rader inte upprepas inom ett varv. */
  const lineDeck = ref<string[]>([])
  const currentReader = ref<string | null>(null)
  const currentLine = ref<string>('')
  const lastGuess = ref<string | null>(null)
  const lastCorrect = ref<boolean>(false)
  const rounds = ref<VemRound[]>([])

  const availableReaders = computed(() => readerPool.value.slice())
  const roundNumber = computed(() => rounds.value.length + 1)
  const totalRounds = computed(() => participants.value.length)
  const score = computed(() => scoreRounds(rounds.value))

  function startVarv() {
    rounds.value = []
    readerPool.value = shuffle(participants.value)
    lineDeck.value = shuffle(VEM_LINES)
    currentReader.value = null
    currentLine.value = ''
    lastGuess.value = null
    phase.value = 'reader'
  }

  function begin() {
    startVarv()
  }

  function drawLine(): string {
    if (lineDeck.value.length === 0) lineDeck.value = shuffle(VEM_LINES)
    return lineDeck.value.shift() ?? VEM_LINES[0]
  }

  function identifyReader(name: string) {
    if (phase.value !== 'reader') return
    if (!readerPool.value.includes(name)) return
    currentReader.value = name
    readerPool.value = readerPool.value.filter((n) => n !== name)
    currentLine.value = drawLine()
    lastGuess.value = null
    audio.play('bipstart')
    phase.value = 'read'
  }

  function readingDone() {
    if (phase.value !== 'read') return
    audio.play('headset')
    phase.value = 'guess'
  }

  function submitGuess(name: string) {
    if (phase.value !== 'guess' || currentReader.value == null) return
    const correct = name === currentReader.value
    lastGuess.value = name
    lastCorrect.value = correct
    rounds.value = [
      ...rounds.value,
      { line: currentLine.value, reader: currentReader.value, guess: name, correct },
    ]
    audio.play(correct ? 'positive' : 'deny')
    phase.value = 'reveal'
  }

  function next() {
    if (phase.value !== 'reveal') return
    if (readerPool.value.length === 0) {
      audio.play('win')
      phase.value = 'result'
    } else {
      currentReader.value = null
      currentLine.value = ''
      lastGuess.value = null
      phase.value = 'reader'
    }
  }

  function playAgain() {
    startVarv()
  }

  return {
    phase,
    participants,
    availableReaders,
    currentReader,
    currentLine,
    lastGuess,
    lastCorrect,
    rounds,
    roundNumber,
    totalRounds,
    score,
    begin,
    identifyReader,
    readingDone,
    submitGuess,
    next,
    playAgain,
  }
}
