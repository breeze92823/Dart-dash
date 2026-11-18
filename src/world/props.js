// Prop builders. Each returns a Group positioned at (x, y, z) in its parent;
// static ones are later baked (bake.js) into a few draw calls per area.
import {
  AdditiveBlending,
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RingGeometry,
  ShaderMaterial,
  TorusGeometry,
  OctahedronGeometry,
  Color,
} from 'three'
import { block, boxGeo, canvasTexture, mat, projectUVs, rboxGeo, signText, wedgeGeo } from './kit.js'
import { bake } from '../bake.js'

const rnd = (a, b) => a + Math.random() * (b - a)

function group(parent, x, y, z, ry = 0) {
  const g = new Group()
  g.position.set(x, y, z)
  g.rotation.y = ry
  parent?.add(g)
  return g
}

// --- Nature ------------------------------------------------------------------------------
const LEAF = ['#3fd43a', '#35c932', '#47de44']
// Round-canopy tree: trunk with root blocks, three rounded canopy tiers.
export function tree(parent, x, y, z, s = 1, leaf = null) {
  const g = group(parent, x, y, z, rnd(0, Math.PI))
  const trunk = '#8a5a2e'
  block(g, 0.9 * s, 4.2 * s, 0.9 * s, trunk, 0, 2.1 * s, 0)
  for (const [dx, dz] of [[0.55, 0], [-0.55, 0], [0, 0.55], [0, -0.55]]) block(g, 0.5 * s, 0.45 * s, 0.5 * s, '#6e4421', dx * s, 0.22 * s, dz * s)
  block(g, 1.4 * s, 0.3 * s, 0.3 * s, trunk, 0.5 * s, 3.4 * s, 0, { rz: 0.6 }) // a branch
  const c = leaf ?? LEAF[Math.floor(Math.random() * LEAF.length)]
  const tiers = [[5.2, 1.5, 4.2], [4.3, 1.3, 5.5], [3.1, 1.1, 6.6]]
  for (const [w, h, cy] of tiers) {
    const m = new Mesh(rboxGeo(w * s, h * s, w * s * 0.92, 0.32 * s), mat(c, { rough: 0.85 }))
    m.position.y = cy * s
    m.castShadow = m.receiveShadow = true
    g.add(m)
  }
  g.userData.radius = 0.6 * s
  return g
}

// Pine: stacked four-sided pyramids.
export function pine(parent, x, y, z, s = 1) {
  const g = group(parent, x, y, z, rnd(0, Math.PI))
  block(g, 0.6 * s, 2 * s, 0.6 * s, '#6b4524', 0, 1 * s, 0)
  const green = Math.random() < 0.5 ? '#1e9a3c' : '#22a845'
  const tiers = [[2.6, 2.4, 2.6], [2.1, 2.2, 4.2], [1.5, 2, 5.7]]
  for (const [r, h, cy] of tiers) {
    const cone = new Mesh(projectUVs(new ConeGeometry(r * s, h * s, 4, 1)), mat(green, { rough: 0.85 }))
    cone.rotation.y = Math.PI / 4
    cone.position.y = cy * s
    cone.castShadow = cone.receiveShadow = true
    g.add(cone)
  }
  g.userData.radius = 0.5 * s
  return g
}

export function hayBale(parent, x, y, z, stack = 1) {
  const g = group(parent, x, y, z, rnd(-0.4, 0.4))
  for (let i = 0; i < stack; i++) {
    const oy = i * 1.1
    const ox = i ? rnd(-0.25, 0.25) : 0
    const r = i ? rnd(-0.3, 0.3) : 0
    const b = block(g, 1.8, 1.1, 1.2, '#f2cf3d', ox, 0.55 + oy, 0, { ry: r, rough: 0.95 })
    for (const sx of [-0.45, 0.45]) {
      const strap = block(b, 0.1, 1.14, 1.24, '#c8322c', sx, 0, 0, { rough: 0.8 })
      strap.castShadow = false
    }
  }
  g.userData.radius = 1.1
  return g
}

