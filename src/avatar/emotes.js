// Bloxity emotes: plays a portal emote clip on a character. A clip is { len, loop, tracks } where
// tracks maps a bone name to [[time, x, y, z], ...] keyframes in DEGREES. They are applied as
// bind-pose deltas (XYZ Euler, right-multiplied onto the rest rotation), smoothstep between keys and
// looped on `time % len`, blended in over ~0.1 s. Call update() AFTER the animator each frame; the
// emote overrides the bones it names. An unknown clip / bone never throws.
import { Euler, Quaternion } from 'three'

const BLEND_IN = 0.1
const BLEND_OUT = 0.15
const DEG = Math.PI / 180
const smooth = (t) => t * t * (3 - 2 * t)

export class EmotePlayer {
  // getBindings(): the animator's rig bindings [{ bone, rest }] (rebuilt when the avatar swaps).
  constructor(getBindings) {
    this.getBindings = getBindings
    this.clip = null
    this.id = ''
    this.time = 0
    this.weight = 0
    this.playing = false
    this.euler = new Euler(0, 0, 0, 'XYZ')
    this.delta = new Quaternion()
    this.target = new Quaternion()
  }

  get active() {
    return this.weight > 0.001
  }

  play(id, clip) {
    if (!clip || !clip.tracks || !(clip.len > 0)) return false
    this.id = id
    this.clip = clip
    this.time = 0
    this.playing = true
    return true
  }

  stop() {
    this.playing = false
  }

  update(dt) {
    const clip = this.clip
    if (!clip) return
    this.weight += ((this.playing ? 1 : 0) - this.weight) * Math.min(1, dt / (this.playing ? BLEND_IN : BLEND_OUT))
    if (!this.playing && this.weight < 0.001) {
      this.weight = 0
      this.clip = null
      return
    }
    this.time += dt
    if (this.time >= clip.len) {
      if (clip.loop) this.time %= clip.len
      else {
        this.time = clip.len
        this.playing = false
      }
    }
    const w = Math.min(1, this.weight)
    for (const b of this.getBindings()) {
      const keys = clip.tracks[b.bone.name]
      if (!Array.isArray(keys) || !keys.length) continue
      const v = sample(keys, this.time)
      this.euler.set(v[0] * DEG, v[1] * DEG, v[2] * DEG, 'XYZ')
      this.delta.setFromEuler(this.euler)
      this.target.copy(b.rest).multiply(this.delta)
      b.bone.quaternion.slerp(this.target, w)
    }
  }
}

// [x, y, z] at time t between keyframes [t, x, y, z] (smoothstep).
function sample(keys, t) {
  if (t <= keys[0][0] || keys.length === 1) return [keys[0][1], keys[0][2], keys[0][3]]
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1]
    const b = keys[i]
    if (t <= b[0]) {
      const k = smooth((t - a[0]) / Math.max(1e-6, b[0] - a[0]))
      return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k]
    }
  }
  const last = keys[keys.length - 1]
  return [last[1], last[2], last[3]]
}
