// Voxel animal models. Every species is built from stud-plated boxes into the
// same rig shape so animals.js can animate any of them:
//   root (placed + yawed by the game)
//   └ pose (bob / hop / tip over when asleep)
//      ├ body parts
//      ├ head (pivot at the neck: peck / graze / look)
//      ├ legs[] (pivots at the hips: walk cycle)
//      ├ wings[] (birds: flap), tail
//      └ eyes: open / closed sets (closed while asleep)
// Facing +Z, feet at y = 0. Mutations re-colour the materials: golden (metal
// gold by luminance), rainbow (hue-cycling, see tickMutations), shiny (pale
// glow; sparkles come from animals.js), diamond (icy crystal), void (dark, purple glow).
// New species reuse a body with a recolor map and a scale (config ANIMALS).
import { Color, Group, MeshStandardMaterial } from 'three'
import { block, boxGeo, rboxGeo, studNormal } from '../world/kit.js'
import { Mesh, Vector2 } from 'three'
import { ANIMALS } from '../config.js'

const c = new Color()
const lum = (hex) => {
  c.set(hex)
  return 0.3 * c.r + 0.59 * c.g + 0.11 * c.b
}

// Material factory per mutation.
const cache = new Map()
const rainbowMats = []
function materialFor(color, mutation, opts = {}) {
  const key = `${color}|${mutation ?? ''}|${opts.emissive ?? ''}`
  let m = cache.get(key)
  if (m) return m
  const base = { roughness: 0.65, metalness: 0, normalMap: studNormal(), normalScale: new Vector2(0.45, 0.45) }
  if (mutation === 'golden') {
    const l = lum(color)
    m = new MeshStandardMaterial({ ...base, color: new Color().setHSL(0.12, 0.85, 0.28 + l * 0.42), metalness: 0.85, roughness: 0.28 })
  } else if (mutation === 'rainbow') {
    m = new MeshStandardMaterial({ ...base, color: new Color(color), emissive: new Color('#000') })
    m.userData.lum = lum(color)
    m.userData.phase = Math.random()
    rainbowMats.push(m)
  } else if (mutation === 'diamond') {
    const l = lum(color)
    m = new MeshStandardMaterial({ ...base, color: new Color().setHSL(0.52, 0.75, 0.5 + l * 0.35), emissive: new Color('#5fe6ff'), emissiveIntensity: 0.22, metalness: 0.35, roughness: 0.12 })
  } else if (mutation === 'void') {
    const l = lum(color)
    m = new MeshStandardMaterial({ ...base, color: new Color().setHSL(0.76, 0.6, 0.06 + l * 0.18), emissive: new Color('#7a2aff'), emissiveIntensity: 0.35 + (1 - l) * 0.25, roughness: 0.4 })
  } else if (mutation === 'shiny') {
    m = new MeshStandardMaterial({ ...base, color: new Color(color).lerp(new Color('#fffbe0'), 0.25), emissive: new Color('#fff3a0'), emissiveIntensity: 0.18, roughness: 0.35 })
  } else {
    m = new MeshStandardMaterial({ ...base, color })
  }
  if (opts.emissive) {
    m.emissive = new Color(opts.emissive)
    m.emissiveIntensity = 1
  }
  cache.set(key, m)
  return m
}

// Rainbow animals cycle hue together (cheap: a handful of shared materials).
export function tickMutations(t) {
  for (const m of rainbowMats) {
    const h = (t * 0.25 + m.userData.phase * 0.2) % 1
    m.color.setHSL(h, 0.85, 0.35 + m.userData.lum * 0.3)
    m.emissive.setHSL(h, 0.9, 0.12)
  }
}

