// The look of each area (WORLDS) in the lane: the same layout slots (trees, pines, bales, fences,
// rocks, decor, mounds, pond) dressed per area, plus area extras. Meadow keeps the farm look;
// Marsh: swamp trees, cypress, mossy logs, boardwalks, puddles; Forest: giant trees, tall pines,
// stumps, log fences, mushrooms, ferns; Mountain: snowy pines, snow boulders, stone walls, ice
// crystals, a frozen pond; Volcano: dead trees, basalt spires, obsidian with glowing cracks, a
// lava pool and lava seams. Everything static is baked; only the lava glow animates.
import { CircleGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, OctahedronGeometry } from 'three'
import { block, mat, projectUVs, rboxGeo } from './kit.js'
import { bush, cattails, flower, grassTuft, hayBale, pine, rock, tree, whiteFence } from './props.js'

const rnd = (a, b) => a + Math.random() * (b - a)
const pick = (list) => list[Math.floor(Math.random() * list.length)]
function grp(parent, x, y, z, ry = rnd(0, Math.PI * 2)) {
  const g = new Group()
  g.position.set(x, y, z)
  g.rotation.y = ry
  parent.add(g)
  return g
}
function mesh(g, geo, material, x, y, z) {
  const m = new Mesh(geo, material)
  m.position.set(x, y, z)
  m.castShadow = m.receiveShadow = true
  g.add(m)
  return m
}
const rbox = (g, w, h, d, r, color, x, y, z, opts = {}) => mesh(g, rboxGeo(w, h, d, r), mat(color, { rough: 0.85, ...opts }), x, y, z)
const cyl = (g, rt, rb, h, seg, color, x, y, z, opts = {}) => mesh(g, new CylinderGeometry(rt, rb, h, seg), mat(color, { studs: false, rough: 0.85, ...opts }), x, y + h / 2, z)
const cone = (g, r, h, color, x, y, z, seg = 4) => {
  const m = mesh(g, projectUVs(new ConeGeometry(r, h, seg, 1)), mat(color, { rough: 0.85 }), x, y, z)
  m.rotation.y = Math.PI / 4
  return m
}
const disc = (g, r, color, x, y, z, opts = {}) => {
  const m = new Mesh(new CircleGeometry(r, 18), opts.material ?? mat(color, { studs: false, rough: 1 }))
  m.rotation.x = -Math.PI / 2
  m.position.set(x, y, z)
  m.receiveShadow = true
  g.add(m)
  return m
}
// One shared glowing lava material per build, so the lane can pulse it.
const lavaMat = () => new MeshStandardMaterial({ color: '#ff7a1a', emissive: '#ff4a00', emissiveIntensity: 1.3, roughness: 0.4 })
const EMBER = mat('#ff8a2a', { emissive: '#ff5a00', ei: 1.4, studs: false })

