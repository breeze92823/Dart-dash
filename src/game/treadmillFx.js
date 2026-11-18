// The treadmill machine's animation, shared by the local player's base and the remote ones: belt
// scroll, rollers, fan, motor rumble, LED strips, the console screen and the runner's sweat / wind /
// grit particles. One `b` = hub.live.bases[i]; it owns its own animation state in b.fx.
import { Color, Vector3 } from 'three'
import { TREADMILL } from '../config.js'
import { BELT_TILE } from '../world/hub.js'
import { CELL, confetti, emit as fx, ringPulse, sparkle } from '../fx/particles.js'

const tmp = new Vector3()
const ledIdle = new Color('#3fe0ff')
const ledLocked = new Color('#ff3b3b')
const ledFlash = new Color('#ffffff')
const rnd = (a, b) => a + Math.random() * (b - a)

// The speed-up burst (belt flash, ring, sparkles around the runner at `at` {x,y,z}).
export function millSpeedUp(b, at) {
  const fxs = b.fx
  const TM = b.base.treadmill
  fxs.flash = 1
  fxs.banner = 1.8
  fxs.screenTimer = 0
  ringPulse(tmp.set(TM.x, 0.5, TM.z), '#5dffc0', 7)
  if (at) {
    sparkle(tmp.set(at.x, at.y + 1.4, at.z), '#5dffc0', 18, 5)
    confetti(tmp.set(at.x, at.y + 2.2, at.z), 24)
  }
}

// info: { unlocked, steps, perStep, bonus } for the console; run: the runner (or null) as
// { x, y, z, facing, speed }; training: someone is running on it; near(): camera distance test.
export function animateMill(b, dt, { training, runner, unlocked, view, near }) {
  const mill = b.mill
  const fxs = b.fx
  const TM = b.base.treadmill
  fxs.t += dt
  fxs.run += ((training ? 1 : 0) - fxs.run) * Math.min(1, dt * (training ? 5 : 1.6))
  if (fxs.run < 0.002) fxs.run = 0
  const speed = runner ? runner.speed : 0
  const v = fxs.run * Math.min(7, 2.5 + speed * 0.4) // belt surface m/s (capped so the slats don't strobe)
  if (v > 0) {
    b.belt.offset.y = (b.belt.offset.y - (dt * v) / BELT_TILE) % 1
    for (const r of mill.rollers) r.rotation.x = (r.rotation.x + (dt * v) / mill.rollerR) % (Math.PI * 2)
  }
  mill.fan.rotation.z = (mill.fan.rotation.z - dt * fxs.run * 24) % (Math.PI * 2)
  mill.group.position.y = mill.baseY + Math.abs(Math.sin(fxs.t * 13)) * 0.014 * fxs.run // motor rumble

  // LED strips: dim red while locked, a slow cyan breath when ready, a fast pulse while running.
  fxs.flash = Math.max(0, fxs.flash - dt * 1.2)
  const led = mill.led
  if (!unlocked) {
    led.emissive.copy(ledLocked)
    led.emissiveIntensity = 0.3 + 0.15 * Math.sin(fxs.t * 3)
  } else {
    led.emissive.copy(ledIdle).lerp(ledFlash, fxs.flash)
    led.emissiveIntensity = 0.5 + 0.2 * Math.sin(fxs.t * 2) + fxs.run * (1.1 + 0.7 * Math.sin(fxs.t * 14)) + fxs.flash * 3
  }

  // Console screen, refreshed a few times a second while the camera is near.
  fxs.banner = Math.max(0, fxs.banner - dt)
  fxs.screenTimer -= dt
  if (fxs.screenTimer <= 0 && near(tmp.set(TM.x, 2, TM.z), 40)) {
    fxs.screenTimer = 0.25
    const s = fxs.screen
    s.locked = !unlocked
    s.steps = view.steps
    s.perStep = view.perStep
    s.bonus = view.bonus
    s.next = view.next
    s.run = fxs.run
    s.bpm = Math.round(72 + fxs.run * 78 + (fxs.run > 0.5 ? rnd(-3, 3) : 0))
    s.blink = !s.blink
    s.banner = fxs.banner > 0 ? 'SPEED UP!' : ''
    mill.screen.redraw(s)
  }

  if (!training || !runner || !near(tmp.set(TM.x, 1, TM.z), 60)) return
  const p = runner
  fxs.sweat = (fxs.sweat ?? 0) - dt
  if (fxs.sweat <= 0) {
    fxs.sweat = rnd(0.3, 0.6)
    const a = p.facing + (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 2 + rnd(-0.4, 0.4))
    const s = rnd(1, 2)
    fx({ x: p.x, y: p.y + 1.9, z: p.z, vx: Math.sin(a) * s, vy: rnd(1.6, 2.8), vz: Math.cos(a) * s, life: 0.75, size: 0.17, size2: 0.1, gravity: 12, alpha: 0.95 }, '#8fe3ff')
  }
  fxs.wind = (fxs.wind ?? 0) - dt
  if (fxs.wind <= 0) {
    fxs.wind = 0.07
    const w = 6 + v
    fx({ x: p.x + rnd(-0.8, 0.8), y: p.y + rnd(0.3, 2), z: p.z + rnd(-0.6, 0.2), vx: 0, vz: w, life: 0.3, size: 0.11, size2: 0.02, alpha: 0.6 }, '#ffffff', true)
  }
  fxs.grit = (fxs.grit ?? 0) - dt
  if (fxs.grit <= 0) {
    fxs.grit = rnd(0.15, 0.35)
    fx({ x: TM.x + rnd(-0.8, 0.8), y: 0.4, z: TM.z + 2.35, vx: rnd(-0.4, 0.4), vy: rnd(0.6, 1.6), vz: v * 0.5 + rnd(0, 1), life: 0.5, size: 0.08, gravity: 9, cell: CELL.square, rot: rnd(0, 6) }, '#5a5e68')
  }
}

// What the console shows for a player's treadmill stats.
export function consoleView(stats) {
  const bonus = Math.min(TREADMILL.maxBonus, Math.floor(stats.steps / TREADMILL.stepsPer) * TREADMILL.speedPer)
  return {
    steps: stats.stepsText,
    perStep: stats.perStepText,
    bonus: bonus.toFixed(1),
    next: bonus >= TREADMILL.maxBonus ? 1 : (stats.steps % TREADMILL.stepsPer) / TREADMILL.stepsPer,
  }
}