class Builder {
  constructor(mutation, recolor = null) {
    this.mutation = mutation
    this.recolor = recolor
    this.root = new Group()
    this.pose = new Group()
    this.root.add(this.pose)
    this.legs = []
    this.wings = []
    this.eyesOpen = []
    this.eyesClosed = []
    this.head = null
    this.tail = null
  }
  m(color, opts) {
    // Eyes stay black/white whatever the mutation.
    if (opts?.keep) return materialFor(color, null)
    return materialFor(this.recolor?.[color] ?? color, this.mutation, opts)
  }
  box(parent, w, h, d, color, x, y, z, opts = {}) {
    const mesh = new Mesh(opts.round ? rboxGeo(w, h, d, opts.round) : boxGeo(w, h, d, 0.22), this.m(color, opts))
    mesh.position.set(x, y, z)
    if (opts.rx) mesh.rotation.x = opts.rx
    if (opts.ry) mesh.rotation.y = opts.ry
    if (opts.rz) mesh.rotation.z = opts.rz
    mesh.castShadow = opts.shadow !== false
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }
  pivot(parent, x, y, z) {
    const g = new Group()
    g.position.set(x, y, z)
    parent.add(g)
    return g
  }
  // Leg hanging from a hip pivot at (x, y, z): length y.
  leg(x, y, z, w, color, foot = null, footColor = null) {
    const p = this.pivot(this.pose, x, y, z)
    this.box(p, w, y, w, color, 0, -y / 2, 0)
    if (foot) this.box(p, foot[0], foot[1], foot[2], footColor ?? color, 0, -y + foot[1] / 2, foot[2] * 0.25)
    this.legs.push(p)
    return p
  }
  // Pair of eyes on a head-local face plane at z, spaced sx apart at height y.
  eyes(head, sx, y, z, size = 0.12, angry = false) {
    for (const s of [-1, 1]) {
      this.eyesOpen.push(this.box(head, size, size * 1.15, 0.04, '#101014', s * sx, y, z, { keep: true, shadow: false }))
      this.eyesOpen.push(this.box(head, size * 0.4, size * 0.4, 0.045, '#ffffff', s * sx + size * 0.18, y + size * 0.22, z + 0.005, { keep: true, shadow: false }))
      const closed = this.box(head, size * 1.2, size * 0.22, 0.04, '#101014', s * sx, y - size * 0.1, z, { keep: true, shadow: false })
      closed.visible = false
      this.eyesClosed.push(closed)
      if (angry) this.eyesOpen.push(this.box(head, size * 1.3, size * 0.25, 0.04, '#101014', s * sx, y + size * 0.85, z, { keep: true, shadow: false, rz: s * 0.35 }))
    }
  }
  done(height, centerY) {
    this.root.userData.rig = {
      pose: this.pose,
      head: this.head,
      legs: this.legs,
      wings: this.wings,
      tail: this.tail,
      eyesOpen: this.eyesOpen,
      eyesClosed: this.eyesClosed,
      height,
      centerY,
    }
    return this.root
  }
}

// --- Species ---------------------------------------------------------------------------------
function chicken(b, rooster = Math.random() < 0.45) {
  const white = rooster ? '#e8642c' : '#f6f4ef'
  const wing = rooster ? '#c9471e' : '#e7e3da'
  b.box(b.pose, 0.62, 0.55, 0.78, white, 0, 0.6, 0, { round: 0.08 })
  b.box(b.pose, 0.5, 0.2, 0.5, rooster ? '#f0a52a' : '#ffffff', 0, 0.42, 0.08) // belly
  const head = (b.head = b.pivot(b.pose, 0, 0.85, 0.28))
  b.box(head, 0.4, 0.42, 0.38, white, 0, 0.2, 0.06)
  b.box(head, 0.16, 0.11, 0.18, '#ffb21a', 0, 0.17, 0.32) // beak
  b.box(head, 0.1, 0.16, 0.08, '#e3262e', 0, 0.02, 0.27) // wattle
  b.box(head, 0.1, rooster ? 0.24 : 0.16, 0.3, '#e3262e', 0, 0.47, 0.04) // comb
  b.eyes(head, 0.13, 0.27, 0.255, 0.09)
  for (const s of [-1, 1]) {
    const w = b.pivot(b.pose, s * 0.32, 0.78, 0.02)
    b.box(w, 0.08, 0.36, 0.55, wing, s * 0.03, -0.14, -0.02)
    b.wings.push(w)
  }
  const tail = (b.tail = b.pivot(b.pose, 0, 0.75, -0.36))
  b.box(tail, 0.36, 0.42, 0.14, rooster ? '#1f5a3c' : white, 0, 0.18, -0.04, { rx: -0.4 })
  if (rooster) b.box(tail, 0.2, 0.5, 0.1, '#2b9a6a', 0, 0.32, -0.12, { rx: -0.7 })
  for (const s of [-1, 1]) b.leg(s * 0.15, 0.36, 0.02, 0.07, '#ffb21a', [0.18, 0.05, 0.22])
  return b.done(1.3, 0.62)
}