export function whiteFence(parent, x, y, z, ry = 0, len = 3.2) {
  const g = group(parent, x, y, z, ry)
  const white = '#f2f4f7'
  const posts = Math.max(2, Math.round(len / 1.5) + 1)
  for (let i = 0; i < posts; i++) block(g, 0.22, 1.25, 0.22, white, -len / 2 + (i * len) / (posts - 1), 0.62, 0)
  block(g, len, 0.18, 0.12, white, 0, 0.95, 0)
  block(g, len, 0.18, 0.12, white, 0, 0.5, 0)
  g.userData.radius = len / 2
  return g
}

export function flower(parent, x, y, z) {
  const g = group(parent, x, y, z, rnd(0, 6))
  block(g, 0.7, 0.12, 0.7, '#3cc63a', 0, 0.06, 0, { shadow: false })
  const petal = Math.random() < 0.5 ? '#ff8fc8' : '#ffe766'
  for (let i = 0; i < 2; i++) {
    const ox = rnd(-0.18, 0.18)
    const oz = rnd(-0.18, 0.18)
    block(g, 0.06, 0.45, 0.06, '#2e9d2c', ox, 0.32, oz, { shadow: false })
    block(g, 0.22, 0.1, 0.22, petal, ox, 0.58, oz, { shadow: false })
    block(g, 0.08, 0.11, 0.08, '#fff6a0', ox, 0.6, oz, { shadow: false })
  }
  return g
}

export function grassTuft(parent, x, y, z) {
  const g = group(parent, x, y, z, rnd(0, 6))
  for (let i = 0; i < 4; i++) block(g, 0.08, rnd(0.35, 0.7), 0.08, '#2fbf35', rnd(-0.2, 0.2), 0.25, rnd(-0.2, 0.2), { rz: rnd(-0.3, 0.3), shadow: false })
  return g
}

export function bush(parent, x, y, z, s = 1) {
  const g = group(parent, x, y, z, rnd(0, 6))
  const m = new Mesh(rboxGeo(2.4 * s, 1.3 * s, 2 * s, 0.3 * s), mat('#2fc23a', { rough: 0.85 }))
  m.position.y = 0.65 * s
  m.castShadow = m.receiveShadow = true
  g.add(m)
  const top = new Mesh(rboxGeo(1.6 * s, 0.8 * s, 1.4 * s, 0.25 * s), mat('#38cf42', { rough: 0.85 }))
  top.position.set(0.2 * s, 1.45 * s, 0)
  top.castShadow = true
  g.add(top)
  for (let i = 0; i < 4; i++) block(g, 0.22, 0.22, 0.22, '#e8338a', rnd(-1, 1) * s, rnd(0.6, 1.4) * s, (Math.random() < 0.5 ? -1 : 1) * 1.02 * s, { shadow: false })
  g.userData.radius = 1.1 * s
  return g
}

export function cattails(parent, x, y, z) {
  const g = group(parent, x, y, z, rnd(0, 6))
  for (let i = 0; i < 5; i++) {
    const h = rnd(1.2, 2.2)
    const ox = rnd(-0.35, 0.35)
    const oz = rnd(-0.35, 0.35)
    const rz = rnd(-0.12, 0.12)
    block(g, 0.07, h, 0.07, '#4caf3a', ox, h / 2, oz, { rz, shadow: false })
    if (i < 3) block(g, 0.16, 0.42, 0.16, '#7a3f1d', ox - Math.sin(rz) * h, h + 0.1, oz, { shadow: false })
    else block(g, 0.18, h * 0.8, 0.04, '#5cc84a', ox + 0.1, h * 0.4, oz, { rz: rz * 2, shadow: false })
  }
  return g
}

