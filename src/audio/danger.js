// Sounds for angry animals and the player getting hurt (game/danger.js), synthesised like sfx.js:
// growl, snort, charging stomps, the lunge impact, the player's "oof", knockout and a heartbeat.
// `g` is a 0..1 distance gain. Everything returns quietly when audio isn't running.
import { now, voice } from './core.js'
import { burst, rnd, tone, vary } from './synth.js'

// Low rumbling growl, a bit different every time; bigger animals (k > 1) growl lower.
export function growl(g = 1, k = 1) {
  if (g < 0.06 || !voice(0.9, 2)) return
  const t = now()
  const f = vary(95, 0.12) / k
  tone({ t, type: 'sawtooth', f, f2: f * 0.7, a: 0.08, d: 0.75, gain: 0.16 * g, lp: 520, lpq: 4 })
  tone({ t, type: 'sawtooth', f: f * 1.02, f2: f * 0.72, a: 0.08, d: 0.75, gain: 0.12 * g, lp: 700, detune: 18 })
  burst({ t, noise: 'brown', type: 'lowpass', f: 600, a: 0.05, d: 0.7, gain: 0.28 * g })
}
export function snort(g = 1) {
  if (g < 0.06 || !voice(0.3, 1)) return
  const t = now()
  burst({ t, noise: 'pink', f: 900, f2: 500, q: 1.4, a: 0.01, d: 0.18, gain: 0.3 * g })
  burst({ t: t + 0.2, noise: 'pink', f: 1000, f2: 520, q: 1.4, a: 0.01, d: 0.16, gain: 0.25 * g })
}
// One heavy hoof-fall of a charge.
export function stomp(g = 1) {
  if (g < 0.08 || !voice(0.15, 1)) return
  const t = now()
  tone({ t, f: vary(75, 0.1), f2: 38, d: 0.12, gain: 0.22 * g })
  burst({ t, noise: 'brown', type: 'lowpass', f: 380, d: 0.1, gain: 0.25 * g })
}
// The lunge connects: a meaty thump with a crack on top.
export function impact() {
  if (!voice(0.5, 3)) return
  const t = now()
  tone({ t, f: 150, f2: 45, glide: 0.18, d: 0.25, gain: 0.45 })
  burst({ t, noise: 'white', type: 'highpass', f: 1800, d: 0.06, gain: 0.35 })
  burst({ t, noise: 'brown', type: 'lowpass', f: 700, d: 0.22, gain: 0.5 })
}
// Player "oof".
export function hurt() {
  if (!voice(0.4, 3)) return
  const t = now() + 0.03
  const f = rnd(260, 320)
  tone({ t, type: 'triangle', f, f2: f * 0.62, glide: 0.22, d: 0.26, gain: 0.22, lp: 1400 })
  tone({ t, type: 'sawtooth', f: f * 2, f2: f * 1.2, glide: 0.2, d: 0.2, gain: 0.05, lp: 1800 })
}
// Knocked out: a cartoon bonk, a falling whistle and birdie tweets.
export function knockout() {
  if (!voice(2, 3)) return
  const t = now()
  tone({ t, f: 900, f2: 300, glide: 0.08, d: 0.3, gain: 0.25, type: 'square', lp: 2200 })
  tone({ t: t + 0.12, f: 1400, f2: 180, glide: 1, d: 1.1, gain: 0.12, type: 'triangle' })
  for (let i = 0; i < 4; i++) tone({ t: t + 1 + i * 0.22, f: 2400 + (i % 2) * 500, f2: 3200, glide: 0.06, d: 0.1, gain: 0.06 })
}
// Low HP: lub-dub.
export function heartbeat() {
  if (!voice(0.4, 1)) return
  const t = now()
  tone({ t, f: 62, f2: 40, d: 0.14, gain: 0.35 })
  tone({ t: t + 0.18, f: 55, f2: 36, d: 0.16, gain: 0.28 })
}
// Back on your feet at the hub.
export function revive() {
  if (!voice(0.6, 2)) return
  const t = now()
  for (const [i, f] of [523, 659, 784].entries()) tone({ t: t + i * 0.08, f, d: 0.25, gain: 0.1, type: 'triangle' })
}
