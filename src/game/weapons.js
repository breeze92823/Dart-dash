// Weapon and dart models. Weapons are built along +Z (muzzle forward) with the
// grip at the origin; userData.muzzle marks where darts leave. A skin swaps the
// palette ([main, second, accent]). The first-person view model adds the two
// blocky arms holding it.
import { Group, Object3D } from 'three'
import { DARTS, SKINS } from '../config.js'
import { block } from '../world/kit.js'

function pal(skin, def) {
  const c = SKINS[skin]?.colors
  return c ? { a: c[0], b: c[1], c: c[2] } : def
}

function blowpipe(g, p) {
  // Bamboo tube: segments with cream wraps, a mouthpiece block at the back.
  const len = 1.7
  const segs = 6
  for (let i = 0; i < segs; i++) {
    const z = -0.25 + (i + 0.5) * (len / segs)
    block(g, 0.13, 0.13, len / segs - 0.03, i % 2 ? p.a : p.b, 0, 0, z, { round: 0.03 })
    block(g, 0.155, 0.155, 0.045, p.c, 0, 0, z + len / segs / 2 - 0.015, { round: 0.02 })
  }
  block(g, 0.26, 0.26, 0.28, '#ffd02e', 0, 0, -0.3, { round: 0.04 })
  return len - 0.25
}

function pistol(g, p) {
  block(g, 0.2, 0.26, 0.6, p.a, 0, 0.1, 0.12) // body
  block(g, 0.13, 0.13, 0.5, p.b, 0, 0.12, 0.62) // barrel
  block(g, 0.17, 0.17, 0.08, p.a, 0, 0.12, 0.88) // muzzle cap
  block(g, 0.16, 0.12, 0.36, p.c, 0, 0.29, 0.1, { round: 0.03 }) // tank
  block(g, 0.16, 0.36, 0.2, '#ffd02e', 0, -0.17, -0.08, { rx: 0.25 }) // grip
  block(g, 0.05, 0.12, 0.05, '#2a2a30', 0, -0.04, 0.12) // trigger
  for (let i = 0; i < 3; i++) block(g, 0.21, 0.04, 0.08, '#c75a12', 0, 0.06, -0.08 + i * 0.12) // vents
  return 0.92
}

function crossbow(g, p) {
  block(g, 0.16, 0.16, 1.1, p.a, 0, 0, 0.25) // stock
  block(g, 0.14, 0.32, 0.28, p.a, 0, -0.16, -0.22, { rx: 0.2 })
  block(g, 1.1, 0.08, 0.1, p.b, 0, 0.04, 0.72) // limbs
  block(g, 0.08, 0.08, 0.25, p.b, -0.55, 0.04, 0.6, { ry: 0.5 })
  block(g, 0.08, 0.08, 0.25, p.b, 0.55, 0.04, 0.6, { ry: -0.5 })
  block(g, 1.0, 0.02, 0.02, '#f2f2f2', 0, 0.06, 0.45) // string
  block(g, 0.05, 0.05, 0.6, p.c, 0, 0.12, 0.6) // bolt
  return 0.95
}

function rifle(g, p) {
  block(g, 0.16, 0.22, 0.9, p.a, 0, 0.02, 0.15) // body
  block(g, 0.1, 0.1, 1.1, '#2d3038', 0, 0.08, 1.05) // barrel
  block(g, 0.16, 0.3, 0.5, p.b, 0, -0.06, -0.45, { rx: 0.1 }) // stock
  block(g, 0.12, 0.3, 0.16, p.b, 0, -0.2, 0.05, { rx: 0.3 }) // grip
  block(g, 0.12, 0.12, 0.5, '#1b1d22', 0, 0.26, 0.25) // scope
  block(g, 0.15, 0.15, 0.06, p.c, 0, 0.26, 0.5)
  block(g, 0.15, 0.15, 0.06, p.c, 0, 0.26, 0.0)
  return 1.6
}