function rabbit(b) {
  const fur = Math.random() < 0.5 ? '#3e4a6b' : '#b8b2a8'
  b.box(b.pose, 0.52, 0.5, 0.62, fur, 0, 0.42, -0.04, { round: 0.1 })
  b.box(b.pose, 0.4, 0.34, 0.1, '#f2f2f2', 0, 0.42, 0.25) // chest
  b.box(b.pose, 0.18, 0.18, 0.12, '#ffffff', 0, 0.5, -0.38) // tail puff
  const head = (b.head = b.pivot(b.pose, 0, 0.66, 0.2))
  b.box(head, 0.46, 0.42, 0.4, fur, 0, 0.18, 0.04)
  b.box(head, 0.22, 0.12, 0.08, '#f2f2f2', 0, 0.06, 0.25)
  b.box(head, 0.08, 0.07, 0.04, '#ff8fb0', 0, 0.12, 0.28)
  for (const s of [-1, 1]) {
    const ear = b.pivot(head, s * 0.12, 0.38, 0)
    b.box(ear, 0.12, 0.5, 0.08, fur, 0, 0.25, 0, { rz: s * -0.15 })
    b.box(ear, 0.06, 0.38, 0.02, '#ff8fb0', s * 0.006, 0.26, 0.045, { rz: s * -0.15 })
  }
  b.box(head, 0.5, 0.1, 0.44, '#d8262e', 0, -0.04, 0.02) // scarf
  b.eyes(head, 0.11, 0.24, 0.245, 0.1)
  for (const [x, z, l] of [[-0.16, 0.18, 0.22], [0.16, 0.18, 0.22], [-0.17, -0.2, 0.2], [0.17, -0.2, 0.2]]) b.leg(x, l, z, 0.13, '#f2f2f2', [0.15, 0.06, 0.22])
  b.root.userData.hops = true
  return b.done(1.2, 0.5)
}

function turkey(b) {
  const brown = '#6b3d1f'
  b.box(b.pose, 0.7, 0.65, 0.85, brown, 0, 0.72, 0, { round: 0.1 })
  b.box(b.pose, 0.5, 0.3, 0.4, '#4a2810', 0, 0.48, 0.2)
  const head = (b.head = b.pivot(b.pose, 0, 1.0, 0.38))
  b.box(head, 0.14, 0.4, 0.14, '#5fb0e8', 0, 0.15, 0)
  b.box(head, 0.3, 0.3, 0.3, '#5fb0e8', 0, 0.45, 0.04)
  b.box(head, 0.12, 0.08, 0.14, '#ffc23a', 0, 0.44, 0.24)
  b.box(head, 0.08, 0.22, 0.06, '#e3262e', 0.05, 0.3, 0.2)
  b.eyes(head, 0.09, 0.52, 0.195, 0.07, true)
  const tail = (b.tail = b.pivot(b.pose, 0, 0.85, -0.38))
  const fan = ['#2a8fa8', '#f08a2a', '#6b3d1f', '#2a8fa8', '#f08a2a']
  for (let i = 0; i < 9; i++) {
    const a = (i / 8 - 0.5) * 2.4
    b.box(tail, 0.2, 0.8, 0.06, fan[i % fan.length], Math.sin(a) * 0.45, 0.3 + Math.cos(a) * 0.38, -0.02 - Math.abs(Math.sin(a)) * 0.04, { rz: -a })
  }
  for (const s of [-1, 1]) {
    const w = b.pivot(b.pose, s * 0.36, 0.86, 0)
    b.box(w, 0.08, 0.44, 0.62, '#5a3016', s * 0.02, -0.15, -0.02)
    b.wings.push(w)
  }
  for (const s of [-1, 1]) b.leg(s * 0.17, 0.42, 0, 0.08, '#e89a3a', [0.2, 0.05, 0.24])
  return b.done(1.5, 0.75)
}

