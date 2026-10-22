import { describe, it, expect } from 'vitest'
import { shuffle, scoreRounds, VEM_LINES, type VemRound } from './vemSaDet'

describe('shuffle', () => {
  it('behåller alla element (permutation) och muterar inte indatan', () => {
    const input = [1, 2, 3, 4, 5]
    const out = shuffle(input, () => 0.42)
    expect(out).toHaveLength(input.length)
    expect([...out].sort((a, b) => a - b)).toEqual(input)
    expect(input).toEqual([1, 2, 3, 4, 5]) // oförändrad
  })

  it('deterministisk med given rng', () => {
    const seq = [0.1, 0.9, 0.3, 0.7]
    let i = 0
    const rng = () => seq[i++ % seq.length]
    const a = shuffle(['a', 'b', 'c', 'd'], rng)
    i = 0
    const b = shuffle(['a', 'b', 'c', 'd'], rng)
    expect(a).toEqual(b)
  })
})

describe('scoreRounds', () => {
  const mk = (correct: boolean): VemRound => ({ line: 'x', reader: 'A', guess: 'A', correct })
  it('räknar rätt och totalt', () => {
    expect(scoreRounds([mk(true), mk(false), mk(true)])).toEqual({ correct: 2, total: 3 })
    expect(scoreRounds([])).toEqual({ correct: 0, total: 0 })
  })
})

describe('VEM_LINES', () => {
  it('har fler rader än en typisk grupp (>6) så ett varv inte upprepar', () => {
    expect(VEM_LINES.length).toBeGreaterThan(6)
    expect(new Set(VEM_LINES).size).toBe(VEM_LINES.length) // unika
  })
})
