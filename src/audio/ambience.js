// Background layers: a soft wind bed, birdsong in the meadow, and a light
// procedural marimba tune (I-V-vi-IV, pentatonic melody) scheduled ahead on
// the audio clock so it never drifts with the frame rate.
import { AUDIO } from '../config.js'
import { A, onStart } from './core.js'
import { modal, rnd, tone, burst } from './synth.js'

const MARIMBA = [[1, 1, 0.55], [3.93, 0.22, 0.12], [10.7, 0.04, 0.03]]
let music = null // gain node
let musicOn = true
let wind = null

onStart((ctx) => {
  // Wind: stereo pink noise, low-passed, slowly breathing.
  const src = ctx.createBufferSource()
  src.buffer = A.noise.pinkStereo
  src.loop = true
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 520
  wind = ctx.createGain()
  wind.gain.value = 0.05
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.07
  const lg = ctx.createGain()
  lg.gain.value = 0.025
  lfo.connect(lg).connect(wind.gain)
  src.connect(lp).connect(wind).connect(A.amb)
  src.start()
  lfo.start()

  music = ctx.createGain()
  music.gain.value = musicOn ? AUDIO.music : 0
  music.connect(A.master)
  startMusic(ctx)
})

export function setMusic(on) {
  musicOn = on
  if (music) music.gain.setTargetAtTime(on ? AUDIO.music : 0, A.ctx.currentTime, 0.3)
}

// --- Music -------------------------------------------------------------------------------------
const BPM = 104
const BEAT = 60 / BPM
// Chords as semitone offsets from C4 (I, V, vi, IV), 2 bars each... 1 bar = 4 beats.
const CHORDS = [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0]]
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16]
const C4 = 261.63
const f = (n) => C4 * Math.pow(2, n / 12)
let nextBeat = 0
let beatIndex = 0
let melody = []

function startMusic(ctx) {
  nextBeat = ctx.currentTime + 0.5
  setInterval(() => schedule(ctx), 120)
}

function newPhrase() {
  // A 16-step (eighth-note) phrase over 2 bars, walking the pentatonic scale.
  melody = []
  let idx = Math.floor(rnd(2, 6))
  for (let i = 0; i < 16; i++) {
    if (Math.random() < 0.38) {
      melody.push(null)
      continue
    }
    idx = Math.max(0, Math.min(PENTA.length - 1, idx + Math.round(rnd(-2, 2))))
    melody.push(PENTA[idx] + 12)
  }
}

function schedule(ctx) {
  if (!music || ctx.state !== 'running') return
  if (nextBeat < ctx.currentTime) nextBeat = ctx.currentTime + 0.05
  while (nextBeat < ctx.currentTime + 0.4) {
    const t = nextBeat
    const bar = Math.floor(beatIndex / 4)
    const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length]
    const beatInBar = beatIndex % 4
    if (beatIndex % 8 === 0) newPhrase()
    // Bass on beats 1 and 3.
    if (beatInBar === 0 || beatInBar === 2) tone({ t, f: f(chord[0] - 12), d: BEAT * 1.6, a: 0.01, gain: 0.32, bus: music, lp: 600 })
    // Marimba chord arpeggio on the off-beats.
    const arp = chord[(beatIndex * 2) % 3]
    modal({ t: t + BEAT / 2, f: f(arp), modes: MARIMBA, gain: 0.16, bus: music })
    // Melody: two eighth notes per beat.
    for (let k = 0; k < 2; k++) {
      const n = melody[((beatIndex % 8) * 2 + k) % 16]
      if (n != null) modal({ t: t + (k * BEAT) / 2, f: f(n), modes: MARIMBA, gain: 0.2, bus: music })
    }
    // Shaker.
    burst({ t, type: 'highpass', f: 6000, q: 0.5, a: 0.004, d: 0.05, gain: beatInBar % 2 ? 0.05 : 0.09, bus: music })
    burst({ t: t + BEAT / 2, type: 'highpass', f: 7000, q: 0.5, a: 0.004, d: 0.04, gain: 0.04, bus: music })
    nextBeat += BEAT
    beatIndex++
  }
}

// --- Birds ------------------------------------------------------------------------------------------
let birdTimer = 3
function chirp(t, pan) {
  const base = rnd(2400, 4200)
  const n = Math.floor(rnd(2, 6))
  for (let i = 0; i < n; i++) {
    const at = t + i * rnd(0.07, 0.13)
    tone({ t: at, f: base * rnd(0.9, 1.1), f2: base * rnd(1.2, 1.6), glide: 0.05, a: 0.005, d: 0.06, gain: 0.025, pan, bus: A.amb, verb: 0.3 })
  }
}

export function update(dt, { inLane }) {
  if (!A.master) return
  birdTimer -= dt
  if (birdTimer <= 0) {
    birdTimer = rnd(1.5, inLane ? 4 : 7)
    chirp(A.ctx.currentTime + 0.05, rnd(-0.8, 0.8))
  }
}
