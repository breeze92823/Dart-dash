// The lane: the ground below the aiming band where the animals roam. It holds every area
// (WORLDS, config LANE_AREAS) one after another, Meadow nearest the band and Volcano at the
// cliff: each its own stretch with its own layout (pond, mounds, trees, pines, bales, fences,
// rocks, decor), colliders and the obstacle circles its animals steer round, dressed in its look
// (areas.js). Tall props stand in strips along both sides (LANE.treeX) so the view down the lane
// stays open for long shots. Areas past the view distance are hidden (`cull`).
import { Group, Mesh } from 'three'
import { AREA_IDS, LANE, LANE_AREAS } from '../config.js'
import { RAPIER, addFixed } from '../physics.js'
import { solidBox } from '../propkit.js'
import { bake } from '../bake.js'
import { mulberry32 } from '../textures.js'
import { boxGeo, mat, wedgeGeo } from './kit.js'
import { AREAS, areaPond, lavaMat } from './areas.js'

// Flat-topped walkable ramp in the area's mound colours.
function mound(parent, x, y, z, w, d, h, ry, [topC, sideC]) {
  const g = new Group()
  g.position.set(x, y, z)
  g.rotation.y = ry
  parent.add(g)
  const flat = new Mesh(boxGeo(w, h, d * 0.5), mat(topC, { rough: 0.9 }))
  flat.position.y = h / 2
  g.add(flat)
  for (const dir of [-1, 1]) {
    const r = new Mesh(wedgeGeo(w, h, d * 0.25), mat(sideC, { rough: 0.9 }))
    r.position.z = dir * d * 0.375
    r.rotation.y = dir > 0 ? 0 : Math.PI
    g.add(r)
  }
}

// One area's layout: slot positions + colliders + obstacles (shared by nothing else).
function layout(A, seed) {
  const rand = mulberry32(seed)
  const Y = LANE.y
  const P = A.pond
  const S = A.spawn
  const obstacles = [] // { x, z, r } circles animals avoid
  const slots = { reeds: [], bushes: [], mounds: [], trees: [], pines: [], bales: [], fences: [], rocks: [], decor: [], open: [] }
  const zTop = A.maxZ - (A.index === 0 ? 6 : 2) // keep the foot of the slope clear
  const free = (x, z, r) => {
    if (Math.hypot(x - P.x, z - P.z) < P.r + 3 + r) return false
    if (z > zTop || z < A.minZ + 2) return false
    for (const o of obstacles) if (Math.hypot(x - o.x, z - o.z) < o.r + r + 1.5) return false
    return true
  }
  // A free spot in the middle of the lane (where the animals roam).
  const spot = (r, tries = 40) => {
    for (let i = 0; i < tries; i++) {
      const x = S.minX + rand() * (S.maxX - S.minX)
      const z = S.minZ + rand() * (S.maxZ - S.minZ)
      if (free(x, z, r)) return [x, z]
    }
    return null
  }
  // A free spot in one of the side strips (tall props).
  const side = (r, tries = 30) => {
    const [x0, x1] = LANE.treeX
    for (let i = 0; i < tries; i++) {
      const x = (rand() < 0.5 ? -1 : 1) * (x0 + rand() * (x1 - x0))
      const z = A.minZ + 3 + rand() * (zTop - A.minZ - 3)
      if (free(x, z, r)) return [x, z]
    }
    return null
  }

  obstacles.push({ x: P.x, z: P.z, r: P.r + 0.8, pond: true })
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rand() * 0.3
    const r = P.r + 0.6 + rand() * 1.2
    slots.reeds.push([P.x + Math.cos(a) * r, P.z + Math.sin(a) * r])
  }
  for (const a of [0.6, 2.4, 4.1]) {
    const x = P.x + Math.cos(a) * (P.r + 3.2)
    const z = P.z + Math.sin(a) * (P.r + 3.2)
    slots.bushes.push([x, z])
    obstacles.push({ x, z, r: 1.3 })
  }
  for (let i = 0; i < 5; i++) {
    const s = spot(5)
    if (!s) continue
    const [x, z] = s
    const w = 7 + rand() * 6
    const d = 8 + rand() * 6
    const h = 0.7 + rand() * 0.6
    const ry = rand() * Math.PI
    slots.mounds.push([x, z, w, d, h, ry])
    const c = Math.cos(ry)
    const sn = Math.sin(ry)
    const pts = []
    for (const [px, py, pz] of [[-w / 2, 0, -d / 2], [w / 2, 0, -d / 2], [w / 2, 0, d / 2], [-w / 2, 0, d / 2], [-w / 2, h, -d / 4], [w / 2, h, -d / 4], [w / 2, h, d / 4], [-w / 2, h, d / 4]]) {
      pts.push(x + px * c + pz * sn, Y + py, z - px * sn + pz * c)
    }
    addFixed(RAPIER.ColliderDesc.convexHull(new Float32Array(pts)), { x: 0, y: 0, z: 0 })
  }
  for (let i = 0; i < 14; i++) {
    const s = side(1.5)
    if (!s) continue
    slots.trees.push([s[0], s[1], 0.85 + rand() * 0.35])
    solidBox(0.5, 2.2, 0.5, s[0], Y + 2.2, s[1])
    obstacles.push({ x: s[0], z: s[1], r: 0.9 })
  }
  for (let i = 0; i < 8; i++) {
    const s = side(1.3)
    if (!s) continue
    slots.pines.push([s[0], s[1], 0.9 + rand() * 0.3])
    obstacles.push({ x: s[0], z: s[1], r: 0.8 })
  }
  for (let i = 0; i < 9; i++) {
    const s = spot(1.4)
    if (!s) continue
    const stack = rand() < 0.4 ? 2 : 1
    slots.bales.push([s[0], s[1], stack])
    solidBox(0.95, 0.6 * stack, 0.7, s[0], Y + 0.6 * stack, s[1])
    obstacles.push({ x: s[0], z: s[1], r: 1.2 })
  }
  for (let i = 0; i < 10; i++) {
    const s = spot(1.8)
    if (!s) continue
    const ry = rand() * Math.PI
    slots.fences.push([s[0], s[1], ry])
    solidBox(1.6, 0.6, 0.12, s[0], Y + 0.6, s[1], ry)
    obstacles.push({ x: s[0], z: s[1], r: 1.7 })
  }
  for (let i = 0; i < 5; i++) {
    const s = spot(1)
    if (!s) continue
    slots.rocks.push([s[0], s[1], 0.8 + rand() * 0.6])
    obstacles.push({ x: s[0], z: s[1], r: 1 })
  }
  for (let i = 0; i < 34; i++) {
    const x = LANE.minX + 4 + rand() * (LANE.maxX - LANE.minX - 8)
    const z = A.minZ + 1 + rand() * (zTop - A.minZ - 1)
    if (Math.hypot(x - P.x, z - P.z) < P.r + 1) continue
    slots.decor.push([x, z, i % 2])
  }
  // Open ground for the area extras (no colliders: puddles, mushrooms, crystals, lava seams).
  for (let i = 0; i < 45; i++) {
    const s = spot(1.2, 12)
    if (s) slots.open.push(s)
  }
  return { slots, obstacles }
}