export function rock(parent, x, y, z, s = 1) {
  const g = group(parent, x, y, z, rnd(0, 6))
  block(g, 1.4 * s, 0.8 * s, 1.1 * s, '#9aa1ab', 0, 0.35 * s, 0, { round: 0.18 * s })
  block(g, 0.8 * s, 0.6 * s, 0.7 * s, '#b4bac2', 0.3 * s, 0.75 * s, 0.1 * s, { round: 0.14 * s })
  g.userData.radius = 0.8 * s
  return g
}

// Low grassy mound (the yellow-green patches in the lane): a flat-topped ramp both ways.
export function mound(parent, x, y, z, w, d, h, ry = 0) {
  const g = group(parent, x, y, z, ry)
  const top = mat('#c4e04a', { rough: 0.9 })
  const side = mat('#b2d43c', { rough: 0.9 })
  const flat = new Mesh(boxGeo(w, h, d * 0.5), top)
  flat.position.y = h / 2
  flat.receiveShadow = true
  g.add(flat)
  for (const dir of [-1, 1]) {
    const r = new Mesh(wedgeGeo(w, h, d * 0.25), side)
    r.position.z = dir * d * 0.375
    r.rotation.y = dir > 0 ? 0 : Math.PI
    r.receiveShadow = true
    g.add(r)
  }
  return g
}

// --- Water -----------------------------------------------------------------------------------
export function pond(parent, x, y, z, r) {
  const g = group(parent, x, y, z)
  const rim = new Mesh(new CircleGeometry(r + 1.6, 40), mat('#d9c48e', { rough: 1, studs: false }))
  rim.rotation.x = -Math.PI / 2
  rim.position.y = 0.04
  rim.receiveShadow = true
  const water = new Mesh(
    new CircleGeometry(r, 40),
    new MeshStandardMaterial({ color: '#2fb8ea', roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.92 }),
  )
  water.rotation.x = -Math.PI / 2
  water.position.y = 0.1
  water.receiveShadow = true
  g.add(rim, water)
  // Lily pads.
  for (let i = 0; i < 6; i++) {
    const a = rnd(0, Math.PI * 2)
    const rr = rnd(0.3, 0.8) * r
    const pad = new Mesh(new CircleGeometry(rnd(0.5, 0.8), 10), mat('#3fbf4a', { studs: false }))
    pad.rotation.x = -Math.PI / 2
    pad.position.set(Math.cos(a) * rr, 0.13, Math.sin(a) * rr)
    g.add(pad)
  }
  g.userData.water = water
  return g
}

// --- Hub pieces -------------------------------------------------------------------------------
// Glowing floor disc in front of a shop: stepping on it opens the shop.
export function glowDisc(parent, x, y, z, color, r = 3.2) {
  const g = group(parent, x, y, z)
  const disc = new Mesh(new CircleGeometry(r, 48), new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, roughness: 0.5, transparent: true, opacity: 0.85 }))
  disc.rotation.x = -Math.PI / 2
  disc.position.y = 0.03
  disc.receiveShadow = true
  const ring = new Mesh(new RingGeometry(r * 0.96, r * 1.06, 48), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false }))
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.05
  g.add(disc, ring)
  g.userData.disc = disc
  g.userData.ring = ring
  return g
}

// Market stall: wooden posts, a counter and a striped, sloped awning.
export function stall(parent, x, y, z, ry, stripe, base = '#ffffff') {
  const g = group(parent, x, y, z, ry)
  const wood = '#c98a4b'
  const dark = '#a86e36'
  for (const sx of [-2.4, 2.4]) {
    block(g, 0.28, 3.6, 0.28, wood, sx, 1.8, -1.2)
    block(g, 0.28, 3.1, 0.28, wood, sx, 1.55, 1.2)
  }
  block(g, 5.2, 0.25, 2.2, wood, 0, 1.2, 0) // counter top
  block(g, 5, 0.18, 2, dark, 0, 0.45, 0) // shelf
  block(g, 5.2, 0.9, 0.12, dark, 0, 0.75, 1.15) // front panel
  // Awning: 8 alternating slats, tilted down toward the front.
  const slats = 8
  const w = 5.8 / slats
  const awn = new Group()
  awn.position.set(0, 3.45, 0)
  awn.rotation.x = 0.32
  g.add(awn)
  for (let i = 0; i < slats; i++) {
    block(awn, w, 0.16, 3.4, i % 2 ? base : stripe, -2.9 + w * (i + 0.5), 0, 0)
    block(awn, w, 0.5, 0.1, i % 2 ? base : stripe, -2.9 + w * (i + 0.5), -0.25, 1.7) // valance
  }
  return g
}