// --- Marsh --------------------------------------------------------------------------------------
function swampTree(p, x, y, z, s) {
  const g = grp(p, x, y, z)
  block(g, 1.4 * s, 1.2 * s, 1.4 * s, '#4f3d2a', 0, 0.6 * s, 0)
  block(g, 0.9 * s, 4.6 * s, 0.9 * s, '#5a4630', 0, 2.8 * s, 0)
  block(g, 1.6 * s, 0.3 * s, 0.3 * s, '#5a4630', 0.6 * s, 3.8 * s, 0, { rz: 0.5 })
  block(g, 1.4 * s, 0.3 * s, 0.3 * s, '#5a4630', -0.5 * s, 4.2 * s, 0.2 * s, { rz: -0.6 })
  rbox(g, 6 * s, 1.1 * s, 5.4 * s, 0.4 * s, '#6e9a3a', 0, 5.4 * s, 0)
  rbox(g, 4.2 * s, 0.9 * s, 3.8 * s, 0.35 * s, '#7fab45', 0.3 * s, 6.2 * s, -0.2 * s)
  for (let i = 0; i < 9; i++) {
    const a = rnd(0, Math.PI * 2)
    const r = rnd(1.4, 2.7) * s
    const h = rnd(0.9, 2) * s
    block(g, 0.12 * s, h, 0.12 * s, '#a3c06a', Math.cos(a) * r, 5 * s - h / 2, Math.sin(a) * r, { shadow: false })
  }
}
function cypress(p, x, y, z, s) {
  const g = grp(p, x, y, z)
  block(g, 1.5 * s, 0.8 * s, 1.5 * s, '#6b5038', 0, 0.4 * s, 0)
  block(g, 0.7 * s, 6 * s, 0.7 * s, '#6b5038', 0, 3.4 * s, 0)
  for (let i = 0; i < 4; i++) block(g, 0.3, rnd(0.4, 0.8), 0.3, '#6b5038', rnd(-1.6, 1.6) * s, 0.25, rnd(-1.6, 1.6) * s)
  for (const [w, cy] of [[2.6, 4.2], [2.2, 5.6], [1.6, 6.9], [1, 7.9]]) rbox(g, w * s, 1.3 * s, w * s, 0.3 * s, '#4f7f3a', 0, cy * s, 0)
}
function mossyLog(p, x, y, z, stack) {
  const g = grp(p, x, y, z)
  for (let i = 0; i < stack; i++) {
    const l = cyl(g, 0.45, 0.5, 2.2, 8, '#6b4a2e', 0, 0, 0)
    l.rotation.z = Math.PI / 2
    l.position.set(0, 0.5 + i * 0.85, 0)
    l.rotation.y = i * 0.9
    block(g, 1.5, 0.18, 0.6, '#7fb048', 0, 0.95 + i * 0.85, 0, { ry: i * 0.9, shadow: false })
  }
  block(g, 0.3, 0.3, 0.3, '#e8e2c8', 0.6, 0.95, 0.35, { shadow: false })
}
function boardwalk(p, x, y, z, ry) {
  const g = grp(p, x, y, z, ry)
  for (let i = 0; i < 7; i++) block(g, 0.42, 0.12, 1.3, i % 2 ? '#9a7a52' : '#8a6a46', -1.4 + i * 0.47, 0.42, 0, { ry: rnd(-0.05, 0.05) })
  for (const sx of [-1.5, 1.5]) for (const sz of [-0.55, 0.55]) block(g, 0.2, 1.2, 0.2, '#6b5038', sx, 0.6, sz)
  block(g, 3.2, 0.1, 0.1, '#c9b48a', 0, 1.1, 0.55, { shadow: false })
}
function mossRock(p, x, y, z, s, moss = '#6fae4a') {
  const g = grp(p, x, y, z)
  rbox(g, 1.5 * s, 0.9 * s, 1.2 * s, 0.2 * s, '#7f8a86', 0, 0.42 * s, 0)
  rbox(g, 1.2 * s, 0.25 * s, 1 * s, 0.1 * s, moss, 0, 0.9 * s, 0, { studs: false })
}
function puddle(p, x, y, z, r) {
  const g = grp(p, x, y, z)
  disc(g, r + 0.4, '#5d4c33', 0, 0.03, 0)
  disc(g, r, null, 0, 0.06, 0, { material: new MeshStandardMaterial({ color: '#4f8a70', roughness: 0.15, metalness: 0.1 }) })
  for (let i = 0; i < 2; i++) disc(g, rnd(0.25, 0.4), '#5fb04a', rnd(-r, r) * 0.5, 0.08, rnd(-r, r) * 0.5)
}

