// Game audio, the one import the rest of the game uses:
//   import { sfx, installAudio, updateAudio } from './audio/index.js'
// installAudio() once at boot (starts on the first gesture), updateAudio(dt, st)
// every frame (listener, footsteps, jump/land, ambience), sfx.<name>() for
// one-shots. Every button press anywhere gets its click here.
import { A, installAudio as installCore, onStart, setBusOn, setDucked, setMuted, setVolume, isMuted, toggleMuted } from './core.js'
import * as sfx from './sfx.js'
import * as ambience from './ambience.js'

export { sfx, setVolume, setMuted, isMuted, toggleMuted, setDucked, setBusOn }
export const setMusic = ambience.setMusic

function onPress(e) {
  if (e.button > 0) return
  const b = e.target.closest?.('button, [role="button"]')
  if (!b || b.disabled || b.dataset.silent != null) return
  const pan = Math.max(-0.6, Math.min(0.6, (e.clientX / window.innerWidth - 0.5) * 1.2))
  if (b.classList.contains('big')) sfx.press(pan)
  else if (b.closest('.pn-grid, .pn-tabs')) sfx.tick(pan)
  else sfx.click(pan)
}

export function installAudio() {
  installCore()
  window.addEventListener('pointerdown', onPress, { capture: true, passive: true })
}

const prev = { grounded: true, vy: 0, init: false }
let stepDist = 0
let started = false
onStart(() => (started = true))

// st: { camera, player: { x, y, z, vy, grounded }, speed, surface ('grass'|'yellow'|'wood'), inLane, menuOpen }
export function updateAudio(dt, st) {
  if (!started || !A.ctx || A.ctx.state !== 'running') return
  const e = st.camera.matrixWorld.elements
  const rl = Math.hypot(e[0], e[2]) || 1
  sfx.setListener(st.camera.position.x, st.camera.position.y, st.camera.position.z, e[0] / rl, e[2] / rl)
  const p = st.player
  if (prev.init) {
    if (prev.grounded && !p.grounded && p.vy > 2) sfx.jump()
    if (!prev.grounded && p.grounded && prev.vy < -4) sfx.land(Math.min(1, -prev.vy / 18))
  }
  if (p.grounded && st.speed > 1) {
    stepDist += st.speed * dt
    const stride = 1.15 + st.speed * 0.06
    if (stepDist > stride) {
      stepDist = 0
      sfx.step(st.surface, Math.min(1, 0.5 + st.speed / 16))
    }
  }
  prev.grounded = p.grounded
  prev.vy = p.vy
  prev.init = true
  setDucked(!!st.menuOpen)
  ambience.update(dt, st)
}