// Wooden cross-braced fence panel (the pen). len along x.
export function penFence(parent, x, y, z, ry, len) {
  const g = group(parent, x, y, z, ry)
  const plank = '#d9792e'
  const post = '#4a4d55'
  const posts = Math.max(2, Math.round(len / 3.2) + 1)
  const step = len / (posts - 1)
  for (let i = 0; i < posts; i++) block(g, 0.42, 1.9, 0.42, post, -len / 2 + i * step, 0.95, 0)
  block(g, len, 0.22, 0.2, plank, 0, 1.6, 0)
  block(g, len, 0.22, 0.2, plank, 0, 0.35, 0)
  for (let i = 0; i < posts - 1; i++) {
    const cx = -len / 2 + (i + 0.5) * step
    const diag = Math.hypot(step - 0.4, 1.1)
    const ang = Math.atan2(1.1, step - 0.4)
    block(g, diag, 0.16, 0.16, plank, cx, 0.98, 0.02, { rz: ang })
    block(g, diag, 0.16, 0.16, plank, cx, 0.98, -0.02, { rz: -ang })
  }
  return g
}

// Navy sign on two dark posts; `tex` is a canvas texture (front face).
export function blueSign(parent, x, y, z, ry, w, h, tex, lift = 1.3) {
  const g = group(parent, x, y, z, ry)
  for (const sx of [-w * 0.3, w * 0.3]) block(g, 0.3, lift + h * 0.5, 0.3, '#262a3d', sx, (lift + h * 0.5) / 2, -0.1)
  const side = mat('#1d2a6b', { studs: false })
  const board = new Mesh(new BoxGeometry(w, h, 0.3), [side, side, side, side, new MeshStandardMaterial({ map: tex, roughness: 0.6 }), side])
  board.position.y = lift + h / 2
  board.castShadow = board.receiveShadow = true
  g.add(board)
  return g
}

export function giftBox(parent, x, y, z, s = 1) {
  const g = group(parent, x, y, z, rnd(-0.3, 0.3))
  const blue = '#1f8cff'
  const gold = '#ffd02e'
  block(g, 3.4 * s, 2.6 * s, 3.4 * s, blue, 0, 1.3 * s, 0)
  block(g, 3.7 * s, 0.7 * s, 3.7 * s, '#1a7ae6', 0, 2.95 * s, 0)
  block(g, 0.6 * s, 3.35 * s, 3.75 * s, gold, 0, 1.68 * s, 0)
  block(g, 3.75 * s, 3.35 * s, 0.6 * s, gold, 0, 1.68 * s, 0)
  block(g, 1.2 * s, 0.8 * s, 0.5 * s, gold, -0.6 * s, 3.6 * s, 0, { rz: 0.5 })
  block(g, 1.2 * s, 0.8 * s, 0.5 * s, gold, 0.6 * s, 3.6 * s, 0, { rz: -0.5 })
  block(g, 0.5 * s, 0.5 * s, 0.55 * s, '#ffb800', 0, 3.45 * s, 0)
  return g
}

