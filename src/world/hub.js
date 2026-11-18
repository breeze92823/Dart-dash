// The hub plateau, north to south: the front row behind the yellow band (the wooden "Next Event"
// sign, the events board, the Dart Shop and the free gift), the six players' bases (config BASES: a
// fenced pen + treadmill + signs each), then the town (HUB.town: the other shop stalls with glowing
// pads and the world portal) and the leaderboards on the south wall. Returns the interactive zones and the live boards for game code to drive.
import { CanvasTexture, Group, MeshStandardMaterial, RepeatWrapping, Vector3 } from 'three'
import { BASES, HUB, inAnyPlot } from '../config.js'
import { solidBox } from '../propkit.js'
import { bake } from '../bake.js'
import { addLabel } from '../fx/labels.js'
import { block, canvasTexture, signText } from './kit.js'
import { blueSign, bush, flower, giftBox, glowDisc, leaderboard, penFence, portal, stall, textBoard, treadmill, tree } from './props.js'

const HOUSE_SVG = `<svg class="house" viewBox="0 0 100 92"><path d="M50 4 L96 46 L84 46 L84 88 L16 88 L16 46 L4 46 Z" fill="#2f86ff" stroke="#fff" stroke-width="6" stroke-linejoin="round"/><rect x="40" y="56" width="20" height="32" rx="6" fill="#fff"/></svg>`