function goat(b) {
  const white = '#f0efea'
  b.box(b.pose, 0.7, 0.62, 1.15, white, 0, 0.92, 0, { round: 0.08 })
  b.box(b.pose, 0.3, 0.12, 0.2, white, 0, 1.1, -0.62, { rx: -0.6 }) // tail
  const head = (b.head = b.pivot(b.pose, 0, 1.15, 0.55))
  b.box(head, 0.28, 0.4, 0.3, white, 0, 0.05, 0.02, { rx: 0.4 }) // neck
  b.box(head, 0.42, 0.42, 0.52, white, 0, 0.3, 0.22)
  b.box(head, 0.3, 0.24, 0.2, '#e6dccf', 0, 0.2, 0.52)
  b.box(head, 0.12, 0.22, 0.1, '#cfc4b4', 0, -0.02, 0.44) // beard
  for (const s of [-1, 1]) {
    b.box(head, 0.12, 0.42, 0.12, '#7a6a58', s * 0.13, 0.66, 0.06, { rx: -0.6 })
    b.box(head, 0.11, 0.3, 0.11, '#6a5a48', s * 0.13, 0.84, -0.18, { rx: -1.4 })
    b.box(head, 0.24, 0.1, 0.12, white, s * 0.28, 0.42, 0.14, { rz: s * -0.3 })
  }
  b.eyes(head, 0.15, 0.38, 0.485, 0.08, true)
  for (const [x, z] of [[-0.22, 0.4], [0.22, 0.4], [-0.22, -0.4], [0.22, -0.4]]) b.leg(x, 0.62, z, 0.16, white, [0.17, 0.1, 0.18], '#5a4a3a')
  return b.done(1.6, 0.95)
}

function sheep(b) {
  b.box(b.pose, 0.95, 0.8, 1.25, '#fbfbf6', 0, 0.95, 0, { round: 0.22 })
  b.box(b.pose, 0.75, 0.3, 0.7, '#ffffff', 0, 1.42, -0.05, { round: 0.12 })
  const head = (b.head = b.pivot(b.pose, 0, 1.1, 0.62))
  b.box(head, 0.4, 0.44, 0.42, '#2c2c30', 0, 0.12, 0.12)
  b.box(head, 0.5, 0.2, 0.34, '#ffffff', 0, 0.38, 0.06, { round: 0.06 })
  for (const s of [-1, 1]) b.box(head, 0.24, 0.1, 0.12, '#2c2c30', s * 0.3, 0.18, 0.06, { rz: s * 0.3 })
  b.eyes(head, 0.11, 0.18, 0.335, 0.08)
  for (const [x, z] of [[-0.28, 0.38], [0.28, 0.38], [-0.28, -0.4], [0.28, -0.4]]) b.leg(x, 0.6, z, 0.15, '#2c2c30')
  return b.done(1.6, 0.95)
}