// Treadmill: a gym machine facing -z (you run toward its console). The frame, hood,
// rails, console, LED strips and screen are baked into a few draw calls; the belt
// (its texture scrolls), the two rollers and the fan blades stay live for base.js.
// userData: { belt, rollers, fan, led (material), screen (canvasTexture), rollerR }.
export function treadmill(parent, x, y, z, ry) {
  const g = group(parent, x, y, z, ry)
  const s = new Group() // static parts, baked at the end
  const frame = '#363c4a'
  const dark = '#1f232b'
  const accent = '#ff7a1a'
  const rubber = '#15171c'
  const steelOpt = { metal: 0.65, rough: 0.3, studs: false }
  const led = new MeshStandardMaterial({ color: '#0d1c26', emissive: new Color('#3fe0ff'), emissiveIntensity: 0.6, roughness: 0.4 })

  // Deck: side beams with grippy foot rails, orange trim, LED strips, rubber feet.
  for (const sx of [-1, 1]) {
    block(s, 0.32, 0.3, 4.9, frame, sx * 1.14, 0.2, 0.05, { round: 0.06 })
    block(s, 0.3, 0.05, 4.7, '#8d96a5', sx * 1.14, 0.375, 0.05, { rough: 0.95 })
    for (let i = 0; i < 9; i++) block(s, 0.26, 0.02, 0.07, '#6b7381', sx * 1.14, 0.405, -2.05 + i * 0.52, { studs: false })
    block(s, 0.04, 0.07, 4.4, accent, sx * 1.305, 0.27, 0.05, { studs: false })
    block(s, 0.05, 0.05, 4.5, led, sx * 1.31, 0.13, 0.05, { shadow: false })
    for (const fz of [-2.3, 2.38]) block(s, 0.24, 0.08, 0.24, rubber, sx * 1.14, 0.04, fz, { studs: false })
  }
  block(s, 1.96, 0.24, 4.4, dark, 0, 0.16, 0) // deck under the belt
  // Rear end cap.
  block(s, 2.6, 0.24, 0.24, frame, 0, 0.14, 2.52, { round: 0.06 })
  block(s, 1.6, 0.06, 0.03, accent, 0, 0.18, 2.65, { studs: false })
  // Motor hood: vented top, badge stripe, LED strip, transport wheels.
  block(s, 2.64, 0.6, 0.8, frame, 0, 0.32, -2.72, { round: 0.14 })
  block(s, 2.0, 0.05, 0.5, dark, 0, 0.63, -2.72, { studs: false })
  for (let i = 0; i < 4; i++) block(s, 1.8, 0.03, 0.05, '#4a5262', 0, 0.665, -2.9 + i * 0.12, { studs: false })
  block(s, 1.2, 0.12, 0.03, accent, 0, 0.36, -3.13, { studs: false })
  block(s, 2.0, 0.05, 0.03, led, 0, 0.56, -3.13, { shadow: false })
  for (const sx of [-1, 1]) {
    const w = new Mesh(new CylinderGeometry(0.13, 0.13, 0.12, 14), mat(rubber, { studs: false }))
    w.rotation.z = Math.PI / 2
    w.position.set(sx * 1.0, 0.13, -3.08)
    s.add(w)
  }
  // Uprights, crossbar, handrails with foam grips and heart-rate sensors, a towel.
  for (const sx of [-1, 1]) {
    block(s, 0.18, 1.75, 0.22, frame, sx * 1.12, 1.4, -2.78, { rx: -0.12, round: 0.05 })
    block(s, 0.13, 0.13, 1.55, '#b9c2cf', sx * 1.12, 1.5, -1.98, steelOpt)
    block(s, 0.2, 0.2, 0.62, rubber, sx * 1.12, 1.5, -1.55, { round: 0.08, rough: 1, studs: false })
    block(s, 0.22, 0.1, 0.26, '#d9dee6', sx * 1.12, 1.6, -2.2, steelOpt)
    block(s, 0.16, 0.16, 0.08, accent, sx * 1.12, 1.5, -1.2, { studs: false })
  }
  block(s, 2.4, 0.16, 0.16, frame, 0, 1.5, -2.72)
  block(s, 0.32, 0.04, 0.36, '#ff6fae', -1.12, 1.59, -2.45, { studs: false })
  for (const dx of [-0.14, 0.14]) block(s, 0.04, 0.5, 0.36, '#ff6fae', -1.12 + dx, 1.35, -2.45, { studs: false })
  // Cooling fan under the crossbar: housing ring + grille (static), blades (live).
  const fanY = 1.08
  const fanZ = -2.66
  const ring = new Mesh(new TorusGeometry(0.27, 0.045, 8, 24), mat('#b9c2cf', steelOpt))
  ring.position.set(0, fanY, fanZ)
  s.add(ring)
  block(s, 0.12, 0.16, 0.12, frame, 0, fanY + 0.34, fanZ)
  block(s, 0.54, 0.02, 0.02, '#b9c2cf', 0, fanY, fanZ + 0.06, steelOpt)
  block(s, 0.02, 0.54, 0.02, '#b9c2cf', 0, fanY, fanZ + 0.06, steelOpt)
  const fan = new Group()
  fan.position.set(0, fanY, fanZ)
  g.add(fan)
  for (let i = 0; i < 4; i++) {
    const b = block(fan, 0.11, 0.24, 0.02, '#e9edf2', 0, 0, 0, { studs: false, shadow: false })
    b.geometry = b.geometry.clone().translate(0, 0.12, 0)
    b.rotation.set(0.35, 0, (i * Math.PI) / 2)
  }
  block(fan, 0.1, 0.1, 0.06, accent, 0, 0, 0.02, { studs: false, shadow: false })
  // Console: tilted toward the runner, a live screen, buttons, safety key, cup holders.
  const con = new Group()
  con.position.set(0, 2.15, -2.95)
  con.rotation.x = -0.55
  s.add(con)
  block(con, 2.5, 0.8, 0.3, frame, 0, 0, 0, { round: 0.1 })
  block(con, 1.56, 0.62, 0.04, '#0b0d12', 0, 0.06, 0.15, { studs: false })
  const screen = canvasTexture(384, 140, drawTreadScreen)
  const scr = new Mesh(new PlaneGeometry(1.42, 0.52), new MeshBasicMaterial({ map: screen.texture, toneMapped: false }))
  scr.position.set(0, 0.06, 0.175)
  con.add(scr)
  for (const [bx, by, c] of [[-0.98, 0.18, '#3fdc5a'], [-0.98, -0.04, '#ffd23a'], [-0.98, -0.26, '#ff4a4a'], [0.98, 0.18, '#3fa8ff'], [0.98, -0.04, '#3fa8ff']]) {
    block(con, 0.17, 0.15, 0.06, c, bx, by, 0.16, { round: 0.04, studs: false, emissive: c, ei: 0.25 })
  }
  block(con, 0.12, 0.12, 0.08, '#ff2d2d', 0.98, -0.27, 0.17, { studs: false }) // safety key
  block(con, 0.025, 0.4, 0.025, '#ffd23a', 0.98, -0.5, 0.2, { studs: false })
  for (const sx of [-1, 1]) block(con, 0.36, 0.16, 0.34, dark, sx * 1.36, -0.3, 0.05, { round: 0.05, studs: false })
  const bottle = new Mesh(new CylinderGeometry(0.08, 0.08, 0.34, 12), mat('#4fc3ff', { transparent: 0.8, rough: 0.15, studs: false }))
  bottle.position.set(1.36, -0.1, 0.05)
  con.add(bottle)
  block(con, 0.1, 0.06, 0.1, '#ffffff', 1.36, 0.1, 0.05, { studs: false })

  g.add(bake(s, true))

  // Live parts: the belt and its rollers (striped so their spin reads).
  const belt = block(g, 1.96, 0.06, 4.4, '#2a2a2e', 0, 0.39, 0, { rough: 0.95 })
  const rollerR = 0.13
  const stripes = canvasTexture(64, 8, (ctx, w, h) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#2b2f37' : '#c9d0da'
      ctx.fillRect((i * w) / 8, 0, w / 8, h)
    }
  })
  const rollerMat = new MeshStandardMaterial({ map: stripes.texture, metalness: 0.5, roughness: 0.35 })
  const rollers = [-2.24, 2.24].map((rz) => {
    const r = new Mesh(new CylinderGeometry(rollerR, rollerR, 1.94, 16), rollerMat)
    r.rotation.z = Math.PI / 2
    r.position.set(0, 0.29, rz)
    g.add(r)
    return r
  })
  Object.assign(g.userData, { belt, rollers, fan, led, screen, rollerR })
  return g
}

