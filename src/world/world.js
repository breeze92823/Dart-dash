// The map: the hub plateau (checker grass, tan walls), the yellow aiming band on
// its north edge, the grass slope down to the lane (every area one after another
// between terraced cliffs, ending in a cliff face past the Volcano), clouds, and all
// static colliders. Each area's floor, cliff caps and terrace trees wear its look
// (areas.js). Props are placed by hub.js and lane.js; everything static is baked
// into a few merged meshes.
import { Group, IcosahedronGeometry, Mesh, MeshLambertMaterial, MeshStandardMaterial, PlaneGeometry, Vector2 } from 'three'
import { AREA_IDS, BAND, HUB, LANE, LANE_AREAS, SLOPE, areaAt } from '../config.js'
import { RAPIER, addFixed } from '../physics.js'
import { solidBox } from '../propkit.js'
import { bake } from '../bake.js'
import { mulberry32 } from '../textures.js'
import { block, checker, mat } from './kit.js'
import { AREAS } from './areas.js'

// Flat ground quad with a checker texture tiled every `tile` m.
function ground(parent, tex, x0, x1, z0, z1, y, tile) {
  const w = x1 - x0
  const d = z1 - z0
  const map = tex.map.clone()
  const normal = tex.normal.clone()
  map.repeat.set(w / tile, d / tile)
  normal.repeat.set(w / tile, d / tile)
  map.needsUpdate = normal.needsUpdate = true
  const m = new Mesh(new PlaneGeometry(w, d), new MeshStandardMaterial({ map, normalMap: normal, normalScale: new Vector2(0.45, 0.45), roughness: 0.82 }))
  m.rotation.x = -Math.PI / 2
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2)
  m.receiveShadow = true
  parent.add(m)
  return m
}

function makeClouds() {
  const rand = mulberry32(2024)
  const geo = new IcosahedronGeometry(1, 2)
  const mat = new MeshLambertMaterial({ color: '#ffffff', emissive: '#dcebff', emissiveIntensity: 0.6, fog: false, flatShading: true })
  const group = new Group()
  for (let i = 0; i < 26; i++) {
    const ang = rand() * Math.PI * 2
    const dist = 230 + rand() * 160
    const cloud = new Group()
    const puffs = 5 + Math.floor(rand() * 4)
    const len = 22 + rand() * 26
    for (let p = 0; p < puffs; p++) {
      const t = p / (puffs - 1) - 0.5
      const r = (1 - Math.abs(t) * 1.1) * (8 + rand() * 6)
      const puff = new Mesh(geo, mat)
      puff.scale.set(r, r * 0.7, r)
      puff.position.set(t * len, r * 0.2 + rand() * 3, (rand() - 0.5) * 8)
      cloud.add(puff)
    }
    cloud.position.set(Math.cos(ang) * dist, 55 + rand() * 60, Math.sin(ang) * dist - 40)
    cloud.lookAt(0, cloud.position.y, -40)
    group.add(cloud)
  }
  return group
}

// The look of the lane at z (the hub and slope count as the Meadow).
const lookAt = (z) => AREAS[areaAt(z) ?? 'meadow'] ?? AREAS.meadow
// A cliff cap in an area's colour (grass, moss, snow, ash...).
const cliffCap = (color) => mat(color, { rough: 0.85 })

