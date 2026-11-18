// Building kit for the blocky world: every prop, animal and weapon is made of
// boxes (and a few wedges / rounded boxes) wearing the same "stud plate" normal
// map, so the whole game reads as one toy-brick look.
//  - studNormal: one tileable stud per UV unit; projectUVs() gives any geometry
//    world-scaled UVs (dominant-axis projection), so studs keep one size on
//    every face no matter how big the part is.
//  - mat(color): cached MeshStandardMaterial with the stud normal map.
//  - block(): a box mesh placed in a parent; wedge(), rbox() for slopes / canopies.
//  - checker(): the big two-tone checker ground textures (colour + studs).
import { BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color, Mesh, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, Vector2 } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { heightToNormal } from '../textures.js'

export const STUD_SIZE = 0.42 // m per stud on props

function canvas(w, h = w) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

// Height field of one stud: a raised rounded square with a soft rim, on a flat plate
// with a faint seam at the edge.
function studHeights(size, studsPerSide = 1) {
  const h = new Float32Array(size * size)
  const cell = size / studsPerSide
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = ((x % cell) / cell) * 2 - 1
      const v = ((y % cell) / cell) * 2 - 1
      const d = Math.max(Math.abs(u), Math.abs(v))
      const r = Math.hypot(u, v)
      let z = 0
      const stud = 1 - Math.min(1, Math.max(0, (Math.max(d * 0.7 + r * 0.3, 0) - 0.48) / 0.1))
      z += stud * 0.55
      if (d > 0.93) z -= (d - 0.93) * 4 // seam between studs
      h[y * size + x] = z
    }
  }
  return h
}

let studTex = null
export function studNormal() {
  if (studTex) return studTex
  const size = 64
  const c = heightToNormal(studHeights(size), size, 1.6)
  studTex = new CanvasTexture(c)
  studTex.wrapS = studTex.wrapT = RepeatWrapping
  studTex.anisotropy = 8
  return studTex
}

// World-scaled UVs: each vertex takes the two coordinates across its dominant normal
// axis, divided by `scale` m. Works for boxes, wedges, rounded boxes, extrusions.
export function projectUVs(geo, scale = STUD_SIZE, offset = null) {
  const g = geo.index ? geo.toNonIndexed() : geo
  const p = g.attributes.position
  if (!g.attributes.normal) g.computeVertexNormals()
  const n = g.attributes.normal
  const uv = new Float32Array(p.count * 2)
  const ox = offset?.x ?? 0
  const oy = offset?.y ?? 0
  const oz = offset?.z ?? 0
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i))
    const ay = Math.abs(n.getY(i))
    const az = Math.abs(n.getZ(i))
    const x = p.getX(i) + ox
    const y = p.getY(i) + oy
    const z = p.getZ(i) + oz
    let u, v
    if (ay >= ax && ay >= az) {
      u = x
      v = z
    } else if (ax >= az) {
      u = z
      v = y
    } else {
      u = x
      v = y
    }
    uv[i * 2] = u / scale
    uv[i * 2 + 1] = v / scale
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2))
  return g
}

const geoCache = new Map()
export function boxGeo(w, h, d, scale = STUD_SIZE) {
  const key = `b${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${scale}`
  let g = geoCache.get(key)
  if (!g) geoCache.set(key, (g = projectUVs(new BoxGeometry(w, h, d), scale)))
  return g
}
export function rboxGeo(w, h, d, r, scale = STUD_SIZE) {
  const key = `r${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r}|${scale}`
  let g = geoCache.get(key)
  if (!g) geoCache.set(key, (g = projectUVs(new RoundedBoxGeometry(w, h, d, 2, r), scale)))
  return g
}

// Wedge (ramp) w x h x d: full height at -z, zero at +z.
export function wedgeGeo(w, h, d) {
  const x = w / 2
  const z = d / 2
  // 6 corners: bottom 4, top 2 (at -z).
  const A = [-x, 0, -z], B = [x, 0, -z], C = [x, 0, z], D = [-x, 0, z], E = [-x, h, -z], F = [x, h, -z]
  const tris = [
    A, C, B, A, D, C, // bottom
    A, B, F, A, F, E, // back
    D, E, F, D, F, C, // slope
    A, E, D, // left
    B, C, F, // right
  ]
  const pos = new Float32Array(tris.flat())
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return projectUVs(g)
}

