// The lane: the ground below the aiming band where the animals roam. One fixed layout (pond,
// mounds, trees, pines, bales, fences, rocks, decor) with its colliders and the obstacle circles
// animals steer round; each area (WORLDS, see areas.js) dresses those slots in its own look, built
// on first visit and cached. The strip past the green barrier is dressed as the next area.
import { Group, Mesh } from 'three'
import { BARRIER, LANE } from '../config.js'
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

export function buildLane(scene) {
  const root = new Group()
  scene.add(root)
  const obstacles = [] // { x, z, r } circles animals avoid
  const rand = mulberry32(4242)
  const Y = LANE.y
  const P = LANE.pond
  const S = LANE.spawn
  const slots = { reeds: [], bushes: [], mounds: [], trees: [], pines: [], bales: [], fences: [], rocks: [], decor: [], open: [] }

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

  // --- The layout + colliders (shared by every area) ------------------------------------------
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
  for (let i = 0; i < 7; i++) {
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
  for (let i = 0; i < 22; i++) {
    const s = spot(1.5)
    if (!s) continue
    slots.trees.push([s[0], s[1], 0.85 + rand() * 0.35])
    solidBox(0.5, 2.2, 0.5, s[0], Y + 2.2, s[1])
    obstacles.push({ x: s[0], z: s[1], r: 0.9 })
  }
  for (let i = 0; i < 9; i++) {
    const s = spot(1.3)
    if (!s) continue
    slots.pines.push([s[0], s[1], 0.9 + rand() * 0.3])
    obstacles.push({ x: s[0], z: s[1], r: 0.8 })
  }
  for (let i = 0; i < 13; i++) {
    const s = spot(1.4)
    if (!s) continue
    const stack = rand() < 0.4 ? 2 : 1
    slots.bales.push([s[0], s[1], stack])
    solidBox(0.95, 0.6 * stack, 0.7, s[0], Y + 0.6 * stack, s[1])
    obstacles.push({ x: s[0], z: s[1], r: 1.2 })
  }
  for (let i = 0; i < 14; i++) {
    const s = spot(1.8)
    if (!s) continue
    const ry = rand() * Math.PI
    slots.fences.push([s[0], s[1], ry])
    solidBox(1.6, 0.6, 0.12, s[0], Y + 0.6, s[1], ry)
    obstacles.push({ x: s[0], z: s[1], r: 1.7 })
  }
  for (let i = 0; i < 6; i++) {
    const s = spot(1)
    if (!s) continue
    slots.rocks.push([s[0], s[1], 0.8 + rand() * 0.6])
    obstacles.push({ x: s[0], z: s[1], r: 1 })
  }
  for (let i = 0; i < 45; i++) {
    const x = S.minX + rand() * (S.maxX - S.minX)
    const z = S.minZ + rand() * (LANE.maxZ - S.minZ)
    if (Math.hypot(x - P.x, z - P.z) < P.r + 1) continue
    slots.decor.push([x, z, i % 2])
  }
  // Open ground for the area extras (no colliders: puddles, mushrooms, crystals, lava seams).
  for (let i = 0; i < 60; i++) {
    const s = spot(1.2, 12)
    if (s) slots.open.push(s)
  }

  // --- Dressing ------------------------------------------------------------------------------
  const lava = lavaMat()
  function dressLane(id) {
    const look = AREAS[id] ?? AREAS.meadow
    const g = new Group()
    const statics = new Group()
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
    return g
  }
  // The strip past the barrier: a looser scatter of the same pieces, no colliders.
  const farZ = BARRIER.z - BARRIER.depth
  function dressStrip(id) {
    const look = AREAS[id] ?? AREAS.meadow
    const r = mulberry32(99)
    const at = (margin = 4) => [LANE.minX + margin + r() * (LANE.maxX - LANE.minX - margin * 2), Y, farZ + 6 + r() * (BARRIER.depth - 12)]
    const g = new Group()
    const statics = new Group()
    const [px, , pz] = at(20)
    areaPond(g, look, px, Y, pz, 9, lava)
    const clear = (x, z) => Math.hypot(x - px, z - pz) > 12 && z < BARRIER.z - 4
    const place = (count, fn) => {
      for (let i = 0; i < count; i++) {
        const [x, y, z] = at()
        if (clear(x, z)) fn(x, y, z)
      }
    }
    place(30, (x, y, z) => look.tree(statics, x, y, z, 0.9 + r() * 0.5))
    place(20, (x, y, z) => look.pine(statics, x, y, z, 1 + r() * 0.5))
    place(12, (x, y, z) => look.bale(statics, x, y, z, r() < 0.4 ? 2 : 1, lava))
    place(10, (x, y, z) => look.fence(statics, x, y, z, r() * Math.PI))
    place(10, (x, y, z) => look.rock(statics, x, y, z, 0.8 + r() * 0.8, lava))
    place(60, (x, y, z) => look.decor(statics, x, y, z, r() < 0.5 ? 1 : 0))
    look.extras(statics, () => {
      const [x, y, z] = at()
      return clear(x, z) ? [x, y, z] : null
    }, lava)
    g.add(bake(statics, true))
    g.traverse((o) => {
      if (o.isMesh) o.receiveShadow = true
    })
    return g
  }

  const laneLooks = new Map()
  const stripLooks = new Map()
  const show = (cache, build, id) => {
    if (!cache.has(id)) {
      const g = build(id)
      root.add(g)
      cache.set(id, g)
    }
    for (const [k, g] of cache) g.visible = k === id
  }
  return {
    root,
    obstacles,
    // Dress the lane as `id` and the strip past the barrier as `next` (null: none).
    setArea(id, next) {
      show(laneLooks, dressLane, id)
      if (next) show(stripLooks, dressStrip, next)
      else for (const g of stripLooks.values()) g.visible = false
    },
    // The lava pools and seams pulse.
    update(elapsed) {
      lava.emissiveIntensity = 1.1 + Math.sin(elapsed * 2.2) * 0.35
    },
  }
}