export function buildLane(scene) {
  const root = new Group()
  scene.add(root)
  const Y = LANE.y
  const lava = lavaMat()
  const obstacles = {} // area id -> circles its animals avoid
  const groups = {} // area id -> its props (hidden past the view distance)

  AREA_IDS.forEach((id, i) => {
    const A = LANE_AREAS[id]
    const look = AREAS[id] ?? AREAS.meadow
    const { slots, obstacles: obs } = layout(A, 4242 + i * 977)
    obstacles[id] = obs
    const g = new Group()
    const statics = new Group()
    const P = A.pond
    areaPond(g, look, P.x, Y, P.z, P.r, lava)
    for (const m of slots.mounds) mound(g, m[0], Y, m[1], m[2], m[3], m[4], m[5], look.mound)
    for (const [x, z] of slots.reeds) look.reed(statics, x, Y, z)
    for (const [x, z] of slots.bushes) look.bush(statics, x, Y, z)
    for (const [x, z, s] of slots.trees) look.tree(statics, x, Y, z, s)
    for (const [x, z, s] of slots.pines) look.pine(statics, x, Y, z, s)
    for (const [x, z, n] of slots.bales) look.bale(statics, x, Y, z, n, lava)
    for (const [x, z, ry] of slots.fences) look.fence(statics, x, Y, z, ry)
    for (const [x, z, s] of slots.rocks) look.rock(statics, x, Y, z, s, lava)
    for (const [x, z, k] of slots.decor) look.decor(statics, x, Y, z, k)
    let n = 0
    look.extras(statics, () => {
      const s = slots.open[n++ % slots.open.length]
      return s && [s[0], Y, s[1]]
    }, lava)
    g.add(bake(statics, true))
    g.traverse((o) => {
      if (o.isMesh) o.receiveShadow = true
    })
    root.add(g)
    groups[id] = g
  })

  return {
    root,
    obstacles,
    groups,
    // Hide the areas whose nearest edge is more than `dist` m (along the lane) from camera z.
    cull(camZ, dist) {
      for (const id of AREA_IDS) {
        const A = LANE_AREAS[id]
        const d = camZ > A.maxZ ? camZ - A.maxZ : camZ < A.minZ ? A.minZ - camZ : 0
        groups[id].visible = d < dist
      }
    },
    // The lava pools and seams pulse.
    update(elapsed) {
      lava.emissiveIntensity = 1.1 + Math.sin(elapsed * 2.2) * 0.35
    },
  }
}