// --- Forest -------------------------------------------------------------------------------------
function bigTree(p, x, y, z, s) {
  const g = grp(p, x, y, z)
  block(g, 1.3 * s, 6.5 * s, 1.3 * s, '#6b4424', 0, 3.25 * s, 0)
  for (const [dx, dz] of [[0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]]) block(g, 0.7 * s, 0.7 * s, 0.7 * s, '#5a3a1e', dx * s, 0.3 * s, dz * s)
  block(g, 2 * s, 0.4 * s, 0.4 * s, '#6b4424', 0.8 * s, 5 * s, 0, { rz: 0.5 })
  const greens = ['#2f8a2a', '#3a9a32', '#2a7d26']
  for (const [w, h, cy] of [[7, 2, 7], [5.8, 1.8, 8.6], [4.2, 1.5, 10], [2.6, 1.2, 11.1]]) rbox(g, w * s, h * s, w * 0.92 * s, 0.4 * s, pick(greens), 0, cy * s, 0)
}
function darkPine(p, x, y, z, s) {
  const g = grp(p, x, y, z)
  block(g, 0.7 * s, 3 * s, 0.7 * s, '#5a3a1e', 0, 1.5 * s, 0)
  const c = pick(['#17702e', '#1b7a34'])
  for (const [r, h, cy] of [[3, 2.8, 3.4], [2.5, 2.6, 5.3], [1.9, 2.4, 7], [1.2, 2.2, 8.5]]) cone(g, r * s, h * s, c, 0, cy * s, 0)
}
function stump(p, x, y, z, stack) {
  const g = grp(p, x, y, z)
  cyl(g, 0.65, 0.8, 1.1, 10, '#7a5230', 0, 0, 0)
  cyl(g, 0.6, 0.6, 0.06, 10, '#d8b07a', 0, 1.1, 0)
  for (let i = 0; i < 3; i++) block(g, 0.35, 0.3, 0.35, '#6b4424', Math.cos(i * 2.1) * 0.75, 0.15, Math.sin(i * 2.1) * 0.75)
  if (stack > 1) {
    const l = cyl(g, 0.4, 0.45, 2.6, 8, '#7a5230', 0, 0, 0)
    l.rotation.z = Math.PI / 2
    l.position.set(0.3, 0.42, 0.9)
  }
  mushroom(g, 0.55, 1.1, 0.1, 0.6)
}
function logFence(p, x, y, z, ry) {
  const g = grp(p, x, y, z, ry)
  for (const sx of [-1.5, 0, 1.5]) cyl(g, 0.16, 0.18, 1.3, 6, '#6b4424', sx, 0, 0)
  for (const [yy, rz] of [[0.9, 0.04], [0.5, -0.05]]) {
    const r = cyl(g, 0.11, 0.11, 3.4, 6, '#8a5f36', 0, 0, 0)
    r.rotation.z = Math.PI / 2 + rz
    r.position.set(0, yy, 0)
  }
}
function mushroom(p, x, y, z, s = 1) {
  const g = grp(p, x, y, z)
  block(g, 0.18 * s, 0.4 * s, 0.18 * s, '#f2eedf', 0, 0.2 * s, 0, { shadow: false })
  const capColor = pick(['#e8392a', '#e8392a', '#f2a23a'])
  rbox(g, 0.6 * s, 0.25 * s, 0.6 * s, 0.1 * s, capColor, 0, 0.45 * s, 0, { studs: false })
  for (let i = 0; i < 3; i++) block(g, 0.08 * s, 0.04 * s, 0.08 * s, '#ffffff', rnd(-0.18, 0.18) * s, 0.58 * s, rnd(-0.18, 0.18) * s, { shadow: false })
}
function fern(p, x, y, z) {
  const g = grp(p, x, y, z)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    block(g, 0.9, 0.06, 0.22, i % 2 ? '#2f9a3a' : '#3aa844', Math.cos(a) * 0.4, 0.3, Math.sin(a) * 0.4, { ry: -a, rz: 0.45, shadow: false })
  }
}

// --- Mountain -----------------------------------------------------------------------------------
function snowPine(p, x, y, z, s) {
  const g = grp(p, x, y, z)
  block(g, 0.6 * s, 2 * s, 0.6 * s, '#5a3a1e', 0, 1 * s, 0)
  for (const [r, h, cy] of [[2.7, 2.4, 2.6], [2.1, 2.2, 4.2], [1.5, 2, 5.7]]) {
    cone(g, r * s, h * s, '#1f6e4a', 0, cy * s, 0)
    cone(g, r * 0.62 * s, h * 0.5 * s, '#f6faff', 0, (cy + h * 0.27) * s, 0)
  }
}
function snowBoulder(p, x, y, z, stack) {
  const g = grp(p, x, y, z)
  rbox(g, 1.9, 1.1, 1.4, 0.4, '#f4f8ff', 0, 0.55, 0)
  if (stack > 1) rbox(g, 1.2, 0.9, 1, 0.3, '#eef4fc', 0.15, 1.45, 0)
  mesh(g, new OctahedronGeometry(0.45, 0), mat('#a8dcff', { rough: 0.15, studs: false }), 0.8, 0.5, 0.5).scale.y = 1.8
}
function stoneWall(p, x, y, z, ry) {
  const g = grp(p, x, y, z, ry)
  for (let i = 0; i < 4; i++) {
    const h = rnd(0.9, 1.25)
    block(g, 0.82, h, 0.5, pick(['#8f97a3', '#9ea6b1', '#858d99']), -1.23 + i * 0.82, h / 2, 0, { round: 0.06 })
    block(g, 0.86, 0.18, 0.56, '#f6faff', -1.23 + i * 0.82, h + 0.09, 0, { round: 0.06 })
  }
}
function snowRock(p, x, y, z, s) {
  const g = grp(p, x, y, z)
  rbox(g, 1.5 * s, 0.9 * s, 1.2 * s, 0.2 * s, '#8a93a0', 0, 0.42 * s, 0)
  rbox(g, 1.3 * s, 0.3 * s, 1.05 * s, 0.14 * s, '#ffffff', 0, 0.92 * s, 0)
}
function iceCrystal(p, x, y, z) {
  const g = grp(p, x, y, z)
  const m = mat('#9fe0ff', { rough: 0.1, emissive: '#5ac8ff', ei: 0.25, studs: false })
  for (let i = 0; i < 3; i++) {
    const c = mesh(g, new OctahedronGeometry(rnd(0.25, 0.4), 0), m, rnd(-0.3, 0.3), 0.4, rnd(-0.3, 0.3))
    c.scale.y = rnd(1.8, 2.6)
    c.rotation.z = rnd(-0.3, 0.3)
  }
}
function cairn(p, x, y, z) {
  const g = grp(p, x, y, z)
  let yy = 0
  for (const w of [1, 0.8, 0.6, 0.4]) {
    rbox(g, w, w * 0.45, w * 0.9, w * 0.12, pick(['#9ea6b1', '#858d99']), rnd(-0.06, 0.06), yy + w * 0.22, 0)
    yy += w * 0.45
  }
}

