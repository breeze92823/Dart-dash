// Every one-shot sound, synthesised from physical recipes (synth.js): no
// files. Nothing here throws or plays before the first gesture; each export
// returns quietly when audio isn't running or the voice budget is spent.
// World sounds take a position and are panned / attenuated from the listener.
import { COARSE_POINTER } from '../config.js'
import { A, isMuted, now, voice } from './core.js'
import { bubble, burst, crinkle, modal, rnd, tone, vary } from './synth.js'

const COIN = [[1, 1, 0.5], [1.504, 0.6, 0.36], [2.24, 0.45, 0.26], [2.71, 0.3, 0.18], [3.47, 0.22, 0.12], [4.03, 0.12, 0.08]]
const GLOCK = [[1, 1, 1.4], [2.756, 0.32, 0.45], [5.404, 0.1, 0.18], [8.933, 0.04, 0.08]]
const BELL = [[0.5, 0.3, 1.5], [1, 1, 1.3], [1.19, 0.45, 1], [1.5, 0.3, 0.85], [2, 0.42, 0.75], [2.5, 0.18, 0.5], [2.66, 0.22, 0.45], [3.01, 0.1, 0.35]]
const WOOD = [[1, 1, 0.07], [2.57, 0.45, 0.035], [4.2, 0.22, 0.016], [6.1, 0.08, 0.01]]
const PLASTIC = [[1, 1, 0.026], [2.31, 0.5, 0.016], [3.93, 0.28, 0.01]]
const MARIMBA = [[1, 1, 0.5], [3.93, 0.25, 0.12], [10.7, 0.05, 0.03]]
const semi = (n) => Math.pow(2, n / 12)
const C6 = 1046.5

// --- Bookkeeping ----------------------------------------------------------------------------
const lastAt = new Map()
function limit(name, ms) {
  const t = performance.now()
  if (t - (lastAt.get(name) ?? -1e9) < ms) return false
  lastAt.set(name, t)
  return true
}
let claimed = -1e9
const claim = () => (claimed = performance.now())
export const claimedRecently = (ms = 80) => performance.now() - claimed < ms
function buzz(pattern) {
  if (!COARSE_POINTER || isMuted()) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Not allowed.
  }
}

// Listener (camera) for spatial one-shots; index.js updates it each frame.
const L = { x: 0, y: 0, z: 0, rx: 1, rz: 0 }
export function setListener(x, y, z, rx, rz) {
  L.x = x
  L.y = y
  L.z = z
  L.rx = rx
  L.rz = rz
}
// { gain, pan } for a world position (ref m = distance at half level).
function at(p, ref = 14) {
  if (!p) return { gain: 1, pan: 0 }
  const dx = p.x - L.x
  const dy = p.y - L.y
  const dz = p.z - L.z
  const d = Math.hypot(dx, dy, dz)
  const pan = d > 0.5 ? Math.max(-0.85, Math.min(0.85, (dx * L.rx + dz * L.rz) / d)) : 0
  return { gain: 1 / (1 + d / ref), pan, d }
}

