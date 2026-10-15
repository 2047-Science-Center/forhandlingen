/**
 * Ljudmotor — SYNTETISERAD SFX via Web Audio, med VALFRITT sampel-lager.
 *
 * Standard: allt syntetiseras (inga ljudfiler). När de genererade ljudfilerna
 * i public/Sound/sfx/ (se public/Sound/SFX-MANIFEST.md) finns: sätt
 * SAMPLES_ENABLED = true — då spelas filen om den laddats, annars faller
 * motorn tillbaka på samma händelses syntes (ljud är aldrig kritiskt).
 *
 * Kiosk-autoplay: AudioContext skapas låst och låses upp på första
 * användargesten (attract-/"tryck för att börja"-skärmen). Global mute + volym.
 */

export type Sfx =
  | 'blip' // tangent-blip (teletype)
  | 'confirm' // bekräfta-pling
  | 'deny' // neka/fel-surr
  | 'render' // bild-render-svep
  | 'hatch' // lucka-tänd-blip
  | 'win' // vinst-fanfar
  | 'boot' // boot-sekvens
  | 'lockin' // lås in bud/pris (tyngre än confirm)
  | 'nobuy' // ingen köper luckan
  | 'popup' // popup/ruta slår upp
  | 'tick' // nedräkningstick
  | 'tickfinal' // sista tick (3-2-1-nu)
  | 'live' // övergång träning -> skarpt
  | 'stamp' // stämpel (livsviktig resurs markeras)
  | 'idlewarn' // "återställs strax"-varning

/**
 * Valfritt sampel-lager. Filnamn relativt public/Sound/sfx/. Av som standard
 * (filerna är inte genererade än) — se SFX-MANIFEST.md. 'blip' ligger medvetet
 * UTANFÖR: den avfyras per tecken i Teletype och ska alltid vara syntes
 * (noll latens, ingen upprepad sampel-känsla).
 */
export const SAMPLES_ENABLED = true
export const SAMPLE_FILES: Partial<Record<Sfx, string>> = {
  boot: 'sfx-boot.mp3',
  hatch: 'sfx-hatch-open.mp3',
  confirm: 'sfx-confirm.mp3',
  lockin: 'sfx-lock-in.mp3',
  deny: 'sfx-deny.mp3',
  win: 'sfx-win-fanfare.mp3',
  nobuy: 'sfx-nobuy.mp3',
  popup: 'sfx-popup.mp3',
  tick: 'sfx-tick.mp3',
  tickfinal: 'sfx-tick-final.mp3',
  live: 'sfx-phase-live.mp3',
  render: 'sfx-render.mp3',
  stamp: 'sfx-stamp.mp3',
  idlewarn: 'sfx-idle-warn.mp3',
}