// --- Volcano ------------------------------------------------------------------------------------
function deadTree(p, x, y, z, s) {
  const g = grp(p, x, y, z)
  const c = '#2a2220'
  block(g, 0.8 * s, 4.6 * s, 0.8 * s, c, 0, 2.3 * s, 0)
  for (const [len, yy, rz, ry] of [[2, 3.4, 0.7, 0], [1.6, 4, -0.8, 1.2], [1.4, 2.6, 0.9, 2.4], [1.1, 4.6, -0.5, 3.6]]) {
    const b = block(g, len * s, 0.26 * s, 0.26 * s, c, 0, yy * s, 0, { rz })
    b.rotation.order = 'YXZ'
    b.rotation.y = ry
    b.position.x = Math.cos(ry) * len * 0.4 * s
    b.position.z = -Math.sin(ry) * len * 0.4 * s
  }
  block(g, 0.2 * s, 0.2 * s, 0.2 * s, EMBER, 0, 4.7 * s, 0, { shadow: false })
}
function basaltSpire(p, x, y, z, s) {
  const g = grp(p, x, y, z)
  for (let i = 0; i < 5; i++) {
    const h = rnd(2, 6.5) * s
    cyl(g, 0.55, 0.6, h, 6, pick(['#3a3238', '#332c31', '#40373d']), rnd(-0.8, 0.8) * s, 0, rnd(-0.8, 0.8) * s, { rough: 0.95 })
  }
}
function obsidian(p, x, y, z, stack, lava) {
  const g = grp(p, x, y, z)
  rbox(g, 1.9, 1.1 * stack, 1.4, 0.25, '#1e1a24', 0, 0.55 * stack, 0, { rough: 0.3 })
  mesh(g, rboxGeo(0.12, 1 * stack, 1.42, 0.04), lava, 0.25, 0.55 * stack, 0).castShadow = false
}
function basaltRow(p, x, y, z, ry) {
  const g = grp(p, x, y, z, ry)
  for (let i = 0; i < 4; i++) cyl(g, 0.38, 0.42, rnd(0.9, 1.6), 6, pick(['#3a3238', '#463c42']), -1.2 + i * 0.8, 0, rnd(-0.1, 0.1))
}
function lavaRock(p, x, y, z, s, lava) {
  const g = grp(p, x, y, z)
  rbox(g, 1.5 * s, 0.9 * s, 1.2 * s, 0.2 * s, '#2e2629', 0, 0.42 * s, 0)
  mesh(g, rboxGeo(1.3 * s, 0.1 * s, 0.1 * s, 0.04), lava, 0, 0.6 * s, 0.6 * s).castShadow = false
}
function emberVent(p, x, y, z) {
  const g = grp(p, x, y, z)
  rbox(g, 1, 0.3, 1, 0.12, '#3a2c28', 0, 0.15, 0)
  for (let i = 0; i < 4; i++) block(g, 0.16, 0.16, 0.16, EMBER, rnd(-0.3, 0.3), rnd(0.32, 0.5), rnd(-0.3, 0.3), { shadow: false })
}
function ashPile(p, x, y, z) {
  const g = grp(p, x, y, z)
  rbox(g, 1.2, 0.35, 1, 0.15, '#5a504c', 0, 0.17, 0, { studs: false })
  rbox(g, 0.7, 0.25, 0.6, 0.1, '#6a605c', 0.1, 0.42, 0, { studs: false })
}
function lavaSeam(p, x, y, z, lava) {
  const g = grp(p, x, y, z)
  let px = 0
  let pz = 0
  for (let i = 0; i < 5; i++) {
    const len = rnd(1.2, 2.4)
    const a = rnd(-0.6, 0.6)
    const m = mesh(g, rboxGeo(len, 0.06, 0.28, 0.02), lava, px + (Math.cos(a) * len) / 2, 0.04, pz + (Math.sin(a) * len) / 2)
    m.rotation.y = -a
    m.castShadow = false
    px += Math.cos(a) * len
    pz += Math.sin(a) * len
  }
}