export function buildHub(scene) {
  const root = new Group()
  scene.add(root)
  const statics = new Group()
  const zones = []
  const live = {}
  const T = (title, color, sub = '') => `<div class="t" style="color:${color}">${title}</div>${sub ? `<div class="s">${sub}</div>` : ''}`

  // --- Shops -------------------------------------------------------------------------------
  const shops = [
    { id: 'darts', title: 'Dart Shop', color: '#5dea4a', stripe: '#3fd23a', x: -24, z: -31, ry: 0 },
    { id: 'weapons', title: 'Weapon Shop', color: '#4fb3ff', stripe: '#3f9bff', x: -47, z: 58, ry: Math.PI / 2 },
    { id: 'trails', title: 'Trail Shop', color: '#ff7fd4', stripe: '#ff8fd0', x: -47, z: 70, ry: Math.PI / 2 },
    { id: 'skins', title: 'Skin Store', color: '#ff5fe8', stripe: '#d63ce8', x: -47, z: 82, ry: Math.PI / 2 },
    { id: 'auras', title: 'Aura Shop', color: '#ff6fd8', stripe: '#33d6ff', x: -47, z: 93, ry: Math.PI / 2, base: '#ffe03a' },
  ]
  live.discs = []
  live.counters = {}
  for (const s of shops) {
    stall(statics, s.x, 0, s.z, s.ry, s.stripe, s.base)
    const fx = s.x + Math.sin(s.ry) * 4.4
    const fz = s.z + Math.cos(s.ry) * 4.4
    const disc = glowDisc(root, fx, 0, fz, s.id === 'darts' ? '#7dff5a' : s.id === 'weapons' ? '#5fd0ff' : s.id === 'trails' ? '#ffa0e6' : '#ff2fd6', 3)
    live.discs.push(disc)
    solidBox(2.6, 0.7, 1.1, s.x, 0.7, s.z, s.ry)
    const label = addLabel({ pos: new Vector3(s.x, 6.6, s.z), size: 2.6, max: 1, maxDist: 55, className: 'wl-shop', html: T(s.title, s.color) })
    zones.push({ id: s.id, kind: 'shop', x: fx, z: fz, r: 3, label })
    live.counters[s.id] = new Vector3(s.x, 1.4, s.z)
  }
  live.shopLabels = Object.fromEntries(zones.map((z) => [z.id, z.label]))

  // --- Wooden "Next Event" sign -------------------------------------------------------------
  const sign = new Group()
  sign.position.set(14, 0, -33)
  statics.add(sign)
  for (const sx of [-6.2, 6.2]) {
    block(sign, 1, 10.5, 1, '#8b5a2b', sx, 5.25, 0)
    block(sign, 1.8, 0.8, 1.8, '#9aa1ab', sx, 0.4, 0) // stone footing
  }
  block(sign, 15.4, 0.7, 1.2, '#7a4b22', 0, 10.6, 0)
  solidBox(0.6, 5, 0.6, 14 - 6.2, 5, -33)
  solidBox(0.6, 5, 0.6, 14 + 6.2, 5, -33)
  live.nextEvent = textBoard(root, 14, 5.6, -32.6, 0, 13.6, 4.4, 300, (ctx, w, h, title = 'Next Event', time = '4:00', sub = '') => {
    ctx.fillStyle = '#9c6230'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    for (let y = 0; y < h; y += 50) ctx.fillRect(0, y, w, 4)
    const grad = ctx.createLinearGradient(w * 0.15, 0, w * 0.85, 0)
    grad.addColorStop(0, '#ff3fbf')
    grad.addColorStop(0.5, '#ffe14a')
    grad.addColorStop(1, '#9b6bff')
    signText(ctx, title, w / 2, h * 0.36, { size: 112, color: grad, outline: '#3a1d0a', width: 14 })
    signText(ctx, time, w / 2, h * 0.74, { size: 74, color: '#ffffff', outline: '#3a1d0a', width: 10 })
    if (sub) signText(ctx, sub, w / 2, h * 0.93, { size: 30, color: '#ffe9b0', outline: null, font: 'Fredoka, sans-serif', weight: '700' })
  }, { frame: '#7a4b22', depth: 0.5 })

  // --- Events board ---------------------------------------------------------------------------
  live.events = textBoard(root, -5, 0, -33, 0, 4.6, 3.2, 320, (ctx, w, h, line1 = 'LUCKY HOUR', line2 = 'x2 Luck at :00', line3 = '') => {
    ctx.fillStyle = '#141a4a'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#ffd23f'
    ctx.lineWidth = 10
    ctx.strokeRect(8, 8, w - 16, h - 16)
    signText(ctx, 'EVENTS', w / 2, 52, { size: 46, color: '#ffd23f', outline: null })
    signText(ctx, line1, w / 2, 122, { size: 56, color: '#ffffff', outline: null, font: 'Fredoka, sans-serif', weight: '700' })
    signText(ctx, line2, w / 2, 186, { size: 36, color: '#cfe0ff', outline: null, font: 'Fredoka, sans-serif', weight: '600' })
    signText(ctx, line3, w / 2, 250, { size: 42, color: '#ffd23f', outline: null, font: 'Fredoka, sans-serif', weight: '700' })
  }, { frame: '#3a2a1a', posts: 1.5, postColor: '#3a2a1a' })
  solidBox(2.4, 1.5, 0.4, -5, 1.5, -33)

  // --- Free gift ----------------------------------------------------------------------------------
  giftBox(statics, 38, 0, -31, 1)
  solidBox(1.9, 1.7, 1.9, 38, 1.7, -31)
  live.giftLabel = addLabel({ pos: new Vector3(38, 5.6, -31), size: 1.3, max: 0.85, maxDist: 90, className: 'wl-shop', html: T('Free Gift', '#ffd23f', '...') })
  zones.push({ id: 'gift', kind: 'gift', x: 38, z: -27.6, r: 3.2 })

  // --- Portal ------------------------------------------------------------------------------------
  live.portal = portal(root, -22, 0, 96, Math.PI)
  solidBox(6.5, 0.5, 1.5, -22, 0.5, 96)
  addLabel({ pos: new Vector3(-22, 11.8, 96), size: 1.9, max: 1, maxDist: 140, className: 'wl-shop', html: T('CHOOSE A WORLD', '#ffe14a') })
  zones.push({ id: 'portal', kind: 'portal', x: -22, z: 93.5, r: 3.2 })

  // --- Leaderboards + next-world board on the south wall ----------------------------------------
  live.boards = [
    leaderboard(root, 0, 0, 98.6, Math.PI, 'Most money', '#3fc24a'),
    leaderboard(root, 7, 0, 98.6, Math.PI, 'Top speed', '#3f8cff'),
    leaderboard(root, 14, 0, 98.6, Math.PI, 'Most captures', '#ff4f6a'),
  ]
  for (const x of [0, 7, 14]) solidBox(2.4, 3.4, 0.4, x, 3.4, 98.6)
  zones.push({ id: 'boards', kind: 'boards', x: 7, z: 95, r: 6 }) // E: Bloxity's full leaderboards
  textBoard(root, 32, 0.8, 98.4, Math.PI, 11, 5.6, 360, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#1c3f9e')
    g.addColorStop(1, '#0e1f5c')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#ff8a1f'
    ctx.fillRect(0, 0, w, 70)
    signText(ctx, 'COMING SOON: SNOWY PEAKS', w / 2, 38, { size: 44, color: '#fff', outline: '#7a3500', width: 6 })
    signText(ctx, 'A frozen world of new animals', w / 2, 140, { size: 44, color: '#d8ecff', outline: null, font: 'Fredoka, sans-serif', weight: '700' })
    signText(ctx, 'Penguins, yaks, snow foxes and more', w / 2, 205, { size: 34, color: '#a9c8ff', outline: null, font: 'Fredoka, sans-serif', weight: '600' })
    signText(ctx, 'Earn 1M $ to be ready!', w / 2, 290, { size: 48, color: '#ffd23f', outline: '#3a2200', width: 6 })
  }, { frame: '#ff8a1f', depth: 0.6 })
  solidBox(5.6, 3.6, 0.5, 32, 3.6, 98.4)

  // --- The bases: one fenced pen + treadmill + signs per player slot (config BASES) ------------------
  // Every base is built for all ROOM_SIZE slots, so a remote player's pen and treadmill are always
  // there to look at. game/base.js drives the local player's; game/remoteBases.js the others'.
  live.bases = BASES.map((base) => buildBase(root, statics, zones, base))

  // --- Greenery ------------------------------------------------------------------------------------
  const deco = [
    [-52, 97, 'tree'], [46, 95, 'tree'], [51, 84, 'bush'], [-8, 96, 'bush'], [51, 56, 'bush'], [-52, -36, 'tree'], [52, -36, 'bush'],
    [-32, 64, 'bush'], [22, 92, 'bush'], [-36, 96, 'tree'], [44, 70, 'tree'], [-12, 70, 'bush'],
  ]
  for (const [x, z, kind] of deco) {
    if (inAnyPlot(x, z, 2)) continue
    if (kind === 'tree') {
      tree(statics, x, 0, z, 0.9)
      solidBox(0.5, 2, 0.5, x, 2, z)
    } else bush(statics, x, 0, z, 1)
  }
  for (let i = 0; i < 26; i++) {
    const x = HUB.minX + 4 + Math.random() * (HUB.maxX - HUB.minX - 8)
    const z = HUB.town.minZ + 2 + Math.random() * (HUB.town.maxZ - HUB.town.minZ - 4)
    if (inAnyPlot(x, z, 2)) continue
    flower(statics, x, 0, z)
  }

  root.add(bake(statics, true))
  root.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true
  })
  return { root, zones, live }
}