class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private _muted = false
  private _volume = 0.6
  private unlocked = false
  private buffers = new Map<Sfx, AudioBuffer>()

  get muted(): boolean {
    return this._muted
  }

  get volume(): number {
    return this._volume
  }

  setMuted(muted: boolean): void {
    this._muted = muted
    if (this.master) {
      this.master.gain.value = muted ? 0 : this._volume
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this._muted)
    return this._muted
  }

  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v))
    if (this.master && !this._muted) {
      this.master.gain.value = this._volume
    }
  }

  /** Lås upp ljudkontexten — anropas på första användargesten. */
  unlock(): void {
    if (this.unlocked) return
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = this._muted ? 0 : this._volume
      this.master.connect(this.ctx.destination)
      this.unlocked = true
    } catch {
      // Ljud är icke-kritiskt — spelet funkar utan.
      this.unlocked = false
    }
    void this.ctx?.resume()
    if (this.unlocked && SAMPLES_ENABLED) void this.loadSamples()
  }

  /** Förladda sampel; allt som saknas/fallerar ignoreras (syntes tar över). */
  private async loadSamples(): Promise<void> {
    const ctx = this.ctx
    if (!ctx) return
    const base = import.meta.env.BASE_URL
    await Promise.all(
      (Object.entries(SAMPLE_FILES) as [Sfx, string][]).map(async ([sfx, file]) => {
        try {
          const res = await fetch(`${base}Sound/sfx/${file}`)
          if (!res.ok) return
          const buf = await ctx.decodeAudioData(await res.arrayBuffer())
          this.buffers.set(sfx, buf)
        } catch {
          // saknas/ogiltig fil -> syntes
        }
      }),
    )
  }

  private playBuffer(sfx: Sfx): boolean {
    const buf = this.buffers.get(sfx)
    if (!buf || !this.ctx || !this.master) return false
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.connect(this.master)
    src.start()
    return true
  }

  /** En enkel ton med envelope. */
  private tone(
    freq: number,
    start: number,
    dur: number,
    type: OscillatorType,
    peak: number,
  ): void {
    if (!this.ctx || !this.master) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(start)
    osc.stop(start + dur + 0.02)
  }

  /** Ett frekvenssvep (render, boot). */
  private sweep(
    from: number,
    to: number,
    start: number,
    dur: number,
    type: OscillatorType,
    peak: number,
  ): void {
    if (!this.ctx || !this.master) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(from, start)
    osc.frequency.linearRampToValueAtTime(to, start + dur)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(start)
    osc.stop(start + dur + 0.02)
  }

  /** En kort ton med given frekvens — för stegrande budljud (intro). */
  beep(freq: number, dur = 0.12): void {
    if (this._muted || !this.ctx || !this.master) return
    this.tone(freq, this.ctx.currentTime, dur, 'square', 0.12)
  }

  play(sfx: Sfx): void {
    if (this._muted || !this.ctx || !this.master) return
    if (this.playBuffer(sfx)) return
    const now = this.ctx.currentTime
    switch (sfx) {
      case 'blip':
        this.tone(1200 + Math.random() * 300, now, 0.03, 'square', 0.08)
        break
      case 'confirm':
        this.tone(660, now, 0.09, 'triangle', 0.18)
        this.tone(990, now + 0.08, 0.12, 'triangle', 0.18)
        break
      case 'deny':
        this.tone(180, now, 0.18, 'sawtooth', 0.16)
        this.tone(140, now + 0.05, 0.2, 'sawtooth', 0.14)
        break
      case 'render':
        this.sweep(220, 1400, now, 0.35, 'sawtooth', 0.06)
        break
      case 'hatch':
        this.tone(880, now, 0.05, 'square', 0.12)
        this.tone(1320, now + 0.04, 0.06, 'square', 0.1)
        break
      case 'win':
        this.tone(523, now, 0.12, 'triangle', 0.2)
        this.tone(659, now + 0.11, 0.12, 'triangle', 0.2)
        this.tone(784, now + 0.22, 0.12, 'triangle', 0.2)
        this.tone(1047, now + 0.33, 0.22, 'triangle', 0.22)
        break
      case 'boot':
        this.sweep(80, 520, now, 0.5, 'sawtooth', 0.1)
        this.tone(660, now + 0.55, 0.08, 'square', 0.12)
        break
      // --- Nya semantiska händelser: samma palett (fyrkant/triangel, kvint +
      // durtriad, korta bärnstensblippar), bara fler roller. ---
      case 'lockin': // två tunga fyrkantsslag, kvint upp: "klack-KLACK"
        this.tone(330, now, 0.07, 'square', 0.16)
        this.tone(495, now + 0.07, 0.14, 'square', 0.16)
        this.tone(990, now + 0.07, 0.18, 'triangle', 0.1)
        break
      case 'nobuy': // mjuk sjunkande kvint, ingen aggressivitet
        this.tone(440, now, 0.12, 'triangle', 0.16)
        this.tone(294, now + 0.11, 0.22, 'triangle', 0.16)
        break
      case 'popup': // litet uppåtsvep + blipp
        this.sweep(500, 900, now, 0.09, 'square', 0.06)
        this.tone(1320, now + 0.08, 0.05, 'square', 0.08)
        break
      case 'tick':
        this.tone(880, now, 0.04, 'square', 0.1)
        break
      case 'tickfinal':
        this.tone(1320, now, 0.22, 'square', 0.14)
        this.tone(660, now, 0.22, 'triangle', 0.12)
        break
      case 'live': // boot-svepet fast högre + durtriad: "nu är det på riktigt"
        this.sweep(120, 780, now, 0.45, 'sawtooth', 0.1)
        this.tone(523, now + 0.5, 0.1, 'triangle', 0.18)
        this.tone(784, now + 0.58, 0.1, 'triangle', 0.18)
        this.tone(1047, now + 0.66, 0.3, 'triangle', 0.2)
        break
      case 'stamp': // dov stämpel + kort klick
        this.sweep(160, 70, now, 0.12, 'sawtooth', 0.2)
        this.tone(1100, now + 0.02, 0.03, 'square', 0.08)
        break
      case 'idlewarn': // två milda upprepade blippar
        this.tone(660, now, 0.1, 'triangle', 0.14)
        this.tone(660, now + 0.22, 0.1, 'triangle', 0.14)
        break
    }
  }
}

/** Singleton — en ljudmotor per kiosk. */
export const audio = new AudioEngine()
