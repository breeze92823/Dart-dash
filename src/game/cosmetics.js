// The player's look in the world: the equipped weapon slung on their back
// (with its skin), a particle trail while moving and an aura (flames, storm =
// flames + lightning, sparkles or orbit; COSMETICS.auras[id].style).
import { COSMETICS } from '../config.js'
import { emit as emitParticle, CELL } from '../fx/particles.js'
import { buildWeapon } from './weapons.js'
import { on, state } from './state.js'

const rnd = (a, b) => a + Math.random() * (b - a)

// Trail + aura particles for ONE wearer (the local player, or each remote player from the roster's
// `trail` / `aura` ids). Keeps its own timers so several wearers don't share a cadence.
// update(dt, p (feet position), { trail, aura (ids), moving, visible })
export function createAuraFx() {
  let trailT = 0
  let auraT = 0
  let auraA = 0
  return {
    update(dt, p, { trail: trailId, aura: id, moving, visible }) {
      const t = performance.now() / 1000
      // Trail: rainbow cycles its hue, cosmic leaves stars.
      const trail = COSMETICS.trails[trailId]
      if (visible && trail?.colors?.length && moving) {
        trailT -= dt
        if (trailT <= 0) {
          trailT = 0.025
          const c = trail.rainbow ? `hsl(${Math.floor(t * 160) % 360},100%,62%)` : trail.colors[Math.floor(Math.random() * trail.colors.length)]
          emitParticle({ x: p.x + rnd(-0.15, 0.15), y: p.y + rnd(0.3, 1.1), z: p.z + rnd(-0.15, 0.15), vy: rnd(0.1, 0.5), life: 0.7, size: trail.stars ? 0.36 : 0.3, size2: 0.05, cell: trail.stars || Math.random() < 0.3 ? CELL.star : CELL.dot, rot: rnd(0, 6), spin: 3, hdr: 1.8 }, c, true)
        }
      }
      const aura = COSMETICS.auras[id]
      if (!visible || !aura || id === 'none') return
      auraT -= dt
      auraA += dt * 3
      if (auraT > 0) return
      auraT = aura.style === 'flames' || aura.style === 'storm' ? 0.03 : 0.04
      const [c1, c2] = aura.colors
      const main = aura.rainbow ? `hsl(${Math.floor(t * 120) % 360},100%,62%)` : c1
      if (aura.style === 'flames' || aura.style === 'storm') {
        // Flames lick up around the feet, hotter (c2) at the core.
        for (let i = 0; i < 2; i++) {
          const a = rnd(0, Math.PI * 2)
          const r = rnd(0.35, 0.85)
          emitParticle({ x: p.x + Math.cos(a) * r, y: p.y + rnd(0, 0.3), z: p.z + Math.sin(a) * r, vx: -Math.cos(a) * 0.3, vz: -Math.sin(a) * 0.3, vy: rnd(1.6, 2.8), life: rnd(0.5, 0.85), size: rnd(0.3, 0.5), size2: 0.04, cell: CELL.dot, hdr: 2.2 }, i ? c2 : main, true)
        }
        // Storm: now and then a lightning bolt crackles up beside the player.
        if (aura.style === 'storm' && Math.random() < 0.05) {
          const a = rnd(0, Math.PI * 2)
          let x = p.x + Math.cos(a) * 0.8
          let z = p.z + Math.sin(a) * 0.8
          for (let k = 0; k < 7; k++) {
            x += rnd(-0.12, 0.12)
            z += rnd(-0.12, 0.12)
            emitParticle({ x, y: p.y + 0.15 + k * 0.3, z, life: 0.18, size: 0.26, size2: 0.12, cell: CELL.star, rot: rnd(0, 6), hdr: 3.2 }, k % 2 ? '#ffffff' : c2, true)
          }
        }
      } else {
        // Orbit / sparkles: two motes circling and rising.
        const starry = aura.style === 'sparkles'
        const a = auraA + rnd(0, 0.3)
        const r = 0.9
        emitParticle({ x: p.x + Math.cos(a) * r, y: p.y + rnd(0.1, 0.4), z: p.z + Math.sin(a) * r, vy: rnd(0.8, 1.6), life: rnd(0.8, 1.2), size: rnd(0.2, 0.35), size2: 0.02, cell: starry ? CELL.star : CELL.dot, rot: rnd(0, 6), spin: 2, hdr: 2 }, starry && Math.random() < 0.4 ? c2 : main, true)
        emitParticle({ x: p.x + Math.cos(a + Math.PI) * r, y: p.y + rnd(0.1, 0.4), z: p.z + Math.sin(a + Math.PI) * r, vy: rnd(0.8, 1.6), life: rnd(0.8, 1.2), size: rnd(0.2, 0.35), size2: 0.02, cell: CELL.dot, hdr: 2 }, main, true)
      }
    },
  }
}

export function createCosmetics({ playerGroup }) {
  let back = null
  let key = ''
  const fx = createAuraFx()

  function rebuild() {
    const k = `${state.weapon}|${state.cosmetics.skin}`
    if (k === key) return
    key = k
    back?.removeFromParent()
    back = buildWeapon(state.weapon, state.cosmetics.skin)
    // Slung diagonally across the back.
    back.position.set(0.05, 1.12, -0.36)
    back.rotation.set(0.15, Math.PI, 0.8)
    back.scale.setScalar(state.weapon === 'pistol' ? 0.9 : 0.75)
    playerGroup.add(back)
  }
  rebuild()
  on('weapon', rebuild)
  on('cosmetic', rebuild)

  return {
    setBackVisible(v) {
      if (back) back.visible = v
    },
    update(dt, { moving, visible }) {
      fx.update(dt, playerGroup.position, { trail: state.cosmetics.trail, aura: state.cosmetics.aura, moving, visible })
    },
  }
}