// One terraced cliff tier: stone block with a dirt band and a cap in `cap` colour, plus a few
// stone ledges sticking out of the face for texture.
function cliffTier(parent, rand, x0, x1, z0, z1, yBottom, yTop, side = 1, cap = '#4bc93a') {
  const h = yTop - yBottom
  const w = x1 - x0
  const d = z1 - z0
  const stone = rand() < 0.5 ? '#6f7d8f' : '#768498'
  block(parent, w, h - 1.1, d, stone, (x0 + x1) / 2, yBottom + (h - 1.1) / 2, (z0 + z1) / 2, { rough: 0.9 })
  block(parent, w, 0.6, d, '#8a5a31', (x0 + x1) / 2, yTop - 0.8, (z0 + z1) / 2)
  block(parent, w + 0.3, 0.5, d, cliffCap(cap), (x0 + x1) / 2, yTop - 0.25, (z0 + z1) / 2)
  // Facets on the face toward the play area (side 1: the east face of the west cliffs; -1: the west face of the east cliffs).
  for (let i = 0; i < Math.floor(d / 6); i++) {
    const fz = z0 + 2 + rand() * (d - 4)
    const fh = 2 + rand() * Math.max(1, h - 4)
    block(parent, 0.8 + rand() * 0.8, fh, 2 + rand() * 4, rand() < 0.5 ? '#66748a' : '#7e8ca0', (side > 0 ? x1 + 0.2 : x0 - 0.2), yBottom + fh / 2 + rand() * 1.5, fz, { rough: 0.95 })
  }
}