function pig(b) {
  const pink = '#f6a6b6'
  b.box(b.pose, 0.85, 0.72, 1.15, pink, 0, 0.72, 0, { round: 0.14 })
  const head = (b.head = b.pivot(b.pose, 0, 0.8, 0.55))
  b.box(head, 0.62, 0.56, 0.42, pink, 0, 0.08, 0.16)
  b.box(head, 0.32, 0.22, 0.12, '#f08aa0', 0, 0.0, 0.42)
  for (const s of [-1, 1]) {
    b.box(head, 0.06, 0.08, 0.02, '#a8405a', s * 0.07, 0.0, 0.485, { shadow: false })
    b.box(head, 0.2, 0.2, 0.08, '#f08aa0', s * 0.24, 0.42, 0.1, { rx: 0.5 })
  }
  b.eyes(head, 0.16, 0.2, 0.375, 0.08)
  const tail = (b.tail = b.pivot(b.pose, 0, 0.9, -0.58))
  b.box(tail, 0.08, 0.08, 0.2, '#f08aa0', 0, 0.04, -0.06, { rx: -0.8 })
  b.box(tail, 0.08, 0.14, 0.08, '#f08aa0', 0.05, 0.14, -0.12)
  for (const [x, z] of [[-0.26, 0.36], [0.26, 0.36], [-0.26, -0.36], [0.26, -0.36]]) b.leg(x, 0.4, z, 0.18, pink, [0.19, 0.08, 0.2], '#8a4a5a')
  return b.done(1.3, 0.75)
}

function cow(b) {
  const white = '#f6f6f2'
  b.box(b.pose, 1.05, 0.95, 1.7, white, 0, 1.25, 0, { round: 0.1 })
  for (const [x, y, z, w, h, d] of [[0.53, 1.35, 0.2, 0.04, 0.5, 0.6], [-0.53, 1.2, -0.35, 0.04, 0.55, 0.5], [0.2, 1.73, -0.3, 0.5, 0.04, 0.6], [-0.53, 1.45, 0.45, 0.04, 0.3, 0.3]]) b.box(b.pose, w, h, d, '#1f1f24', x, y, z)
  b.box(b.pose, 0.4, 0.2, 0.36, '#ffb3c4', 0, 0.72, -0.42) // udder
  const head = (b.head = b.pivot(b.pose, 0, 1.45, 0.82))
  b.box(head, 0.6, 0.6, 0.58, white, 0, 0.05, 0.22)
  b.box(head, 0.52, 0.28, 0.2, '#ffb3c4', 0, -0.08, 0.56)
  b.box(head, 0.3, 0.2, 0.04, '#1f1f24', -0.1, 0.22, 0.52)
  for (const s of [-1, 1]) {
    b.box(head, 0.1, 0.2, 0.1, '#f0e6c8', s * 0.24, 0.42, 0.18, { rz: s * -0.4 })
    b.box(head, 0.26, 0.12, 0.14, white, s * 0.38, 0.2, 0.16)
    b.box(head, 0.05, 0.06, 0.02, '#6a3a4a', s * 0.11, -0.1, 0.665, { shadow: false })
  }
  b.eyes(head, 0.17, 0.18, 0.515, 0.1, true)
  const tail = (b.tail = b.pivot(b.pose, 0, 1.6, -0.86))
  b.box(tail, 0.08, 0.7, 0.08, white, 0, -0.35, -0.04)
  b.box(tail, 0.14, 0.18, 0.14, '#1f1f24', 0, -0.72, -0.04)
  for (const [x, z] of [[-0.34, 0.6], [0.34, 0.6], [-0.34, -0.6], [0.34, -0.6]]) b.leg(x, 0.78, z, 0.24, white, [0.25, 0.14, 0.26], '#3a3030')
  return b.done(2.2, 1.25)
}