// --- Area looks ----------------------------------------------------------------------------------
// ground: lane checker colours; cliff: the terraced cliffs' cap colour; pond: { water, rim, opacity,
// lava, ice, pads }; mound: [top, side]; then a builder per slot kind and the area extras.
export const AREAS = {
  meadow: {
    ground: ['#55d842', '#62e04e'], cliff: '#4bc93a', mound: ['#c4e04a', '#b2d43c'],
    pond: { water: '#2fb8ea', rim: '#d9c48e', opacity: 0.92, pads: 6 },
    tree: (p, x, y, z, s) => tree(p, x, y, z, s), pine: (p, x, y, z, s) => pine(p, x, y, z, s),
    bale: (p, x, y, z, n) => hayBale(p, x, y, z, n), fence: (p, x, y, z, ry) => whiteFence(p, x, y, z, ry, 3.2),
    rock: (p, x, y, z, s) => rock(p, x, y, z, s), bush: (p, x, y, z) => bush(p, x, y, z, 1),
    reed: (p, x, y, z) => cattails(p, x, y, z), decor: (p, x, y, z, k) => (k ? flower(p, x, y, z) : grassTuft(p, x, y, z)),
    extras: (p, spot) => {
      for (let i = 0; i < 24; i++) {
        const s = spot()
        if (s) flower(p, s[0], s[1], s[2])
      }
    },
  },
  marsh: {
    ground: ['#6aa257', '#74ab5f'], cliff: '#6a9a48', mound: ['#8aa85a', '#76924c'],
    pond: { water: '#4f8f6a', rim: '#6b5a3a', opacity: 0.9, pads: 14 },
    tree: swampTree, pine: cypress, bale: mossyLog, fence: boardwalk, rock: (p, x, y, z, s) => mossRock(p, x, y, z, s),
    bush: (p, x, y, z) => {
      cattails(p, x - 0.5, y, z)
      cattails(p, x + 0.5, y, z + 0.4)
    },
    reed: (p, x, y, z) => cattails(p, x, y, z), decor: (p, x, y, z, k) => (k ? cattails(p, x, y, z) : grassTuft(p, x, y, z)),
    extras: (p, spot) => {
      for (let i = 0; i < 14; i++) {
        const s = spot()
        if (s) puddle(p, s[0], s[1], s[2], rnd(1.2, 2.6))
      }
      for (let i = 0; i < 12; i++) {
        const s = spot()
        if (s) mushroom(p, s[0], s[1], s[2], 0.7)
      }
    },
  },
  forest: {
    ground: ['#3fa83a', '#48b242'], cliff: '#2f8a2a', mound: ['#5f9a3a', '#4f8a30'],
    pond: { water: '#2f9ac8', rim: '#7a6040', opacity: 0.9, pads: 3 },
    tree: bigTree, pine: (p, x, y, z, s) => darkPine(p, x, y, z, s * 1.2), bale: stump, fence: logFence,
    rock: (p, x, y, z, s) => mossRock(p, x, y, z, s, '#3f9a3a'), bush: (p, x, y, z) => {
      fern(p, x, y, z)
      fern(p, x + 0.8, y, z + 0.5)
    },
    reed: (p, x, y, z) => fern(p, x, y, z), decor: (p, x, y, z, k) => (k ? mushroom(p, x, y, z, rnd(0.7, 1.1)) : fern(p, x, y, z)),
    extras: (p, spot) => {
      for (let i = 0; i < 26; i++) {
        const s = spot()
        if (s) (i % 3 ? fern : mushroom)(p, s[0], s[1], s[2])
      }
      for (let i = 0; i < 8; i++) {
        const s = spot()
        if (!s) continue
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2
          mushroom(p, s[0] + Math.cos(a) * 0.9, s[1], s[2] + Math.sin(a) * 0.9, 0.6)
        }
      }
    },
  },
  mountain: {
    ground: ['#e6eef8', '#f4f9ff'], cliff: '#f6faff', mound: ['#ffffff', '#e2ebf6'],
    pond: { water: '#bfe8ff', rim: '#ffffff', opacity: 1, pads: 0, ice: true },
    tree: snowPine, pine: (p, x, y, z, s) => snowPine(p, x, y, z, s * 1.25), bale: snowBoulder, fence: stoneWall, rock: snowRock,
    bush: (p, x, y, z) => snowBoulder(p, x, y, z, 1), reed: (p, x, y, z) => iceCrystal(p, x, y, z),
    decor: (p, x, y, z, k) => (k ? iceCrystal(p, x, y, z) : disc(grp(p, x, y, z), rnd(0.6, 1.2), '#ffffff', 0, 0.05, 0)),
    extras: (p, spot) => {
      for (let i = 0; i < 10; i++) {
        const s = spot()
        if (s) cairn(p, s[0], s[1], s[2])
      }
      for (let i = 0; i < 16; i++) {
        const s = spot()
        if (s) iceCrystal(p, s[0], s[1], s[2])
      }
    },
  },
  volcano: {
    ground: ['#4e3530', '#583c36'], cliff: '#3a2a26', mound: ['#4a2c24', '#3d241e'],
    pond: { lava: true, rim: '#2a2220', pads: 0 },
    tree: deadTree, pine: basaltSpire, bale: (p, x, y, z, n, lava) => obsidian(p, x, y, z, n, lava), fence: basaltRow,
    rock: (p, x, y, z, s, lava) => lavaRock(p, x, y, z, s, lava), bush: (p, x, y, z) => ashPile(p, x, y, z),
    reed: (p, x, y, z) => emberVent(p, x, y, z), decor: (p, x, y, z, k) => (k ? emberVent(p, x, y, z) : ashPile(p, x, y, z)),
    extras: (p, spot, lava) => {
      for (let i = 0; i < 22; i++) {
        const s = spot()
        if (s) lavaSeam(p, s[0], s[1], s[2], lava)
      }
      for (let i = 0; i < 10; i++) {
        const s = spot()
        if (s) basaltSpire(p, s[0], s[1], s[2], 0.5)
      }
    },
  },
}