// One player's plot: the fenced pen (gate in its north fence, toward the band), troughs, the base
// marker, and in the strip north of it the treadmill (+ its sign and step label) and the pen-upgrade sign.
function buildBase(root, statics, zones, base) {
  const { minX, maxX, minZ, maxZ, gateX, slot } = base
  const w = maxX - minX
  const d = maxZ - minZ
  const midX = (minX + maxX) / 2
  const midZ = (minZ + maxZ) / 2
  penFence(statics, midX, 0, maxZ, 0, w)
  penFence(statics, (minX + gateX[0]) / 2, 0, minZ, 0, gateX[0] - minX)
  penFence(statics, (gateX[1] + maxX) / 2, 0, minZ, 0, maxX - gateX[1])
  penFence(statics, minX, 0, midZ, Math.PI / 2, d)
  penFence(statics, maxX, 0, midZ, Math.PI / 2, d)
  solidBox(w / 2, 1.1, 0.25, midX, 1.1, maxZ)
  solidBox((gateX[0] - minX) / 2, 1.1, 0.25, (minX + gateX[0]) / 2, 1.1, minZ)
  solidBox((maxX - gateX[1]) / 2, 1.1, 0.25, (gateX[1] + maxX) / 2, 1.1, minZ)
  solidBox(0.25, 1.1, d / 2, minX, 1.1, midZ)
  solidBox(0.25, 1.1, d / 2, maxX, 1.1, midZ)
  // Gate posts with a plank arch, so the way in reads from across the hub.
  for (const gx of gateX) block(statics, 0.6, 3.6, 0.6, '#8b5a2b', gx, 1.8, minZ)
  block(statics, gateX[1] - gateX[0] + 0.6, 0.5, 0.7, '#7a4b22', midX, 3.6, minZ)
  // Troughs, hay and a water tank inside (along the back fence).
  block(statics, 4, 0.8, 1.2, '#8b5a2b', minX + 4, 0.4, maxZ - 2)
  block(statics, 3.6, 0.2, 0.9, '#37b8f0', minX + 4, 0.75, maxZ - 2, { shadow: false })
  block(statics, 4, 0.8, 1.2, '#8b5a2b', maxX - 4, 0.4, maxZ - 2)
  block(statics, 3.6, 0.25, 0.9, '#f2cf3d', maxX - 4, 0.78, maxZ - 2, { shadow: false })
  block(statics, 1.2, 0.8, 4, '#8b5a2b', maxX - 2, 0.4, midZ)
  block(statics, 0.9, 0.25, 3.6, '#f2cf3d', maxX - 2, 0.78, midZ, { shadow: false })
  // The base marker (YOUR BASE / the owner's name / FREE BASE): game code writes its html.
  const marker = addLabel({ pos: new Vector3(midX, 10, midZ), size: 2.8, min: 0.3, max: 0.8, maxDist: 400, minDist: 8, className: 'wl-base', html: '' })
  const penZone = { id: `pen${slot}`, kind: 'pen', slot, minX: minX + 0.6, maxX: maxX - 0.6, minZ: minZ + 0.6, maxZ: maxZ - 0.6 }
  zones.push(penZone)

  // Upgrade-pen sign beside the gate, facing the band (the owner's: read-only on the others').
  const upgrade = canvasTexture(512, 300, (ctx, w2, h2, lvl = 1, price = '1K $', head = 'UPGRADE PEN') => {
    ctx.fillStyle = '#1d2a6b'
    ctx.fillRect(0, 0, w2, h2)
    signText(ctx, head, w2 / 2, 62, { size: head.length > 12 ? 44 : 58, color: '#fff', outline: null })
    signText(ctx, `LVL. ${lvl} > LVL. ${lvl + 1}`, w2 / 2, 140, { size: 50, color: '#fff', outline: null })
    ctx.fillStyle = '#3fc24a'
    ctx.beginPath()
    ctx.roundRect(110, 190, w2 - 220, 80, 16)
    ctx.fill()
    signText(ctx, price, w2 / 2, 232, { size: price.length > 8 ? 36 : 50, color: '#fff', outline: '#1d6b25', width: 6 })
  })
  const us = base.upgradeSign
  blueSign(statics, us.x, 0, us.z, Math.PI, 3.6, 2.1, upgrade.texture)
  solidBox(1.4, 1.5, 0.3, us.x, 1.5, us.z)
  const upgradeZone = { id: `upgradePen${slot}`, kind: 'upgradePen', slot, x: us.x, z: us.z - 2, r: 2.6 }
  zones.push(upgradeZone)

  // Treadmill (belt along z, motor hood toward the band) + its sign east of it.
  const tm = base.treadmill
  const mill = treadmill(root, tm.x, 0, tm.z, 0)
  const beltTex = makeBeltTexture()
  mill.userData.belt.material = new MeshStandardMaterial({ map: beltTex, roughness: 0.9 })
  solidBox(1.3, 0.21, 2.35, tm.x, 0.21, tm.z) // deck: its top is the belt (y 0.42)
  solidBox(1.32, 0.31, 0.4, tm.x, 0.31, tm.z - 2.72) // motor hood
  const tsign = canvasTexture(512, 300, (ctx, w2, h2, text = 'UNLOCK', line = 'TREADMILL', price = '100 $') => {
    ctx.fillStyle = '#1d2a6b'
    ctx.fillRect(0, 0, w2, h2)
    signText(ctx, text, w2 / 2, 60, { size: text.length > 12 ? 40 : 54, color: '#fff', outline: null })
    signText(ctx, line, w2 / 2, 132, { size: 60, color: '#fff', outline: null })
    ctx.fillStyle = '#3fc24a'
    ctx.beginPath()
    ctx.roundRect(110, 190, w2 - 220, 80, 16)
    ctx.fill()
    signText(ctx, price, w2 / 2, 232, { size: price.length > 8 ? 36 : 50, color: '#fff', outline: '#1d6b25', width: 6 })
  })
  blueSign(statics, tm.x + 4.2, 0, tm.z, -Math.PI / 2, 3.6, 2.1, tsign.texture)
  solidBox(0.3, 1.5, 1.4, tm.x + 4.2, 1.5, tm.z)
  const stepLabel = addLabel({ pos: new Vector3(tm.x, 4.6, tm.z), size: 1.3, max: 0.8, maxDist: 70, className: 'wl-step', html: '+1/STEP' })
  const treadZone = { id: `treadmill${slot}`, kind: 'treadmill', slot, minX: tm.x - 1, maxX: tm.x + 1, minZ: tm.z - 2.3, maxZ: tm.z + 2.3 }
  const signZone = { id: `treadmillSign${slot}`, kind: 'treadmillSign', slot, x: tm.x + 2.8, z: tm.z, r: 2.4 }
  zones.push(treadZone, signZone)

  return {
    base,
    marker,
    penZone,
    upgradeZone,
    treadZone,
    signZone,
    upgradeSign: upgrade,
    treadmillSign: tsign,
    stepLabel,
    belt: beltTex,
    mill: { group: mill, baseY: mill.position.y, ...mill.userData },
    // Treadmill animation state (game/treadmillFx.js).
    fx: { run: 0, t: 0, screenTimer: 0, flash: 0, banner: 0, blink: false, screen: { locked: true, steps: '0', perStep: '1', bonus: '0.0', next: 0, bpm: 72, run: 0, banner: '', blink: false } },
  }
}