// --- UI --------------------------------------------------------------------------------------------
export function click(pan = 0) {
  if (!limit('click', 30) || !voice(0.1, 2)) return
  const t = now()
  const bus = A.ui
  burst({ t, f: vary(4200, 0.1), q: 1.2, d: 0.006, gain: 0.2, bus, pan })
  modal({ t, f: vary(1250, 0.06), modes: PLASTIC, gain: 0.16, bus, pan })
  tone({ t, f: vary(170, 0.05), f2: 85, d: 0.04, gain: 0.22, bus, pan })
}
export function press(pan = 0) {
  if (!limit('click', 30) || !voice(0.12, 2)) return
  const t = now()
  const bus = A.ui
  burst({ t, f: vary(3000, 0.1), q: 1, d: 0.008, gain: 0.2, bus, pan })
  modal({ t, f: vary(820, 0.05), modes: PLASTIC, gain: 0.18, bus, pan })
  tone({ t, f: vary(140, 0.05), f2: 68, d: 0.06, gain: 0.3, bus, pan })
}
export function tick(pan = 0) {
  if (!limit('click', 30) || !voice(0.06, 2)) return
  const t = now()
  burst({ t, f: vary(6000, 0.1), q: 1.4, d: 0.004, gain: 0.12, bus: A.ui, pan })
  modal({ t, f: vary(2300, 0.06), modes: PLASTIC, gain: 0.1, bus: A.ui, pan })
}
export function windowOpen() {
  if (!limit('win', 90) || !voice(0.35, 2)) return
  const t = now()
  burst({ t, noise: 'pink', f: 320, f2: 2400, q: 0.9, a: 0.09, d: 0.17, gain: 0.3, bus: A.ui })
  tone({ t: t + 0.11, f: 125, f2: 70, d: 0.09, gain: 0.2, bus: A.ui })
}
export function windowClose() {
  if (!limit('win', 90) || !voice(0.2, 2)) return
  burst({ t: now(), noise: 'pink', f: 2100, f2: 300, q: 0.9, a: 0.02, d: 0.14, gain: 0.34, bus: A.ui })
}
export function deny() {
  if (!limit('deny', 140) || !voice(0.2, 2)) return
  const t = now()
  modal({ t, f: vary(215, 0.03), modes: WOOD, gain: 0.42, strike: 0.15, bus: A.ui })
  modal({ t: t + 0.09, f: vary(168, 0.03), modes: WOOD, gain: 0.36, strike: 0.12, bus: A.ui })
  buzz(30)
}
function coins(t, n, spread, gain, pan = 0) {
  for (let i = 0; i < n; i++) {
    const at2 = t + Math.pow(i / n, 1.3) * spread + rnd(0, 0.02)
    modal({ t: at2, f: rnd(2500, 4400), modes: COIN, gain: gain * (1 - (i / n) * 0.7), beat: 7, strike: 0.25, decay: rnd(0.5, 1), pan: pan + rnd(-0.3, 0.3), verb: 0.08 })
  }
  crinkle({ t: t + spread * 0.4, n: COARSE_POINTER ? 5 : 10, dur: spread, gain: 0.025, f0: 4000, f1: 9000 })
}
export function purchase() {
  if (!limit('buy', 200) || !voice(1.4, 3)) return
  claim()
  const t = now()
  burst({ t, type: 'lowpass', f: 700, q: 0.7, d: 0.1, gain: 0.3 })
  tone({ t, f: 95, f2: 52, d: 0.1, gain: 0.3 })
  modal({ t: t + 0.04, f: 1046, modes: BELL, gain: 0.2, beat: 4, strike: 0.2, verb: 0.15 })
  coins(t + 0.06, COARSE_POINTER ? 6 : 10, 0.45, 0.09)
  buzz([20, 40, 30])
}
export function equip() {
  if (!limit('equip', 120) || !voice(0.4, 2)) return
  claim()
  const t = now()
  modal({ t, f: vary(1800, 0.04), modes: PLASTIC, gain: 0.16, strike: 0.15, bus: A.ui })
  modal({ t: t + 0.045, f: vary(2400, 0.04), modes: COIN, gain: 0.07, decay: 0.45, strike: 0.3, bus: A.ui })
  burst({ t, noise: 'pink', f: 600, f2: 1900, q: 0.8, a: 0.03, d: 0.1, gain: 0.08, bus: A.ui })
}
function glock(t, notes, gap, gain = 0.14, verb = 0.25, bus = A.sfx) {
  notes.forEach((n, i) => modal({ t: t + i * gap, f: C6 * semi(n), modes: GLOCK, gain: gain * rnd(0.85, 1), strike: 0.12, pan: (i / Math.max(1, notes.length - 1) - 0.5) * 0.5, verb, bus }))
}