// The treadmill console's LCD. d: { locked, steps, perStep, bonus, next (0..1), bpm, run, banner, blink }
function drawTreadScreen(ctx, w, h, d = { locked: true }) {
  ctx.fillStyle = '#04140f'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(80,255,190,0.05)'
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2) // scanlines
  const lcd = '#5dffc0'
  if (d.locked) {
    signText(ctx, 'LOCKED', w / 2, 56, { size: 50, color: '#ff5a5a', outline: null })
    signText(ctx, 'UNLOCK AT THE SIGN', w / 2, 108, { size: 22, color: '#ffb0b0', outline: null })
    return
  }
  if (d.banner) {
    signText(ctx, d.banner, w / 2, h / 2, { size: 58, color: '#ffe14a', outline: '#7a4a00', width: 6 })
    return
  }
  signText(ctx, 'STEPS', 16, 20, { size: 18, color: '#2fb889', outline: null, align: 'left' })
  signText(ctx, d.steps, 16, 58, { size: 42, color: lcd, outline: null, align: 'left', maxWidth: 190 })
  signText(ctx, 'SPEED', w - 16, 20, { size: 18, color: '#2fb889', outline: null, align: 'right' })
  signText(ctx, `+${d.bonus} m/s`, w - 16, 58, { size: 32, color: lcd, outline: null, align: 'right' })
  // Heart rate: beats faster while running.
  const beat = d.run > 0.05 && d.blink
  ctx.fillStyle = beat ? '#ff4d6d' : '#8a2a3a'
  ctx.beginPath()
  ctx.arc(w / 2 - 34, 92, 7, 0, Math.PI * 2)
  ctx.arc(w / 2 - 22, 92, 7, 0, Math.PI * 2)
  ctx.moveTo(w / 2 - 41, 95)
  ctx.lineTo(w / 2 - 28, 108)
  ctx.lineTo(w / 2 - 15, 95)
  ctx.fill()
  signText(ctx, `${d.bpm}`, w / 2 - 6, 96, { size: 22, color: '#ff8fa3', outline: null, align: 'left' })
  signText(ctx, d.run > 0.05 ? `+${d.perStep}/STEP` : d.blink ? 'RUN!' : '', w - 16, 96, { size: 20, color: '#ffe14a', outline: null, align: 'right' })
  // Progress to the next speed-up.
  ctx.fillStyle = '#0e3a2b'
  ctx.fillRect(16, 118, w - 32, 12)
  ctx.fillStyle = lcd
  ctx.fillRect(16, 118, (w - 32) * Math.max(0, Math.min(1, d.next)), 12)
}

