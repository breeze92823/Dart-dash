// Particles: two pooled Points systems (additive glow + normal-blended solid)
// drawing from one sprite atlas (soft dot, star, Z, $, feather, square,
// heart, ring). Per-particle colour, alpha, size, gravity, drag and spin are
// simulated on the CPU into typed arrays; one draw call per system.
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, NormalBlending, Points, ShaderMaterial, Vector3 } from 'three'

export const CELL = { dot: 0, star: 1, z: 2, cash: 3, feather: 4, square: 5, heart: 6, ring: 7 }

function atlas() {
  const S = 128
  const c = document.createElement('canvas')
  c.width = S * 4
  c.height = S * 2
  const ctx = c.getContext('2d')
  const cell = (i) => [(i % 4) * S, Math.floor(i / 4) * S]
  // 0 soft dot
  let [x, y] = cell(0)
  let g = ctx.createRadialGradient(x + S / 2, y + S / 2, 0, x + S / 2, y + S / 2, S / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.75)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(x, y, S, S)
  // 1 four-point star
  ;[x, y] = cell(1)
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  const cx = x + S / 2
  const cy = y + S / 2
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? S * 0.11 : S * 0.48
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
  }
  ctx.fill()
  // 2 Z, 3 $
  const glyph = (i, ch, size) => {
    const [gx, gy] = cell(i)
    ctx.font = `900 ${size}px 'Luckiest Guy', 'Arial Black', sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 14
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.strokeText(ch, gx + S / 2, gy + S / 2 + 6)
    ctx.fillStyle = '#fff'
    ctx.fillText(ch, gx + S / 2, gy + S / 2 + 6)
  }
  glyph(2, 'Z', 104)
  glyph(3, '$', 110)
  // 4 feather
  ;[x, y] = cell(4)
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.ellipse(x + S / 2, y + S / 2, S * 0.16, S * 0.44, 0.5, 0, Math.PI * 2)
  ctx.fill()
  // 5 square (confetti / chips)
  ;[x, y] = cell(5)
  ctx.fillRect(x + S * 0.2, y + S * 0.2, S * 0.6, S * 0.6)
  // 6 heart
  ;[x, y] = cell(6)
  ctx.beginPath()
  ctx.moveTo(x + S / 2, y + S * 0.82)
  ctx.bezierCurveTo(x + S * 0.05, y + S * 0.5, x + S * 0.18, y + S * 0.1, x + S / 2, y + S * 0.32)
  ctx.bezierCurveTo(x + S * 0.82, y + S * 0.1, x + S * 0.95, y + S * 0.5, x + S / 2, y + S * 0.82)
  ctx.fill()
  // 7 ring
  ;[x, y] = cell(7)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 12
  ctx.beginPath()
  ctx.arc(x + S / 2, y + S / 2, S * 0.38, 0, Math.PI * 2)
  ctx.stroke()
  const t = new CanvasTexture(c)
  return t
}

const vert = /* glsl */ `
  attribute float size;
  attribute vec4 rgba;
  attribute vec2 cellSpin;
  uniform float scale;
  varying vec4 vColor;
  varying vec2 vCellSpin;
  void main() {
    vColor = rgba;
    vCellSpin = cellSpin;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * scale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`
const frag = /* glsl */ `
  uniform sampler2D map;
  varying vec4 vColor;
  varying vec2 vCellSpin;
  void main() {
    if (vColor.a <= 0.001) discard;
    vec2 p = gl_PointCoord - 0.5;
    float s = sin(vCellSpin.y), c = cos(vCellSpin.y);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
    if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) discard;
    float cell = vCellSpin.x;
    vec2 uv = vec2((mod(cell, 4.0) + p.x) / 4.0, 1.0 - (floor(cell / 4.0) + p.y) / 2.0);
    vec4 tex = texture2D(map, uv);
    gl_FragColor = vec4(vColor.rgb * tex.rgb, vColor.a * tex.a);
    if (gl_FragColor.a < 0.02) discard;
  }`

class Pool {
  constructor(scene, max, additive, map) {
    this.max = max
    this.n = 0
    this.pos = new Float32Array(max * 3)
    this.vel = new Float32Array(max * 3)
    this.rgba = new Float32Array(max * 4)
    this.size = new Float32Array(max)
    this.cellSpin = new Float32Array(max * 2)
    this.life = new Float32Array(max)
    this.age = new Float32Array(max)
    this.size0 = new Float32Array(max)
    this.size1 = new Float32Array(max)
    this.grav = new Float32Array(max)
    this.drag = new Float32Array(max)
    this.spinV = new Float32Array(max)
    this.alpha0 = new Float32Array(max)
    this.fadeIn = new Float32Array(max)
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(this.pos, 3))
    g.setAttribute('rgba', new BufferAttribute(this.rgba, 4))
    g.setAttribute('size', new BufferAttribute(this.size, 1))
    g.setAttribute('cellSpin', new BufferAttribute(this.cellSpin, 2))
    g.setDrawRange(0, 0)
    this.geo = g
    this.mat = new ShaderMaterial({
      uniforms: { map: { value: map }, scale: { value: 600 } },
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
    })
    this.points = new Points(g, this.mat)
    this.points.frustumCulled = false
    this.points.renderOrder = additive ? 5 : 4
    scene.add(this.points)
  }
  emit(o, color) {
    if (this.n >= this.max) return
    const i = this.n++
    const i3 = i * 3
    this.pos[i3] = o.x
    this.pos[i3 + 1] = o.y
    this.pos[i3 + 2] = o.z
    this.vel[i3] = o.vx ?? 0
    this.vel[i3 + 1] = o.vy ?? 0
    this.vel[i3 + 2] = o.vz ?? 0
    this.rgba[i * 4] = color.r * (o.hdr ?? 1)
    this.rgba[i * 4 + 1] = color.g * (o.hdr ?? 1)
    this.rgba[i * 4 + 2] = color.b * (o.hdr ?? 1)
    this.alpha0[i] = o.alpha ?? 1
    this.rgba[i * 4 + 3] = 0
    this.life[i] = o.life ?? 1
    this.age[i] = 0
    this.size0[i] = o.size ?? 0.3
    this.size1[i] = o.size2 ?? this.size0[i]
    this.size[i] = this.size0[i]
    this.grav[i] = o.gravity ?? 0
    this.drag[i] = o.drag ?? 0
    this.cellSpin[i * 2] = o.cell ?? 0
    this.cellSpin[i * 2 + 1] = o.rot ?? 0
    this.spinV[i] = o.spin ?? 0
    this.fadeIn[i] = o.fadeIn ?? 0.05
  }
  // Swap-remove: copy the last particle into slot i.
  kill(i) {
    const j = --this.n
    if (i === j) return
    const c3 = (a) => {
      a[i * 3] = a[j * 3]
      a[i * 3 + 1] = a[j * 3 + 1]
      a[i * 3 + 2] = a[j * 3 + 2]
    }
    c3(this.pos)
    c3(this.vel)
    for (let k = 0; k < 4; k++) this.rgba[i * 4 + k] = this.rgba[j * 4 + k]
    this.cellSpin[i * 2] = this.cellSpin[j * 2]
    this.cellSpin[i * 2 + 1] = this.cellSpin[j * 2 + 1]
    for (const a of [this.size, this.life, this.age, this.size0, this.size1, this.grav, this.drag, this.spinV, this.alpha0, this.fadeIn]) a[i] = a[j]
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt
      const t = this.age[i] / this.life[i]
      if (t >= 1) {
        this.kill(i)
        i--
        continue
      }
      const i3 = i * 3
      const d = Math.exp(-this.drag[i] * dt)
      this.vel[i3] *= d
      this.vel[i3 + 1] = this.vel[i3 + 1] * d - this.grav[i] * dt
      this.vel[i3 + 2] *= d
      this.pos[i3] += this.vel[i3] * dt
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt
      this.size[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * t
      const fi = this.fadeIn[i] > 0 ? Math.min(1, this.age[i] / this.fadeIn[i]) : 1
      const fo = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1
      this.rgba[i * 4 + 3] = this.alpha0[i] * fi * fo
      this.cellSpin[i * 2 + 1] += this.spinV[i] * dt
    }
    this.geo.setDrawRange(0, this.n)
    for (const k of ['position', 'rgba', 'size', 'cellSpin']) this.geo.attributes[k].needsUpdate = true
  }
}

let glow = null
let solid = null
let quality = 1
const col = new Color()
const rnd = (a, b) => a + Math.random() * (b - a)

export function initParticles(scene, q = 1) {
  const map = atlas()
  glow = new Pool(scene, 2500, true, map)
  solid = new Pool(scene, 2500, false, map)
  quality = q
}
export function setParticleQuality(q) {
  quality = q
}

export function updateParticles(dt, camera, viewH) {
  if (!glow) return
  const scale = viewH / (2 * Math.tan((camera.fov * Math.PI) / 360))
  glow.mat.uniforms.scale.value = scale
  solid.mat.uniforms.scale.value = scale
  glow.update(dt)
  solid.update(dt)
}

const count = (n) => Math.max(1, Math.round(n * quality))

// Raw emit: o = { x, y, z, vx, vy, vz, life, size, size2, gravity, drag, cell, rot, spin, alpha, hdr }
export function emit(o, color = '#ffffff', additive = false) {
  if (!glow) return
  col.set(color)
  ;(additive ? glow : solid).emit(o, col)
}

// --- Effects ----------------------------------------------------------------------------------
export function puff(p, color = '#ffffff', n = 10, spread = 1, size = 0.6) {
  for (let i = 0; i < count(n); i++) {
    const a = Math.random() * Math.PI * 2
    const s = rnd(0.5, 2.2) * spread
    emit({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * s, vy: rnd(0.4, 1.8) * spread, vz: Math.sin(a) * s, life: rnd(0.45, 0.8), size: size * rnd(0.6, 1), size2: size * 2.2, drag: 3, gravity: -0.6, alpha: 0.75 }, color)
  }
}

export function dust(p, n = 4) {
  for (let i = 0; i < count(n); i++) {
    emit({ x: p.x + rnd(-0.2, 0.2), y: p.y + 0.08, z: p.z + rnd(-0.2, 0.2), vx: rnd(-0.8, 0.8), vy: rnd(0.3, 0.9), vz: rnd(-0.8, 0.8), life: rnd(0.4, 0.7), size: 0.3, size2: 0.7, drag: 4, alpha: 0.5 }, '#e9e2c8')
  }
}

export function sparkle(p, color = '#fff3a0', n = 12, speed = 4, size = 0.5) {
  for (let i = 0; i < count(n); i++) {
    const v = new Vector3(rnd(-1, 1), rnd(-0.3, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(0.4, 1) * speed)
    emit({ x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, life: rnd(0.4, 0.8), size: size * rnd(0.6, 1.2), size2: 0.05, drag: 3, gravity: 2, cell: CELL.star, rot: rnd(0, 6), spin: rnd(-6, 6), hdr: 2.5 }, color, true)
  }
}

// Dart hits an animal: a white impact flash, stars, and bits of fur/feathers.
export function hitBurst(p, color = '#ffffff', feathers = false) {
  emit({ x: p.x, y: p.y, z: p.z, life: 0.18, size: 1.4, size2: 2.6, hdr: 3, fadeIn: 0 }, '#ffffff', true)
  emit({ x: p.x, y: p.y, z: p.z, life: 0.35, size: 0.6, size2: 2.4, cell: CELL.ring, hdr: 2 }, '#fff7c2', true)
  sparkle(p, '#fff7a0', 8, 5, 0.5)
  for (let i = 0; i < count(9); i++) {
    emit({ x: p.x, y: p.y, z: p.z, vx: rnd(-2.5, 2.5), vy: rnd(1, 4), vz: rnd(-2.5, 2.5), life: rnd(0.8, 1.4), size: feathers ? 0.32 : 0.18, gravity: feathers ? 1.6 : 8, drag: feathers ? 2.5 : 1, cell: feathers ? CELL.feather : CELL.square, rot: rnd(0, 6), spin: rnd(-5, 5) }, color)
  }
}

// Dart sticks in the ground / a tree: a little earth puff.
export function groundHit(p, color = '#bfe08a') {
  for (let i = 0; i < count(6); i++) emit({ x: p.x, y: p.y + 0.05, z: p.z, vx: rnd(-1.5, 1.5), vy: rnd(1, 3), vz: rnd(-1.5, 1.5), life: rnd(0.4, 0.7), size: 0.14, gravity: 9, cell: CELL.square, rot: rnd(0, 6) }, color)
  puff(p, '#e8e3cf', 4, 0.5, 0.35)
}

// One drifting "Z" over a sleeper.
export function zee(p) {
  emit({ x: p.x + rnd(-0.2, 0.2), y: p.y, z: p.z + rnd(-0.2, 0.2), vx: rnd(-0.2, 0.4), vy: rnd(0.6, 0.9), vz: rnd(-0.2, 0.2), life: 2.2, size: 0.35, size2: 0.75, cell: CELL.z, rot: rnd(-0.4, 0.4), spin: rnd(-0.6, 0.6), alpha: 0.95, fadeIn: 0.3 }, '#dff0ff')
}

export function confetti(p, n = 40, colors = ['#ff4d6a', '#ffd23f', '#4dd8ff', '#7dff6a', '#ff7ad9']) {
  for (let i = 0; i < count(n); i++) {
    const a = Math.random() * Math.PI * 2
    const s = rnd(2, 6)
    emit({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * s, vy: rnd(5, 10), vz: Math.sin(a) * s, life: rnd(1.2, 2), size: rnd(0.18, 0.3), gravity: 9, drag: 1.6, cell: CELL.square, rot: rnd(0, 6), spin: rnd(-10, 10) }, colors[i % colors.length])
  }
}

export function cashBurst(p, n = 14) {
  for (let i = 0; i < count(n); i++) {
    const a = Math.random() * Math.PI * 2
    const s = rnd(1, 3.5)
    emit({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * s, vy: rnd(3, 7), vz: Math.sin(a) * s, life: rnd(0.9, 1.4), size: rnd(0.4, 0.6), gravity: 8, drag: 1, cell: CELL.cash, rot: rnd(-0.3, 0.3), spin: rnd(-2, 2) }, '#5dff6a')
  }
}

export function hearts(p, n = 6) {
  for (let i = 0; i < count(n); i++) emit({ x: p.x + rnd(-0.4, 0.4), y: p.y, z: p.z + rnd(-0.4, 0.4), vx: rnd(-0.3, 0.3), vy: rnd(1, 2), vz: rnd(-0.3, 0.3), life: rnd(0.9, 1.4), size: 0.4, size2: 0.6, cell: CELL.heart, drag: 1 }, '#ff5f8f')
}

// Shimmer around shiny / golden / rainbow animals and the legendary.
export function shimmer(p, color, r = 0.8) {
  const a = Math.random() * Math.PI * 2
  emit({ x: p.x + Math.cos(a) * r * rnd(0.5, 1), y: p.y + rnd(-0.4, 0.6), z: p.z + Math.sin(a) * r * rnd(0.5, 1), vy: rnd(0.3, 0.8), life: rnd(0.6, 1), size: rnd(0.2, 0.4), size2: 0.02, cell: CELL.star, rot: rnd(0, 6), spin: 3, hdr: 2.2 }, color, true)
}

// Dart flight trail.
export function trailDot(p, color = '#ffffff') {
  emit({ x: p.x, y: p.y, z: p.z, life: 0.25, size: 0.16, size2: 0.02, alpha: 0.7, fadeIn: 0 }, color, true)
}

// Dart tail: one puff of the streak behind a flying dart (darts.js calls it every
// TAIL_STEP m of flight). A glowing coloured core with a hot white centre that drifts
// back along the flight line and shrinks away, plus the odd twinkling star spark.
// dir = unit flight direction; k (0..1) ramps the size up over the first metres so
// the tail does not fill the view right at the muzzle.
export function dartTail(p, dir, color = '#ffffff', k = 1, sparks = true) {
  const back = -rnd(0.4, 1.2)
  const vx = dir.x * back + rnd(-0.2, 0.2)
  const vy = dir.y * back + rnd(-0.1, 0.25)
  const vz = dir.z * back + rnd(-0.2, 0.2)
  // Solid coloured streak (reads on bright grass and sky), a soft glow round it, a hot centre.
  emit({ x: p.x, y: p.y, z: p.z, vx, vy, vz, life: rnd(0.4, 0.55), size: 0.3 * k, size2: 0.04, alpha: 0.95, drag: 2, fadeIn: 0 }, color)
  emit({ x: p.x, y: p.y, z: p.z, vx, vy, vz, life: rnd(0.5, 0.7), size: 0.6 * k, size2: 0.1, alpha: 0.55, hdr: 1.4, drag: 2, fadeIn: 0 }, color, true)
  emit({ x: p.x, y: p.y, z: p.z, life: 0.2, size: 0.18 * k, size2: 0.03, alpha: 1, hdr: 2.4, fadeIn: 0 }, '#ffffff', true)
  if (sparks && Math.random() < 0.45 * quality) {
    emit({ x: p.x, y: p.y, z: p.z, vx: rnd(-1.2, 1.2), vy: rnd(-0.3, 1.2), vz: rnd(-1.2, 1.2), life: rnd(0.5, 0.75), size: rnd(0.22, 0.34) * k, size2: 0.02, gravity: 1.5, drag: 2, cell: CELL.star, rot: rnd(0, 6), spin: rnd(-8, 8), hdr: 2.4, fadeIn: 0 }, color, true)
  }
}

export function ringPulse(p, color = '#ffffff', size = 3) {
  emit({ x: p.x, y: p.y, z: p.z, life: 0.5, size: 0.4, size2: size, cell: CELL.ring, hdr: 2, fadeIn: 0 }, color, true)
}