// A pond in the area's look (water, ice or lava), with its rim and lily pads.
export function areaPond(p, look, x, y, z, r, lava) {
  const g = grp(p, x, y, z, 0)
  disc(g, r + 1.6, look.rim, 0, 0.04, 0)
  const surface = look.lava ? lava : new MeshStandardMaterial({ color: look.water, roughness: look.ice ? 0.08 : 0.12, metalness: 0.1, transparent: look.opacity < 1, opacity: look.opacity })
  disc(g, r, null, 0, 0.1, 0, { material: surface })
  for (let i = 0; i < look.pads; i++) {
    const a = rnd(0, Math.PI * 2)
    disc(g, rnd(0.5, 0.8), '#3fbf4a', Math.cos(a) * rnd(0.3, 0.85) * r, 0.13, Math.sin(a) * rnd(0.3, 0.85) * r)
  }
  if (look.ice) for (let i = 0; i < 5; i++) block(g, rnd(1, 2.4), 0.04, 0.08, '#ffffff', rnd(-0.6, 0.6) * r, 0.12, rnd(-0.6, 0.6) * r, { ry: rnd(0, 3), shadow: false })
  if (look.lava) for (let i = 0; i < 8; i++) rbox(g, rnd(0.8, 1.6), 0.3, rnd(0.6, 1.2), 0.12, '#2a2220', Math.cos(i) * r * 0.55, 0.12, Math.sin(i) * r * 0.55)
  return g
}
export { lavaMat }