const matCache = new Map()
// Stud-plated standard material. opts: { rough, metal, emissive, ei, studs: false, flat }
export function mat(color, opts = {}) {
  const key = `${color}|${opts.rough ?? 0.72}|${opts.metal ?? 0}|${opts.emissive ?? ''}|${opts.ei ?? 0}|${opts.studs ?? true}|${opts.ns ?? 0.55}|${opts.transparent ?? ''}`
  let m = matCache.get(key)
  if (m) return m
  m = new MeshStandardMaterial({
    color,
    roughness: opts.rough ?? 0.72,
    metalness: opts.metal ?? 0,
    normalMap: opts.studs === false ? null : studNormal(),
    normalScale: new Vector2(opts.ns ?? 0.55, opts.ns ?? 0.55),
  })
  if (opts.emissive) {
    m.emissive = new Color(opts.emissive)
    m.emissiveIntensity = opts.ei ?? 1
  }
  if (opts.transparent) {
    m.transparent = true
    m.opacity = opts.transparent
    m.depthWrite = false
  }
  matCache.set(key, m)
  return m
}

// A box in `parent`. Returns the mesh. opts: material opts, rx/ry/rz rotation, shadow.
export function block(parent, w, h, d, color, x = 0, y = 0, z = 0, opts = {}) {
  const m = new Mesh(opts.round ? rboxGeo(w, h, d, opts.round) : boxGeo(w, h, d), typeof color === 'string' ? mat(color, opts) : color)
  m.position.set(x, y, z)
  if (opts.rx) m.rotation.x = opts.rx
  if (opts.ry) m.rotation.y = opts.ry
  if (opts.rz) m.rotation.z = opts.rz
  m.castShadow = opts.shadow !== false
  m.receiveShadow = true
  parent.add(m)
  return m
}

// Big ground textures: a two-tone checker of `tilesPerSide` squares, each square
// covered in `studsPerSquare`^2 studs. Returns { map, normal } (repeat set by caller).
export function checker(a, b, { tilesPerSide = 2, studsPerSquare = 8, size = 512, noise = 0.035 } = {}) {
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const sq = size / tilesPerSide
  for (let y = 0; y < tilesPerSide; y++) {
    for (let x = 0; x < tilesPerSide; x++) {
      ctx.fillStyle = (x + y) % 2 ? b : a
      ctx.fillRect(x * sq, y * sq, sq, sq)
    }
  }
  // Per-stud shading: a slightly lighter top-left and darker rim, so the colour map
  // carries the studs even where the normal map is too fine to read.
  const studs = tilesPerSide * studsPerSquare
  const st = size / studs
  for (let y = 0; y < studs; y++) {
    for (let x = 0; x < studs; x++) {
      const k = (Math.random() - 0.5) * noise
      ctx.fillStyle = k > 0 ? `rgba(255,255,255,${k})` : `rgba(0,0,0,${-k})`
      ctx.fillRect(x * st, y * st, st, st)
      ctx.fillStyle = 'rgba(255,255,255,0.07)'
      ctx.fillRect(x * st + st * 0.22, y * st + st * 0.22, st * 0.5, st * 0.5)
      ctx.fillStyle = 'rgba(0,0,0,0.06)'
      ctx.fillRect(x * st, y * st + st - 1, st, 1)
      ctx.fillRect(x * st + st - 1, y * st, 1, st)
    }
  }
  const map = new CanvasTexture(c)
  map.wrapS = map.wrapT = RepeatWrapping
  map.colorSpace = SRGBColorSpace
  map.anisotropy = 8
  const ns = 256
  const n = new CanvasTexture(heightToNormal(studHeights(ns, ns / 32), ns, 1.4))
  n.wrapS = n.wrapT = RepeatWrapping
  n.anisotropy = 8
  return { map, normal: n, studs }
}

// Canvas texture helper for signs: draw(ctx, w, h) paints it; returns { texture, redraw }.
export function canvasTexture(w, h, draw) {
  const c = canvas(w, h)
  const ctx = c.getContext('2d')
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  const redraw = (...args) => {
    ctx.clearRect(0, 0, w, h)
    draw(ctx, w, h, ...args)
    tex.needsUpdate = true
  }
  redraw()
  return { texture: tex, redraw, canvas: c }
}

// Chunky outlined game text on a 2D context (signs, boards).
export function signText(ctx, text, x, y, { size = 64, color = '#fff', outline = '#1a1a1a', width = 10, font = 'Luckiest Guy, Fredoka, "Arial Black", sans-serif', align = 'center', weight = '400', maxWidth } = {}) {
  ctx.font = `${weight} ${size}px ${font}`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  if (outline) {
    ctx.lineWidth = width
    ctx.strokeStyle = outline
    ctx.strokeText(text, x, y, maxWidth)
  }
  ctx.fillStyle = color
  ctx.fillText(text, x, y, maxWidth)
}