// --- Weapons ------------------------------------------------------------------------------------
// The shot: each weapon is its own little physical event.
export function fire(weapon = 'blowpipe') {
  if (!voice(0.4, 1)) return
  const t = now()
  if (weapon === 'blowpipe') {
    // A sharp breath through a bamboo tube: noise burst with the tube's resonance, then the pop.
    burst({ t, noise: 'pink', f: 1400, f2: 500, q: 2.5, a: 0.004, d: 0.12, gain: 0.5 })
    tone({ t, f: vary(330, 0.04), f2: 260, d: 0.08, gain: 0.18, type: 'triangle' })
    burst({ t: t + 0.012, type: 'highpass', f: 3200, q: 0.6, a: 0.001, d: 0.02, gain: 0.25 })
    bubble({ t: t + 0.01, f: 900, d: 0.04, gain: 0.12, rise: 0.8 })
  } else if (weapon === 'pistol') {
    // Spring-loaded toy: latch click, spring boing, air puff.
    modal({ t, f: vary(2200, 0.04), modes: PLASTIC, gain: 0.3, strike: 0.3 })
    tone({ t: t + 0.005, f: 520, f2: 180, d: 0.09, gain: 0.2, type: 'square', lp: 1800 })
    burst({ t: t + 0.005, noise: 'pink', f: 2000, f2: 700, q: 1.2, a: 0.002, d: 0.09, gain: 0.4 })
  } else if (weapon === 'crossbow') {
    // String twang: plucked tone with fast pitch drop + limb thump.
    tone({ t, f: 210, f2: 120, glide: 0.25, d: 0.32, gain: 0.32, type: 'sawtooth', lp: 1400 })
    tone({ t, f: 420, f2: 240, d: 0.2, gain: 0.08, type: 'triangle' })
    modal({ t, f: 300, modes: WOOD, gain: 0.35, strike: 0.2 })
    burst({ t: t + 0.01, noise: 'pink', f: 2500, f2: 900, q: 1, d: 0.1, gain: 0.25 })
  } else {
    // Air rifle: compressed-gas crack + chamber thoomp + tail.
    burst({ t, type: 'highpass', f: 1800, q: 0.6, a: 0.0006, d: 0.035, gain: 0.55, verb: 0.3 })
    tone({ t, f: 140, f2: 55, d: 0.16, gain: 0.45 })
    burst({ t: t + 0.01, noise: 'pink', f: 900, f2: 300, q: 0.8, d: 0.35, gain: 0.25, verb: 0.4 })
    modal({ t: t + 0.08, f: 1900, modes: COIN, gain: 0.05, decay: 0.3 })
  }
  // Dart whistle leaving.
  burst({ t: t + 0.03, f: 5200, f2: 2600, q: 6, a: 0.02, d: 0.18, gain: 0.05 })
}
export function empty() {
  if (!limit('empty', 150) || !voice(0.1, 2)) return
  const t = now()
  modal({ t, f: 1600, modes: PLASTIC, gain: 0.25, strike: 0.2 })
  modal({ t: t + 0.06, f: 1300, modes: PLASTIC, gain: 0.18 })
}
export function switchWeapon() {
  if (!voice(0.25, 2)) return
  const t = now()
  burst({ t, noise: 'pink', f: 1500, q: 1.2, a: 0.02, d: 0.08, gain: 0.12, bus: A.ui })
  modal({ t: t + 0.05, f: 1600, modes: PLASTIC, gain: 0.12, bus: A.ui })
  modal({ t: t + 0.12, f: 2400, modes: COIN, gain: 0.05, decay: 0.3, bus: A.ui })
}
export function scope(on) {
  if (!voice(0.3, 2)) return
  const t = now()
  modal({ t, f: on ? 2600 : 2100, modes: PLASTIC, gain: 0.2, strike: 0.2, bus: A.ui })
  burst({ t, noise: 'pink', f: on ? 400 : 1800, f2: on ? 1800 : 400, q: 1, a: 0.05, d: 0.15, gain: 0.12, bus: A.ui })
}
export function zoomStep(up) {
  if (!limit('zoom', 60) || !voice(0.1, 2)) return
  const t = now()
  modal({ t, f: up ? 3000 : 2400, modes: PLASTIC, gain: 0.12, bus: A.ui })
  tone({ t, f: up ? 900 : 1200, f2: up ? 1300 : 800, d: 0.06, gain: 0.03, bus: A.ui })
}