function carbine(g, p) {
  block(g, 0.15, 0.2, 1.2, p.a, 0, 0.02, 0.3) // receiver
  block(g, 0.09, 0.09, 1.3, '#2d3038', 0, 0.07, 1.5) // long barrel
  block(g, 0.13, 0.13, 0.12, p.c, 0, 0.07, 2.12) // muzzle brake
  block(g, 0.16, 0.28, 0.55, p.b, 0, -0.07, -0.5, { rx: 0.08 }) // stock
  block(g, 0.12, 0.3, 0.16, p.b, 0, -0.2, 0.12, { rx: 0.3 }) // grip
  block(g, 0.12, 0.12, 0.7, '#1b1d22', 0, 0.26, 0.35) // long scope
  block(g, 0.16, 0.16, 0.08, p.c, 0, 0.26, 0.72)
  block(g, 0.16, 0.16, 0.08, p.c, 0, 0.26, -0.02)
  block(g, 0.06, 0.24, 0.06, '#2d3038', 0, -0.12, 1.0, { rx: -0.3 }) // bipod leg
  return 2.18
}

function sniper(g, p) {
  block(g, 0.2, 0.26, 1.4, p.a, 0, 0.02, 0.35, { round: 0.03 }) // heavy receiver
  block(g, 0.12, 0.12, 1.7, '#2d3038', 0, 0.08, 1.9) // huge barrel
  block(g, 0.2, 0.2, 0.22, p.c, 0, 0.08, 2.75) // brake
  block(g, 0.2, 0.34, 0.7, p.b, 0, -0.08, -0.65, { rx: 0.06 }) // stock
  block(g, 0.14, 0.34, 0.18, p.b, 0, -0.24, 0.15, { rx: 0.3 }) // grip
  block(g, 0.18, 0.18, 0.95, '#1b1d22', 0, 0.34, 0.45) // big scope
  block(g, 0.24, 0.24, 0.1, p.c, 0, 0.34, 0.95)
  block(g, 0.22, 0.22, 0.1, p.c, 0, 0.34, -0.03)
  block(g, 0.16, 0.08, 0.6, p.c, 0, 0.18, 0.4) // trim
  return 2.86
}

function voidReaper(g, p) {
  block(g, 0.2, 0.28, 1.3, p.a, 0, 0.02, 0.3, { round: 0.04 })
  block(g, 0.11, 0.11, 1.5, p.b, 0, 0.08, 1.7)
  for (let i = 0; i < 4; i++) block(g, 0.04, 0.3 - i * 0.05, 0.12, p.c, 0, 0.3 - i * 0.02, 0.2 + i * 0.28, { rx: -0.6, emissive: p.c, ei: 1.4, studs: false }) // fins
  block(g, 0.26, 0.26, 0.26, p.c, 0, 0.08, 2.5, { rx: 0.78, rz: 0.78, emissive: p.c, ei: 1.6, studs: false }) // void core
  block(g, 0.2, 0.32, 0.6, p.b, 0, -0.07, -0.6)
  block(g, 0.14, 0.32, 0.18, p.b, 0, -0.22, 0.12, { rx: 0.3 })
  block(g, 0.16, 0.16, 0.8, '#120a1e', 0, 0.32, 0.4)
  block(g, 0.2, 0.2, 0.08, p.c, 0, 0.32, 0.82, { emissive: p.c, ei: 1.2, studs: false })
  return 2.62
}

// Skin decorations (SKINS[skin].deco), spread along the weapon's top from the grip to `len`.
function deco(g, kind, p, len) {
  const n = Math.max(3, Math.round(len * 3))
  const glow = { emissive: p.c, ei: 0.9, studs: false, shadow: false }
  for (let i = 0; i < n; i++) {
    const z = -0.1 + (i + 0.5) * ((len + 0.1) / n)
    const k = i % 2 ? 1 : -1
    if (kind === 'crystals') block(g, 0.09, 0.2, 0.09, i % 2 ? p.c : p.a, k * 0.07, 0.2, z, { rx: 0.3, rz: k * 0.4, ...glow })
    else if (kind === 'spikes') block(g, 0.06, 0.18, 0.06, p.c, 0, 0.19, z, { rx: -0.5, rz: 0.78, studs: false })
    else if (kind === 'teeth') {
      block(g, 0.05, 0.12, 0.05, '#ffffff', 0.09, -0.06, z, { rz: 0.78, studs: false })
      block(g, 0.05, 0.12, 0.05, '#ffffff', -0.09, -0.06, z, { rz: 0.78, studs: false })
    } else if (kind === 'stars') block(g, 0.07, 0.07, 0.07, i % 2 ? '#ffffff' : p.c, k * 0.22, 0.12 + (i % 3) * 0.08, z, { rx: 0.78, ry: 0.78, ...glow, emissive: i % 2 ? '#ffffff' : p.c, ei: 1.5 })
    else if (kind === 'tentacles' && i % 2 === 0) {
      for (let j = 0; j < 4; j++) block(g, 0.05, 0.12, 0.05, j % 2 ? p.c : p.b, k * 0.06 + j * 0.02 * k, -0.12 - j * 0.1, z + j * 0.03, { rx: 0.25 * j, studs: false, shadow: false, emissive: p.c, ei: 0.4 })
    }
  }
  if (kind === 'wings') {
    for (const s of [-1, 1]) {
      block(g, 0.4, 0.04, 0.22, p.a, s * 0.3, 0.12, 0.05, { rz: s * 0.4, ...glow })
      block(g, 0.32, 0.04, 0.18, p.c, s * 0.42, 0.24, -0.1, { rz: s * 0.7, ...glow })
    }
  }
}