// Belt UVs are world-scaled (kit STUD_SIZE = 0.42 m per unit): one slat every 0.42 / repeat m.
const BELT_REPEAT = 1.4
export const BELT_TILE = 0.42 / BELT_REPEAT
function makeBeltTexture() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const ctx = c.getContext('2d')
  // One rubber slat per tile (+ grit specks so the scroll reads without strobing).
  ctx.fillStyle = '#24262c'
  ctx.fillRect(0, 0, 64, 64)
  ctx.fillStyle = '#383b44'
  ctx.fillRect(0, 0, 64, 12)
  ctx.fillStyle = '#4a4e59'
  ctx.fillRect(0, 0, 64, 3)
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? '#2e3038' : '#1c1d22'
    ctx.fillRect(Math.random() * 64, 14 + Math.random() * 48, 2, 2)
  }
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(1, BELT_REPEAT)
  return t
}

// The marker floating over a pen: the house icon + a title ("YOUR BASE", an owner's name, "FREE BASE").
// `free` greys it (nobody owns that plot).
export function baseMarkerHtml(title, { free = false, color = '#2f86ff' } = {}) {
  const svg = HOUSE_SVG.replace('#2f86ff', free ? '#8d9099' : color)
  return `${svg}<div class="t"${free ? ' style="opacity:.7"' : ''}>${title.replace(/[<>&"]/g, '')}</div>`
}