// The dart lands in an animal: a felt-y thwack, a rubbery boing; asleep = a slide whistle down.
export function dartHit(slept) {
  if (!voice(1, 3)) return
  const t = now()
  burst({ t, type: 'lowpass', f: 1200, q: 0.8, a: 0.001, d: 0.05, gain: 0.45 })
  tone({ t, f: 180, f2: 90, d: 0.07, gain: 0.35 })
  tone({ t: t + 0.02, f: 420, f2: 680, d: 0.12, gain: 0.08, type: 'triangle' })
  modal({ t: t + 0.01, f: vary(2600, 0.05), modes: COIN, gain: 0.06, decay: 0.4 })
  if (slept) {
    tone({ t: t + 0.08, f: 1300, f2: 320, glide: 0.55, d: 0.6, gain: 0.13, type: 'sine' })
    glock(t + 0.15, [7, 4, 0], 0.09, 0.1)
    buzz(40)
  }
}
export function dartHitFar(p) {
  const s = at(p, 10)
  if (s.gain < 0.05 || !voice(0.2, 1)) return
  const t = now()
  burst({ t, type: 'lowpass', f: 1000, q: 0.8, d: 0.05, gain: 0.3 * s.gain, pan: s.pan })
}
export function dartThunk(p) {
  const s = at(p, 18)
  if (!voice(0.2, 1)) return
  const t = now()
  modal({ t, f: vary(380, 0.08), modes: WOOD, gain: 0.3 * s.gain, strike: 0.2, pan: s.pan })
  burst({ t, noise: 'brown', type: 'lowpass', f: 500, q: 0.6, d: 0.08, gain: 0.25 * s.gain, pan: s.pan })
}

// --- Animals ---------------------------------------------------------------------------------------
// A voiced call: an oscillator through vocal formants with vibrato and a pitch contour.
function call(t, { f0, f1, dur, type = 'sawtooth', formants, vib = 0, vibRate = 6, gain = 0.2, pan = 0, steps = null, noise = 0 }) {
  const ctx = A.ctx
  const out = ctx.createGain()
  out.gain.setValueAtTime(0.0001, t)
  out.gain.linearRampToValueAtTime(gain, t + Math.min(0.03, dur * 0.2))
  out.gain.setValueAtTime(gain, t + dur * 0.7)
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  const p = ctx.createStereoPanner()
  p.pan.value = pan
  out.connect(p).connect(A.sfx)
  const sendG = ctx.createGain()
  sendG.gain.value = 0.15
  p.connect(sendG).connect(A.verb)
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(f0, t)
  if (steps) steps.forEach(([dt, f]) => osc.frequency.exponentialRampToValueAtTime(f, t + dt))
  else osc.frequency.exponentialRampToValueAtTime(f1, t + dur)
  if (vib) {
    const lfo = ctx.createOscillator()
    lfo.frequency.value = vibRate
    const lg = ctx.createGain()
    lg.gain.value = f0 * vib
    lfo.connect(lg).connect(osc.frequency)
    lfo.start(t)
    lfo.stop(t + dur + 0.05)
  }
  for (const [f, q, g] of formants) {
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = f
    bp.Q.value = q
    const fg = ctx.createGain()
    fg.gain.value = g
    osc.connect(bp).connect(fg).connect(out)
  }
  osc.start(t)
  osc.stop(t + dur + 0.05)
  if (noise) burst({ t, f: 2500, q: 0.7, a: 0.01, d: dur * 0.8, gain: noise * gain, pan })
}