export function buildWorld(scene) {
  const root = new Group()
  scene.add(root)
  scene.add(makeClouds())

  // --- Ground --------------------------------------------------------------------------------
  const grass = checker('#4cd33b', '#58dd45', { studsPerSquare: 7 })
  const slopeGrass = checker('#6ee456', '#7aea62', { studsPerSquare: 7 })
  const yellow = checker('#f7d64a', '#f0c836', { studsPerSquare: 6 })
  ground(root, grass, HUB.minX, HUB.maxX, BAND.z1, HUB.maxZ, 0, 6)
  ground(root, yellow, HUB.minX, HUB.maxX, BAND.z0, BAND.z1, 0, 4)
  // The lane floor: one stretch per area in its own checker (the Meadow tucks under the slope).
  for (const id of AREA_IDS) {
    const A = LANE_AREAS[id]
    const [a, b] = (AREAS[id] ?? AREAS.meadow).ground
    ground(root, checker(a, b, { studsPerSquare: 7 }), LANE.minX, LANE.maxX, A.minZ, A.maxZ + (A.index === 0 ? 0.5 : 0), LANE.y, 6)
  }
  const farZ = LANE.minZ // the lane ends here, at the foot of the end cliff

  // Slope: a tilted quad from the band edge down to the lane.
  const run = SLOPE.z0 - SLOPE.z1
  const drop = -LANE.y
  const len = Math.hypot(run, drop)
  const slope = ground(root, slopeGrass, HUB.minX, HUB.maxX, -len / 2, len / 2, 0, 6)
  slope.position.set(0, LANE.y / 2, (SLOPE.z0 + SLOPE.z1) / 2)
  slope.rotation.x = -Math.PI / 2 - Math.atan2(drop, run)
  // Yellow lip where the band meets the slope.
  block(root, HUB.maxX - HUB.minX, 0.25, 0.5, '#e8b92c', 0, 0.02, BAND.z0 + 0.1, { shadow: false })
  // Hub front face under the slope edge (hidden mostly; closes gaps at the sides).
  block(root, HUB.maxX - HUB.minX, 0.6, 0.4, '#e8b92c', 0, -0.3, BAND.z1 + 0.2, { shadow: false }).visible = false

  const statics = new Group()

  // --- Walls ------------------------------------------------------------------------------------
  const tan = checker('#f0b773', '#f6c58a', { studsPerSquare: 6 })
  const wallMat = (w, h) => {
    const m = tan.map.clone()
    const n = tan.normal.clone()
    m.repeat.set(w / 5, h / 5)
    n.repeat.set(w / 5, h / 5)
    m.needsUpdate = n.needsUpdate = true
    return new MeshStandardMaterial({ map: m, normalMap: n, normalScale: new Vector2(0.5, 0.5), roughness: 0.85 })
  }
  const H = HUB.wallHeight
  const south = new Mesh(new PlaneGeometry(HUB.maxX - HUB.minX + 4, H), wallMat(HUB.maxX - HUB.minX, H))
  south.position.set(0, H / 2, HUB.maxZ)
  south.rotation.y = Math.PI
  south.receiveShadow = true
  root.add(south)
  const east = new Mesh(new PlaneGeometry(HUB.maxZ - BAND.z0 + 2, H), wallMat(HUB.maxZ - BAND.z0, H))
  east.position.set(HUB.maxX, H / 2, (HUB.maxZ + BAND.z0) / 2)
  east.rotation.y = -Math.PI / 2
  east.receiveShadow = true
  root.add(east)
  // Wall thickness + green cap.
  block(statics, HUB.maxX - HUB.minX + 4, 0.8, 2, '#4bc93a', 0, H + 0.4, HUB.maxZ + 0.9)
  block(statics, 2, 0.8, HUB.maxZ - BAND.z0 + 2, '#4bc93a', HUB.maxX + 0.9, H + 0.4, (HUB.maxZ + BAND.z0) / 2)
  block(statics, HUB.maxX - HUB.minX + 4, 1, 0.4, '#e7b04a', 0, 0.5, HUB.maxZ - 0.2) // skirting
  block(statics, 0.4, 1, HUB.maxZ - BAND.z0, '#e7b04a', HUB.maxX - 0.2, 0.5, (HUB.maxZ + BAND.z0) / 2)
  solidBox((HUB.maxX - HUB.minX) / 2 + 2, H / 2, 1, 0, H / 2, HUB.maxZ + 1)
  solidBox(1, H / 2, (HUB.maxZ - BAND.z0) / 2 + 1, HUB.maxX + 1, H / 2, (HUB.maxZ + BAND.z0) / 2)

  // Invisible walls along the lane's east side and past its far end (the cliffs below are the
  // visible edge).
  const LW = LANE.wallHeight
  const eastLen = BAND.z0 - farZ
  solidBox(1, LW / 2, eastLen / 2, LANE.maxX + 1, LANE.y + LW / 2, (BAND.z0 + farZ) / 2)
  solidBox((LANE.maxX - LANE.minX) / 2 + 30, LW / 2, 1, (LANE.minX + LANE.maxX) / 2, LANE.y + LW / 2, farZ - 1)
  // The east hub wall continues down to the lane floor beside the slope.
  block(statics, 0.6, -LANE.y + 0.5, BAND.z0 - SLOPE.z1 + 0.5, '#57e03c', HUB.maxX + 0.3, LANE.y / 2, (BAND.z0 + SLOPE.z1) / 2)

  // --- Terraced cliffs along the whole west side (lane + hub) ---------------------------------
  const rand = mulberry32(77)
  const tiers = [
    [-63, -55, 4],
    [-72, -63, 10],
    [-83, -72, 16],
    [-96, -83, 22],
  ]
  const zStart = farZ - 10
  const zEnd = HUB.maxZ + 10
  // Cliff segments break at the area borders so each area's caps wear its own colour.
  const borders = AREA_IDS.map((id) => LANE_AREAS[id].maxZ).sort((a, b) => a - b)
  const nextBorder = (z) => borders.find((b) => b > z + 0.01) ?? Infinity
  const cliffRun = (r, tierList, z0, z1End, side) => {
    for (let z = z0; z < z1End; ) {
      const z1 = Math.min(z1End, z + 14 + r() * 10, nextBorder(z))
      const cap = lookAt((z + z1) / 2).cliff
      for (const [x0, x1, top] of tierList) {
        const jx = (r() - 0.5) * 2
        const jt = Math.round((r() - 0.5) * 2)
        cliffTier(statics, r, x0 + jx, x1 + jx, z, z1, LANE.y, top + jt, side, cap)
      }
      z = z1
    }
  }
  // Trees on the terraces, in the look of the area beside them.
  const treesGroup = new Group()
  const terraceTree = (r, x, top, z) => {
    const look = lookAt(z)
    if (r() < 0.62) look.pine(treesGroup, x, top, z, 0.9 + r() * 0.5)
    else look.tree(treesGroup, x, top, z, 0.8 + r() * 0.4)
  }
  cliffRun(rand, tiers, zStart, zEnd, 1)
  // Colliders: the first tier is the wall the player meets.
  solidBox(4, 12, (zEnd - zStart) / 2, HUB.minX - 4, LANE.y + 12, (zStart + zEnd) / 2)
  for (let i = 0; i < 120; i++) {
    const t = Math.floor(rand() * tiers.length)
    const [x0, x1, top] = tiers[t]
    const x = x0 + 1.5 + rand() * (x1 - x0 - 3)
    terraceTree(rand, x, top, zStart + rand() * (zEnd - zStart))
  }
  statics.add(treesGroup)

  // The same terraced cliffs along the lane's east side (the hub's tan wall covers the rest) and
  // across the far end past the Volcano, where the lane ends in a cliff face.
  const rand2 = mulberry32(88)
  const eastTiers = tiers.map(([x0, x1, top]) => [-x1, -x0, top])
  cliffRun(rand2, eastTiers, farZ - 10, BAND.z0 + 4, -1)
  const stoneEnd = ['#6f7d8f', '#768498']
  const endCap = lookAt(farZ).cliff
  for (const [i, [d0, d1, top]] of [[0, 8, 4], [8, 18, 10], [18, 30, 16], [30, 44, 22]].entries()) {
    const x0 = HUB.minX - 40
    const x1 = LANE.maxX + 40
    const zc = farZ - (d0 + d1) / 2
    block(statics, x1 - x0, top - LANE.y - 1.1, d1 - d0, stoneEnd[i % 2], (x0 + x1) / 2, LANE.y + (top - LANE.y - 1.1) / 2, zc, { rough: 0.9 })
    block(statics, x1 - x0, 0.6, d1 - d0, '#8a5a31', (x0 + x1) / 2, top - 0.8, zc)
    block(statics, x1 - x0, 0.5, d1 - d0 + 0.3, cliffCap(endCap), (x0 + x1) / 2, top - 0.25, zc)
  }
  for (let i = 0; i < 40; i++) {
    const z = farZ - 2 - rand2() * 40
    const x = HUB.minX - 30 + rand2() * (LANE.maxX - HUB.minX + 60)
    const top = z > farZ - 8 ? 4 : z > farZ - 18 ? 10 : z > farZ - 30 ? 16 : 22
    terraceTree(rand2, x, top, z)
  }
  for (let i = 0; i < 70; i++) {
    const t = Math.floor(rand2() * eastTiers.length)
    const [x0, x1, top] = eastTiers[t]
    const z = farZ + rand2() * (BAND.z0 - farZ)
    const x = x0 + 1.5 + rand2() * (x1 - x0 - 3)
    terraceTree(rand2, x, top, z)
  }

  // --- Physics: plateau, slope, lane floor --------------------------------------------------
  const hw = (HUB.maxX - HUB.minX) / 2
  solidBox(hw, 4, (HUB.maxZ - BAND.z0) / 2, 0, -4, (HUB.maxZ + BAND.z0) / 2)
  const ang = Math.atan2(drop, run)
  // Top face on the slope quad: centre pushed 0.5 m down along the slope normal (0, cos, -sin).
  addFixed(
    RAPIER.ColliderDesc.cuboid(hw, 0.5, len / 2 + 0.6),
    { x: 0, y: LANE.y / 2 - 0.5 * Math.cos(ang), z: (SLOPE.z0 + SLOPE.z1) / 2 + 0.5 * Math.sin(ang) },
    { x: Math.sin(-ang / 2), y: 0, z: 0, w: Math.cos(ang / 2) },
    { friction: 0.9 },
  )
  solidBox((LANE.maxX - LANE.minX) / 2 + 30, 1, (LANE.maxZ - farZ) / 2 + 2, (LANE.minX + LANE.maxX) / 2, LANE.y - 1, (farZ + LANE.maxZ) / 2)
  // Invisible wall where the plateau meets the cliffs' foot and along the east side.
  solidBox(0.5, 20, (HUB.maxZ - farZ) / 2, HUB.minX - 0.4, 10, (HUB.maxZ + farZ) / 2)

  const baked = bake(statics, true)
  baked.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true
  })
  root.add(baked)
  return { root }
}