function deer(b) {
  const brown = '#b9733a'
  b.box(b.pose, 0.66, 0.66, 1.3, brown, 0, 1.35, 0, { round: 0.1 })
  b.box(b.pose, 0.5, 0.2, 0.9, '#f3dfc0', 0, 1.06, 0) // belly
  for (let i = 0; i < 5; i++) b.box(b.pose, 0.08, 0.02, 0.08, '#f8ecd8', (i % 2 ? 0.15 : -0.12), 1.69, -0.4 + i * 0.18, { shadow: false })
  b.tail = b.pivot(b.pose, 0, 1.55, -0.66)
  b.box(b.tail, 0.18, 0.24, 0.1, '#ffffff', 0, -0.06, -0.02)
  const head = (b.head = b.pivot(b.pose, 0, 1.6, 0.55))
  b.box(head, 0.28, 0.6, 0.3, brown, 0, 0.25, 0.06, { rx: 0.35 })
  b.box(head, 0.38, 0.36, 0.5, brown, 0, 0.6, 0.24)
  b.box(head, 0.22, 0.18, 0.14, '#2a1a10', 0, 0.56, 0.52)
  b.box(head, 0.24, 0.12, 0.3, '#f3dfc0', 0, 0.44, 0.3)
  for (const s of [-1, 1]) {
    b.box(head, 0.26, 0.12, 0.08, brown, s * 0.27, 0.78, 0.16, { rz: s * -0.5 })
    const a = b.pivot(head, s * 0.1, 0.8, 0.14)
    b.box(a, 0.07, 0.6, 0.07, '#e9d6a6', s * 0.12, 0.28, 0, { rz: s * -0.5 })
    b.box(a, 0.06, 0.3, 0.06, '#e9d6a6', s * 0.18, 0.5, 0.1, { rx: 0.5 })
    b.box(a, 0.06, 0.32, 0.06, '#e9d6a6', s * 0.3, 0.56, -0.06, { rz: s * 0.2 })
  }
  b.eyes(head, 0.13, 0.66, 0.495, 0.08)
  for (const [x, z] of [[-0.22, 0.48], [0.22, 0.48], [-0.22, -0.48], [0.22, -0.48]]) b.leg(x, 1.02, z, 0.12, brown, [0.13, 0.1, 0.14], '#2a1a10')
  return b.done(2.4, 1.35)
}

function fox(b) {
  const orange = '#f0761e'
  b.box(b.pose, 0.5, 0.48, 1.0, orange, 0, 0.66, 0, { round: 0.08 })
  b.box(b.pose, 0.36, 0.3, 0.3, '#ffffff', 0, 0.58, 0.38)
  const tail = (b.tail = b.pivot(b.pose, 0, 0.78, -0.5))
  b.box(tail, 0.32, 0.32, 0.74, orange, 0, 0.02, -0.34, { rx: 0.3, round: 0.1 })
  b.box(tail, 0.3, 0.3, 0.22, '#ffffff', 0, -0.08, -0.72, { rx: 0.3 })
  const head = (b.head = b.pivot(b.pose, 0, 0.9, 0.48))
  b.box(head, 0.46, 0.4, 0.4, orange, 0, 0.1, 0.06)
  b.box(head, 0.24, 0.18, 0.26, '#ffffff', 0, 0.0, 0.32)
  b.box(head, 0.1, 0.08, 0.06, '#151515', 0, 0.06, 0.46)
  for (const s of [-1, 1]) {
    b.box(head, 0.16, 0.24, 0.08, orange, s * 0.15, 0.4, 0.02)
    b.box(head, 0.08, 0.12, 0.02, '#2a1a10', s * 0.15, 0.4, 0.065)
  }
  b.eyes(head, 0.12, 0.2, 0.265, 0.08, true)
  for (const [x, z] of [[-0.16, 0.34], [0.16, 0.34], [-0.16, -0.34], [0.16, -0.34]]) b.leg(x, 0.44, z, 0.12, '#2a1a10')
  return b.done(1.3, 0.65)
}