export function animalCall(species, p) {
  const s = at(p, 9)
  if (s.gain < 0.08 || !limit('call', 350) || !voice(1, 1)) return
  const t = now()
  const g = 0.9 * s.gain
  const pan = s.pan
  switch (species) {
    case 'chicken':
      for (let i = 0; i < 3; i++) call(t + i * 0.13, { f0: vary(620, 0.05), f1: 480, dur: 0.09, type: 'square', formants: [[900, 4, 1], [2100, 5, 0.4]], gain: 0.07 * g, pan })
      call(t + 0.42, { f0: 700, f1: 520, dur: 0.22, type: 'square', formants: [[1000, 4, 1], [2300, 5, 0.4]], gain: 0.08 * g, pan })
      break
    case 'turkey':
      call(t, { f0: 520, f1: 380, dur: 0.6, type: 'square', formants: [[800, 3, 1], [1900, 4, 0.5]], vib: 0.25, vibRate: 22, gain: 0.07 * g, pan })
      break
    case 'rabbit':
      call(t, { f0: 1800, f1: 2400, dur: 0.08, type: 'sine', formants: [[2000, 2, 1]], gain: 0.06 * g, pan })
      break
    case 'goat':
    case 'sheep':
      call(t, { f0: species === 'goat' ? 330 : 260, f1: species === 'goat' ? 300 : 230, dur: 0.75, formants: [[700, 5, 1], [1150, 6, 0.6], [2500, 8, 0.25]], vib: 0.06, vibRate: species === 'goat' ? 9 : 6.5, gain: 0.12 * g, pan })
      break
    case 'pig':
      call(t, { f0: 180, f1: 140, dur: 0.18, formants: [[500, 4, 1], [1200, 6, 0.5]], vib: 0.15, vibRate: 30, gain: 0.16 * g, pan, noise: 0.3 })
      call(t + 0.24, { f0: 200, f1: 150, dur: 0.16, formants: [[520, 4, 1], [1250, 6, 0.5]], vib: 0.15, vibRate: 30, gain: 0.14 * g, pan, noise: 0.3 })
      break
    case 'cow':
      call(t, { f0: 105, f1: 95, dur: 1.2, steps: [[0.35, 140], [1.1, 92]], formants: [[300, 3, 1], [700, 5, 0.6], [1400, 6, 0.2]], vib: 0.02, gain: 0.25 * g, pan })
      break
    case 'deer':
      call(t, { f0: 700, f1: 500, dur: 0.3, formants: [[900, 5, 1], [1800, 6, 0.4]], gain: 0.1 * g, pan })
      break
    case 'fox':
      call(t, { f0: 900, f1: 1500, dur: 0.12, formants: [[1200, 4, 1], [2600, 5, 0.4]], gain: 0.1 * g, pan })
      call(t + 0.18, { f0: 1000, f1: 1600, dur: 0.12, formants: [[1200, 4, 1], [2600, 5, 0.4]], gain: 0.09 * g, pan })
      break
    case 'heron':
      call(t, { f0: 160, f1: 120, dur: 0.35, type: 'square', formants: [[600, 3, 1], [1500, 4, 0.5]], gain: 0.12 * g, pan, noise: 0.4 })
      break
    case 'boar':
      call(t, { f0: 110, f1: 80, dur: 0.4, formants: [[400, 3, 1], [900, 5, 0.6]], vib: 0.2, vibRate: 35, gain: 0.25 * g, pan, noise: 0.4 })
      break
  }
}
// Drowsy yawn: a sighing slide down with a soft breathy noise.
export function sleepy(p) {
  const s = at(p, 20)
  if (!voice(1, 2)) return
  const t = now()
  tone({ t, f: 520, f2: 180, glide: 0.8, d: 0.9, a: 0.06, gain: 0.07 * s.gain, type: 'triangle', pan: s.pan })
  burst({ t, noise: 'pink', f: 900, f2: 400, q: 1.2, a: 0.1, d: 0.8, gain: 0.05 * s.gain, pan: s.pan })
}
// Wake up: a cartoon "boing!" and a startled squeak.
export function wake(p) {
  const s = at(p, 22)
  if (s.gain < 0.05 || !voice(0.6, 2)) return
  const t = now()
  tone({ t, f: 180, f2: 700, glide: 0.18, d: 0.3, gain: 0.18 * s.gain, type: 'triangle', pan: s.pan })
  tone({ t: t + 0.05, f: 1400, f2: 2200, d: 0.08, gain: 0.06 * s.gain, pan: s.pan })
}