const BUILD = {
  blowpipe: [blowpipe, { a: '#a6e86a', b: '#7fcf45', c: '#e9d9a0' }],
  pistol: [pistol, { a: '#ff8a1f', b: '#f6f6f6', c: '#7fe0f0' }],
  crossbow: [crossbow, { a: '#9a5f2e', b: '#3a3f4a', c: '#e9e9e9' }],
  rifle: [rifle, { a: '#3f6e3a', b: '#8a5a2e', c: '#c9a24a' }],
  carbine: [carbine, { a: '#3a5a8a', b: '#2a2f3a', c: '#c9d4e0' }],
  sniper: [sniper, { a: '#e8b23a', b: '#3a2a1a', c: '#fff1b0' }],
  voidReaper: [voidReaper, { a: '#1a0b2a', b: '#2a1a40', c: '#b05cff' }],
}

export function buildWeapon(id, skin = 'classic') {
  const g = new Group()
  const [fn, def] = BUILD[id] ?? BUILD.blowpipe
  const p = pal(skin, def)
  const tip = fn(g, p)
  if (SKINS[skin]?.deco) deco(g, SKINS[skin].deco, p, tip)
  const muzzle = new Object3D()
  muzzle.position.set(0, id === 'pistol' ? 0.12 : id === 'rifle' ? 0.08 : 0, tip)
  g.add(muzzle)
  g.userData.muzzle = muzzle
  g.userData.id = id
  return g
}

// First-person view model: the weapon plus two forearms holding it.
export function buildViewModel(id, skin, skinColor = '#f2d3a0') {
  const g = new Group()
  const w = buildWeapon(id, skin)
  g.add(w)
  const two = id !== 'pistol'
  // Right hand on the grip, left hand forward on the barrel.
  block(g, 0.2, 0.2, 0.7, skinColor, 0.05, -0.16, -0.38, { rx: 0.3 })
  if (two) block(g, 0.2, 0.2, 0.7, skinColor, -0.12, -0.12, 0.35, { rx: 0.5, ry: 0.4 })
  else block(g, 0.2, 0.2, 0.6, skinColor, -0.16, -0.2, -0.3, { rx: 0.3, ry: 0.25 })
  for (const m of g.children) m.traverse?.((o) => {
    if (o.isMesh) {
      o.castShadow = false
      o.renderOrder = 10
    }
  })
  g.userData.muzzle = w.userData.muzzle
  return g
}

// A dart: needle, coloured body, fluffy tail. Points along +Z. A weapon skin paints the body
// (SKINS[skin].dart); the dart type keeps its colour on the tail cap.
export function buildDart(type = 'basic', skin = null) {
  const g = new Group()
  const color = DARTS[type]?.color ?? '#ff4d4d'
  block(g, 0.025, 0.025, 0.14, '#d9dde3', 0, 0, 0.13, { shadow: false, studs: false, metal: 0.8, rough: 0.3 })
  block(g, 0.06, 0.06, 0.16, SKINS[skin]?.dart ?? color, 0, 0, 0, { shadow: false, round: 0.02 })
  block(g, 0.11, 0.11, 0.1, '#ffffff', 0, 0, -0.12, { shadow: false, round: 0.04 })
  block(g, 0.08, 0.08, 0.05, color, 0, 0, -0.19, { shadow: false })
  return g
}