function heron(b) {
  const grey = '#9aa3b0'
  b.box(b.pose, 0.5, 0.5, 0.8, grey, 0, 1.2, -0.05, { round: 0.1 })
  b.box(b.pose, 0.36, 0.3, 0.3, '#e9edf2', 0, 1.1, 0.3)
  const head = (b.head = b.pivot(b.pose, 0, 1.4, 0.3))
  b.box(head, 0.14, 0.6, 0.14, '#e9edf2', 0, 0.3, 0.06, { rx: 0.25 })
  b.box(head, 0.26, 0.24, 0.32, '#e9edf2', 0, 0.66, 0.2)
  b.box(head, 0.1, 0.08, 0.5, '#f2c12a', 0, 0.62, 0.58)
  b.box(head, 0.06, 0.08, 0.36, '#1d1d24', 0, 0.8, -0.1, { rx: 0.4 }) // crest
  b.eyes(head, 0.1, 0.7, 0.365, 0.06)
  for (const s of [-1, 1]) {
    const w = b.pivot(b.pose, s * 0.27, 1.38, 0)
    b.box(w, 0.06, 0.4, 0.78, '#7d8796', s * 0.02, -0.15, -0.08)
    b.wings.push(w)
  }
  b.tail = b.pivot(b.pose, 0, 1.15, -0.45)
  b.box(b.tail, 0.36, 0.1, 0.3, '#5d6574', 0, 0, -0.1)
  for (const s of [-1, 1]) b.leg(s * 0.12, 0.98, 0, 0.06, '#d8b44a', [0.18, 0.04, 0.26])
  return b.done(2.2, 1.2)
}

function boar(b) {
  const dark = '#5a3a26'
  b.box(b.pose, 1.0, 0.95, 1.5, dark, 0, 1.0, 0, { round: 0.14 })
  for (let i = 0; i < 6; i++) b.box(b.pose, 0.16, 0.3, 0.2, '#2e1d12', 0, 1.55, 0.5 - i * 0.2, { rx: -0.4 }) // bristles
  const head = (b.head = b.pivot(b.pose, 0, 1.05, 0.72))
  b.box(head, 0.78, 0.7, 0.62, dark, 0, 0.08, 0.2)
  b.box(head, 0.42, 0.32, 0.22, '#c98a74', 0, -0.06, 0.6)
  for (const s of [-1, 1]) {
    b.box(head, 0.09, 0.32, 0.09, '#fff6dc', s * 0.25, 0.04, 0.6, { rz: s * 0.4 })
    b.box(head, 0.2, 0.26, 0.1, '#3e271a', s * 0.3, 0.5, 0.16, { rx: 0.4 })
  }
  b.eyes(head, 0.2, 0.24, 0.515, 0.1, true)
  b.tail = b.pivot(b.pose, 0, 1.2, -0.76)
  b.box(b.tail, 0.08, 0.36, 0.08, dark, 0, -0.16, -0.02)
  for (const [x, z] of [[-0.3, 0.5], [0.3, 0.5], [-0.3, -0.5], [0.3, -0.5]]) b.leg(x, 0.55, z, 0.22, dark, [0.23, 0.1, 0.24], '#20140c')
  return b.done(1.9, 1.0)
}

const BUILDERS = { chicken, rabbit, turkey, goat, sheep, pig, cow, deer, fox, heron, boar }

// species: an ANIMALS id (its `model` body, `recolor` palette and `scale`).
export function buildAnimal(species, mutation = null) {
  const def = ANIMALS[species]
  const b = new Builder(mutation, def?.recolor)
  const model = (BUILDERS[def?.model ?? species] ?? chicken)(b)
  const k = def?.scale ?? 1
  if (k !== 1) {
    model.scale.setScalar(k)
    model.userData.rig.height *= k
    model.userData.rig.centerY *= k
  }
  model.userData.species = species
  return model
}