// "Choose a world" portal: an ice-crystal ring around a swirling vortex.
export function portal(parent, x, y, z, ry, r = 4.2) {
  const g = group(parent, x, y, z, ry)
  const ice = mat('#9fe4ff', { rough: 0.25, emissive: '#3fb6ff', ei: 0.25 })
  const ring = new Mesh(new TorusGeometry(r, 0.55, 10, 36), ice)
  ring.position.y = r + 0.9
  ring.castShadow = true
  g.add(ring)
  const rim2 = new Mesh(new TorusGeometry(r + 0.55, 0.18, 8, 36), mat('#eaff7a', { emissive: '#d8ff3a', ei: 0.6, studs: false }))
  rim2.position.y = r + 0.9
  g.add(rim2)
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    const c = new Mesh(new OctahedronGeometry(rnd(0.5, 0.9), 0), ice)
    c.position.set(Math.cos(a) * (r + 0.6), r + 0.9 + Math.sin(a) * (r + 0.6), rnd(-0.3, 0.3))
    c.rotation.set(rnd(0, 3), rnd(0, 3), a)
    c.scale.y = 1.6
    g.add(c)
  }
  block(g, 2 * r + 3, 1, 3, '#7ccff2', 0, 0.5, 0, { round: 0.2 }) // base
  const swirl = new ShaderMaterial({
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float time; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
        float a = atan(p.y, p.x);
        float s = sin(a * 3.0 + r * 9.0 - time * 3.0);
        float s2 = sin(a * 5.0 - r * 14.0 + time * 4.2);
        vec3 deep = vec3(0.05, 0.12, 0.6), mid = vec3(0.1, 0.55, 1.0), hi = vec3(0.85, 0.97, 1.0);
        vec3 col = mix(deep, mid, smoothstep(-0.3, 0.8, s));
        col = mix(col, hi, smoothstep(0.55, 1.0, s2) * (1.0 - r));
        col += hi * pow(1.0 - r, 3.0) * 1.6;
        gl_FragColor = vec4(col * 1.4, smoothstep(1.0, 0.92, r));
      }`,
  })
  const disc = new Mesh(new CircleGeometry(r, 48), swirl)
  disc.position.y = r + 0.9
  g.add(disc)
  g.userData.swirl = swirl
  return g
}

// --- Text boards -------------------------------------------------------------------------
// A board mesh whose front face shows a live canvas. Returns { group, redraw }.
export function textBoard(parent, x, y, z, ry, w, h, px, draw, { frame = '#2a2f45', depth = 0.4, posts = 0, postColor = '#5a3a1f' } = {}) {
  const g = group(parent, x, y, z, ry)
  const ct = canvasTexture(Math.round(px * (w / h)), px, draw)
  const face = new MeshStandardMaterial({ map: ct.texture, roughness: 0.65 })
  const side = mat(frame, { studs: false })
  const lift = posts
  const board = new Mesh(new BoxGeometry(w, h, depth), [side, side, side, side, face, side])
  board.position.y = lift + h / 2
  board.castShadow = board.receiveShadow = true
  g.add(board)
  if (posts) for (const sx of [-w * 0.36, w * 0.36]) block(g, 0.4, lift + 0.2, 0.4, postColor, sx, (lift + 0.2) / 2, -depth * 0.2)
  return { group: g, redraw: ct.redraw, board }
}

// Leaderboard stand (three in a row on the south wall).
export function leaderboard(parent, x, y, z, ry, title, color) {
  const rows = []
  const lb = textBoard(parent, x, y, z, ry, 4.6, 6, 600, (ctx, w, h, list = rows) => {
    ctx.fillStyle = '#1b2240'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = color
    ctx.fillRect(0, 0, w, 86)
    signText(ctx, title, w / 2, 46, { size: 46, color: '#fff', outline: '#00000066', width: 6 })
    list.forEach((r, i) => {
      const y = 120 + i * 62
      ctx.fillStyle = i % 2 ? '#232b4f' : '#2a3460'
      ctx.fillRect(14, y - 28, w - 28, 56)
      signText(ctx, `#${i + 1}`, 52, y, { size: 30, color: i < 3 ? ['#ffd23f', '#e6eef7', '#ff9d4a'][i] : '#9fb0d9', outline: null })
      signText(ctx, r.name, 100, y, { size: 28, color: r.me ? '#7dff7a' : '#ffffff', outline: null, align: 'left', maxWidth: 240, font: 'Fredoka, sans-serif', weight: '700' })
      signText(ctx, r.value, w - 30, y, { size: 28, color: '#7dffb0', outline: null, align: 'right', font: 'Fredoka, sans-serif', weight: '700' })
    })
  }, { frame: color, posts: 0.6, postColor: '#3a3f55', depth: 0.5 })
  // Header cap on top.
  block(lb.group, 5, 0.7, 0.7, color, 0, 0.6 + 6 + 0.35, 0)
  return lb
}
