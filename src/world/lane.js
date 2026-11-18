// The lane: the meadow below the aiming band where the animals roam. Trees,
// pines, hay bales, little white fences, flowers, grassy mounds and the marsh
// pond. Returns the obstacle circles animals steer around and the pond.
import { Group } from 'three'
import { LANE } from '../config.js'
import { RAPIER, addFixed } from '../physics.js'
import { solidBox } from '../propkit.js'
import { bake } from '../bake.js'
import { mulberry32 } from '../textures.js'
import { bush, cattails, flower, grassTuft, hayBale, mound, pine, pond, rock, tree, whiteFence } from './props.js'

export function buildLane(scene) {
  const root = new Group()
  scene.add(root)
  const statics = new Group()
  const obstacles = [] // { x, z, r } circles animals avoid
  const rand = mulberry32(4242)
  const Y = LANE.y
  const P = LANE.pond
  const S = LANE.spawn

  const free = (x, z, r) => {
    if (Math.hypot(x - P.x, z - P.z) < P.r + 3 + r) return false
    if (z > LANE.maxZ - 6) return false // keep the foot of the slope clear
    for (const o of obstacles) if (Math.hypot(x - o.x, z - o.z) < o.r + r + 1.5) return false
    return true
  }
  const spot = (r, tries = 40) => {
    for (let i = 0; i < tries; i++) {
      const x = S.minX + rand() * (S.maxX - S.minX)
      const z = S.minZ + rand() * (S.maxZ - S.minZ)
      if (free(x, z, r)) return [x, z]
    }
    return null
  }

  // Pond with reeds and bushes round it.
  const water = pond(root, P.x, Y, P.z, P.r)
  obstacles.push({ x: P.x, z: P.z, r: P.r + 0.8, pond: true })
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rand() * 0.3
    const r = P.r + 0.6 + rand() * 1.2
    cattails(statics, P.x + Math.cos(a) * r, Y, P.z + Math.sin(a) * r)
  }
  for (const a of [0.6, 2.4, 4.1]) {
    const x = P.x + Math.cos(a) * (P.r + 3.2)
    const z = P.z + Math.sin(a) * (P.r + 3.2)
    bush(statics, x, Y, z, 1)
    obstacles.push({ x, z, r: 1.3 })
  }

  // Mounds: walkable grass ramps.
  for (let i = 0; i < 7; i++) {
    const s = spot(5)
    if (!s) continue
    const [x, z] = s
    const w = 7 + rand() * 6
    const d = 8 + rand() * 6
    const h = 0.7 + rand() * 0.6
    const ry = rand() * Math.PI
    mound(root, x, Y, z, w, d, h, ry)
    const c = Math.cos(ry)
    const sn = Math.sin(ry)
    const pts = []
    for (const [px, py, pz] of [[-w / 2, 0, -d / 2], [w / 2, 0, -d / 2], [w / 2, 0, d / 2], [-w / 2, 0, d / 2], [-w / 2, h, -d / 4], [w / 2, h, -d / 4], [w / 2, h, d / 4], [-w / 2, h, d / 4]]) {
      pts.push(x + px * c + pz * sn, Y + py, z - px * sn + pz * c)
    }
    addFixed(RAPIER.ColliderDesc.convexHull(new Float32Array(pts)), { x: 0, y: 0, z: 0 })
  }

  for (let i = 0; i < 22; i++) {
    const s = spot(1.5)
    if (!s) continue
    tree(statics, s[0], Y, s[1], 0.85 + rand() * 0.35)
    solidBox(0.5, 2.2, 0.5, s[0], Y + 2.2, s[1])
    obstacles.push({ x: s[0], z: s[1], r: 0.9 })
  }
  for (let i = 0; i < 9; i++) {
    const s = spot(1.3)
    if (!s) continue
    pine(statics, s[0], Y, s[1], 0.9 + rand() * 0.3)
    obstacles.push({ x: s[0], z: s[1], r: 0.8 })
  }
  for (let i = 0; i < 13; i++) {
    const s = spot(1.4)
    if (!s) continue
    const stack = rand() < 0.4 ? 2 : 1
    hayBale(statics, s[0], Y, s[1], stack)
    solidBox(0.95, 0.6 * stack, 0.7, s[0], Y + 0.6 * stack, s[1])
    obstacles.push({ x: s[0], z: s[1], r: 1.2 })
  }
  for (let i = 0; i < 14; i++) {
    const s = spot(1.8)
    if (!s) continue
    const ry = rand() * Math.PI
    whiteFence(statics, s[0], Y, s[1], ry, 3.2)
    solidBox(1.6, 0.6, 0.12, s[0], Y + 0.6, s[1], ry)
    obstacles.push({ x: s[0], z: s[1], r: 1.7 })
  }
  for (let i = 0; i < 6; i++) {
    const s = spot(1)
    if (!s) continue
    rock(statics, s[0], Y, s[1], 0.8 + rand() * 0.6)
    obstacles.push({ x: s[0], z: s[1], r: 1 })
  }
  for (let i = 0; i < 45; i++) {
    const x = S.minX + rand() * (S.maxX - S.minX)
    const z = S.minZ + rand() * (LANE.maxZ - S.minZ)
    if (Math.hypot(x - P.x, z - P.z) < P.r + 1) continue
    if (i % 2) flower(statics, x, Y, z)
    else grassTuft(statics, x, Y, z)
  }

  root.add(bake(statics, true))
  root.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true
  })
  return { root, obstacles, water: water.userData.water }
}