// --- Capture loop ------------------------------------------------------------------------------------
export function pickup() {
  if (!voice(0.6, 3)) return
  claim()
  const t = now()
  burst({ t, noise: 'pink', f: 300, f2: 1600, q: 0.9, a: 0.05, d: 0.18, gain: 0.25 })
  bubble({ t: t + 0.05, f: 380, d: 0.12, gain: 0.3, rise: 1.6 })
  glock(t + 0.08, [0, 4, 7], 0.05, 0.08)
}
export function drop() {
  if (!voice(0.4, 2)) return
  const t = now()
  burst({ t, type: 'lowpass', f: 500, q: 0.7, d: 0.12, gain: 0.3 })
  tone({ t, f: 120, f2: 60, d: 0.12, gain: 0.25 })
}
// Animal placed in the pen: chime fanfare + ka-ching.
export function place(tier = 0) {
  if (!voice(2, 3)) return
  claim()
  const t = now()
  glock(t, [0, 4, 7, 12, 16].slice(0, 3 + Math.min(2, tier)), 0.07, 0.12)
  modal({ t: t + 0.25, f: 1046 * semi(tier), modes: BELL, gain: 0.18, beat: 4, strike: 0.2, verb: 0.2 })
  coins(t + 0.3, COARSE_POINTER ? 6 : 12, 0.5, 0.08)
  buzz([30, 50, 40])
}
// Income tick: one tiny coin, kept quiet and sparse.
export function coinTick(p) {
  const s = at(p, 10)
  if (s.gain < 0.12 || !limit('coin', 160) || !voice(0.4, 1)) return
  modal({ t: now(), f: rnd(3000, 4200), modes: COIN, gain: 0.035 * s.gain, beat: 6, decay: 0.6, pan: s.pan })
}
export function warnTick(urgent) {
  if (!voice(0.1, 2)) return
  const t = now()
  modal({ t, f: urgent ? 1900 : 1500, modes: WOOD, gain: 0.25, strike: 0.2, bus: A.ui })
}
export function escaped() {
  if (!voice(0.8, 3)) return
  const t = now()
  tone({ t, f: 520, f2: 260, d: 0.35, gain: 0.12, type: 'square', lp: 1500 })
  tone({ t: t + 0.2, f: 390, f2: 180, d: 0.4, gain: 0.12, type: 'square', lp: 1500 })
}
export function goal() {
  if (!voice(1.5, 3)) return
  claim()
  const t = now()
  glock(t, [0, 4, 7, 12], 0.08, 0.13)
  modal({ t: t + 0.35, f: 2093, modes: BELL, gain: 0.12, verb: 0.3 })
}
export function levelUp() {
  if (!voice(1.5, 3)) return
  const t = now()
  glock(t, [0, 7, 12, 16, 19], 0.06, 0.12)
}
export function fanfare() {
  if (!voice(2, 3)) return
  const t = now()
  for (const [i, n] of [[0, 0], [1, 4], [2, 7], [3, 12]]) tone({ t: t + i * 0.12, f: 392 * semi(n), d: 0.25, gain: 0.07, type: 'sawtooth', lp: 2200, verb: 0.3 })
  tone({ t: t + 0.48, f: 392 * semi(12), d: 0.7, gain: 0.08, type: 'sawtooth', lp: 2600, verb: 0.4 })
  glock(t + 0.48, [12, 16, 19, 24], 0.05, 0.08)
}
export function gift() {
  if (!voice(1.5, 3)) return
  claim()
  const t = now()
  crinkle({ t, n: COARSE_POINTER ? 10 : 22, dur: 0.4, gain: 0.08 })
  glock(t + 0.3, [0, 4, 7, 12, 16], 0.05, 0.12)
  coins(t + 0.5, 8, 0.4, 0.08)
}

// --- Player --------------------------------------------------------------------------------------------
export function step(kind = 'grass', k = 1) {
  if (!voice(0.12, 0.5)) return
  const t = now()
  if (kind === 'wood') {
    modal({ t, f: vary(260, 0.1), modes: WOOD, gain: 0.12 * k })
    return
  }
  burst({ t, noise: 'pink', type: 'bandpass', f: vary(kind === 'yellow' ? 1500 : 1100, 0.15), q: 0.9, a: 0.004, d: 0.07, gain: 0.08 * k })
  burst({ t: t + 0.01, type: 'highpass', f: 4500, q: 0.5, a: 0.002, d: 0.03, gain: 0.025 * k })
}
export function jump() {
  if (!voice(0.2, 1)) return
  burst({ t: now(), noise: 'pink', f: 500, f2: 1400, q: 1, a: 0.02, d: 0.12, gain: 0.1 })
}
export function land(k = 0.5) {
  if (!voice(0.2, 1)) return
  const t = now()
  burst({ t, noise: 'brown', type: 'lowpass', f: 400, q: 0.6, d: 0.1, gain: 0.3 * k })
  tone({ t, f: 90, f2: 50, d: 0.08, gain: 0.2 * k })
}
export function portal() {
  if (!limit('portal', 1500) || !voice(1.2, 2)) return
  const t = now()
  burst({ t, noise: 'pink', f: 300, f2: 3000, q: 1.5, a: 0.4, d: 0.6, gain: 0.15, verb: 0.4 })
  tone({ t, f: 220, f2: 880, glide: 0.9, d: 1, gain: 0.06, type: 'triangle', verb: 0.4 })
}
export function treadStep() {
  if (!voice(0.1, 0.5)) return
  const t = now()
  modal({ t, f: vary(200, 0.1), modes: WOOD, gain: 0.1 })
  burst({ t, type: 'lowpass', f: 300, d: 0.05, gain: 0.1 })
}
export { MARIMBA }
