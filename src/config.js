// Every tunable constant lives here; the rest of src/ holds no theme values.

// --- Identity -------------------------------------------------------------
export const GAME_SLUG = 'dart-dash' // slug registered on bloxity.io
export const GAME_TITLE = 'Dart Dash'

// Forces the Bloxity SDK and avatar CDN to be treated as unavailable (see .env.example).
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'

// --- World (metres: +X east, +Z south, +Y up) -------------------------------
export const GROUND_Y = 0
export const SPAWN = { x: 0, y: 0.05, z: 56 } // the town's north edge (main.js moves your spawn to your own base)
export const SPAWN_FACING = Math.PI // yaw the character faces on spawn (PI = toward -Z, the lane)

// --- Player modes (modes.js) -------------------------------------------------
// 'character' = third-person chase cam with the avatar on screen.
// 'player' = first-person, the camera is the player's eyes and the avatar is hidden.
export const MODES = ['character', 'player']
export const START_MODE = 'character'

// --- Physics (physics.js, player.js) ------------------------------------------
export const PHYSICS = {
  gravity: -22, // m/s^2 for dynamic bodies and the player
  fixedStep: 1 / 60, // s per physics tick; rendering interpolates between ticks
  maxSubSteps: 5, // a long frame never runs more ticks than this
  walkSpeed: 9, // m/s
  sprintSpeed: 15, // m/s with Shift held
  accel: 70, // m/s^2 toward the target velocity on the ground
  airAccel: 22, // m/s^2 steering while airborne
  decel: 60, // m/s^2 when no key is held
  turnSpeed: 12, // rad/s the body turns toward its heading
  jumpSpeed: 8.5, // m/s
  coyoteTime: 0.1, // s after leaving a ledge a jump still counts
  jumpBuffer: 0.12, // s a jump pressed before landing is remembered
  stepHeight: 0.45, // m autostep
  maxSlope: 50, // degrees the player can walk up
  snapToGround: 0.4, // m the controller stays glued to downward steps and slopes
  pushMass: 80, // kg the character weighs when shoving crates
  killY: -30, // fell this far: respawn
}
export const PLAYER_DIMS = { radius: 0.75, height: 1.8 } // capsule the character controller moves

// --- Look ------------------------------------------------------------------
export const RENDER = { exposure: 1.0 }
// Normal view distance: kept short (far lane areas past `far` are not drawn at all, main.js
// `applyView`). Scoping in pushes it out to the weapon's range (AIM.scopeView) so a far area can
// be aimed at clearly.
export const FOG = { near: 100, far: 230 }
// The two lighting moods lighting.js blends between (key N toggles).
export const TIME_OF_DAY = {
  transition: 2.5, // s to blend day <-> night
  day: {
    zenith: '#1576f0',
    horizon: '#a9e2ff',
    sunColor: '#fff4de',
    // Sun + hemi + env together keep the pale sand (#eed39c) near its own tan;
    // much more and ACES washes it (and the props) out to grey-white.
    sunIntensity: 2.4,
    sunElevation: 55, // degrees above the horizon
    sunAzimuth: 35, // degrees, 0 = from +Z
    hemiSky: '#e4f2ff',
    hemiGround: '#8fcf6a',
    hemiIntensity: 0.8,
    envIntensity: 0.45,
    lampIntensity: 0,
    stars: 0,
    exposure: 0.95,
  },
  night: {
    zenith: '#050b22',
    horizon: '#24345e',
    sunColor: '#9fb4ff', // the moon
    sunIntensity: 0.55,
    sunElevation: 38,
    sunAzimuth: -60,
    hemiSky: '#3a4c80',
    hemiGround: '#1a1a22',
    hemiIntensity: 0.35,
    envIntensity: 0.25,
    lampIntensity: 30,
    stars: 1,
    exposure: 1.15,
  },
}
export const LIGHT = {
  shadowRange: 40, // half-width of the sun's shadow box around the player
  lampColor: '#ffb35c',
  lampDistance: 22,
}

// Default (fallback) character look, used only when player.glb cannot load.
export const CHARACTER_COLORS = { skin: '#f2c79a', suit: '#26282e', hair: '#8a4a22' }

export const MATERIAL_PBR = {
  PLAYER: { roughness: 0.7, metalness: 0 },
  GROUND: { roughness: 0.95, metalness: 0 },
}

// --- Graphics presets, picked by the Bloxity graphics_quality setting ----------
export const GRAPHICS_PRESETS = {
  Low: { shadows: false, shadowMap: 512, antialias: false, dpr: 1, bloom: false, particles: 0.35 },
  Medium: { shadows: true, shadowMap: 1024, antialias: false, dpr: 1.25, bloom: false, particles: 0.6 },
  High: { shadows: true, shadowMap: 2048, antialias: true, dpr: 2, bloom: true, particles: 1 },
  Ultra: { shadows: true, shadowMap: 4096, antialias: true, dpr: 2, bloom: true, particles: 1 },
}

// Bloom (postfx.js): only HDR-bright pixels (above threshold, linear, before
// tone mapping) glow: neon rails, waterfall, VIP gate, particles. Sunlit sand
// stays under the threshold.
export const BLOOM = { strength: 0.6, radius: 0.35, threshold: 2.0 }
// Neon materials (propkit.js): k = HDR colour multiplier with bloom on; with
// bloom off they are capped at plainMax so they stay coloured, not white.
export const NEON = { k: 3.5, plainMax: 1.2 }

// Phones and tablets default to a lighter preset when the portal sends no value,
// and any preset is capped there (a phone at DPR 3 renders 9x the pixels; bloom
// is a full-screen multi-pass blur, so it stays off on phones).
export const COARSE_POINTER = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
export const DEFAULT_GRAPHICS = COARSE_POINTER ? 'Medium' : 'High'
export const MOBILE_GRAPHICS_CAP = { dpr: 1.5, shadowMap: 1024, particles: 0.6 }

// The preset to render with on this device.
export function graphicsPreset(name) {
  const p = GRAPHICS_PRESETS[name] ?? GRAPHICS_PRESETS[DEFAULT_GRAPHICS]
  if (!COARSE_POINTER) return p
  const cap = MOBILE_GRAPHICS_CAP
  return { ...p, dpr: Math.min(p.dpr, cap.dpr), shadowMap: Math.min(p.shadowMap, cap.shadowMap), bloom: false, particles: Math.min(p.particles, cap.particles) }
}

// --- Touch controls (touch.js) --------------------------------------------------
export const TOUCH = {
  deadZone: 0.12, // fraction of the joystick radius that does nothing
  lookScale: 1.5, // touch drag pixels -> look, relative to a mouse pixel
  pinchPixelsPerNotch: 30, // finger spread change that equals one wheel notch
}

// --- Camera (camera.js) -------------------------------------------------------
export const CAMERA = {
  fov: 70,
  near: 0.1,
  far: 1200,
  startPitch: 0.14, // radians above the horizon (low chase cam)
  minPitch: -0.35,
  maxPitch: 1.25,
  firstPersonPitch: 1.45, // |pitch| limit looking up/down in player mode
  eyeHeight: 0.92, // eye height as a fraction of player height (player mode)
  distance: 12.4, // resting boom length, m
  minDistance: 2.5, // wheel in past this enters player mode
  maxDistance: 26,
  followLerp: 14, // 1/s: the one smoothing stage, on the point the camera follows
  targetHeight: 1.2, // look-at point as a fraction of player height
  lookSensitivity: 0.0026, // rad per pixel of mouse movement
  zoomStep: 0.9, // m per wheel notch
  zoomEase: 12, // 1/s the zoom glides to its target
  speedFov: 6, // degrees the FOV widens at sprint speed
  speedEase: 3, // 1/s the speed framing eases in and out
  clearEase: 6, // 1/s the boom eases back out once a wall stops blocking it
}

// --- Bloxity (bloxity.js, avatar/) -------------------------------------------------
// SDK setting keys this game listens for; registering a listener makes the control
// appear in the portal's settings menu.
export const SETTINGS = {
  graphics_quality: { def: DEFAULT_GRAPHICS, type: 'enum', values: ['Low', 'Medium', 'High', 'Ultra'] },
  camera_sensitivity: { def: '1', type: 'number', min: 0.1, max: 5 },
  show_fps: { def: 'false', type: 'bool' },
  fullscreen: { def: 'false', type: 'bool' },
}

// The base rig, measured from player.glb: origin at the feet, 6.4 units tall at bind pose.
export const RIG_HEIGHT = 6.4
// Bind-pose values of the rig nodes the SDK proportions drive.
export const RIG = { armOffsetX: 2, legOffsetX: 0.6, neckOffsetY: 0.6 }
// getProportions() ranges, straight from the SDK spec; clamped before they reach the scene graph.
export const PROPORTIONS = {
  height: { def: 1, min: 0.5, max: 1.6 },
  shoulderWidth: { def: 1, min: 0.5, max: 1.5 },
  armLength: { def: 1, min: 0.05, max: 3 },
  legOffsetX: { def: 1, min: -0.7, max: 5 },
  torsoScaleX: { def: 1, min: 0.3, max: 2 },
  neckHeight: { def: 1, min: 0.94, max: 1.2 },
  headScale: { def: 1, min: 0.3, max: 2.6 },
}

// Procedural animation (avatar/animator.js), ported from Clean Leaves for Loot.
// Rotations are radians in CHARACTER space: +X swings a limb backward, +Y yaws, +Z rolls.
const deg = (d) => (d * Math.PI) / 180
export const ANIM = {
  airborneDelay: 0.07, // s off the ground before the air pose (ignores a step down a ledge)
  // Walk -> run is one cycle at two depths; phase advances with distance travelled.
  locomotion: {
    minFrequency: 0.7,
    maxFrequency: 3.6,
    strideDistance: 3.8, // m per cycle
    idleSpeed: 0.6,
    walkSpeed: 2.5,
    runSpeed: 8,
    sprintSpeed: 13,
    hipSwing: { walk: deg(22), run: deg(42), sprint: deg(56) },
    kneeBend: { walk: deg(30), run: deg(58), sprint: deg(72) },
    armSwing: { walk: deg(18), run: deg(36), sprint: deg(52) },
    elbowBend: { walk: deg(14), run: deg(44), sprint: deg(70) },
    torsoTwist: { walk: deg(4), run: deg(7), sprint: deg(9) },
    torsoLean: { walk: deg(3), run: deg(10), sprint: deg(18) },
    headCounterTwist: { walk: deg(2), run: deg(4), sprint: deg(5) },
    torsoRoll: { walk: deg(2), run: deg(3), sprint: deg(3) },
    bob: { walk: 0.03, run: 0.07, sprint: 0.09 }, // m, on the avatar root
    bankAngle: deg(9),
    bankRate: 8,
  },
  idle: {
    breathFrequency: 0.35,
    breathAmount: deg(1.8),
    breathBob: 0.007,
    basePose: {
      ArmL1: { x: deg(-4), z: deg(8) },
      ArmL2: { x: deg(12) },
      ArmR1: { x: deg(-4), z: deg(-8) },
      ArmR2: { x: deg(12) },
      LegL1: { x: deg(-4) },
      LegR1: { x: deg(4) },
    },
  },
  airborne: {
    rise: {
      LegL1: { x: deg(-38) }, LegR1: { x: deg(8) }, LegL2: { x: deg(62) }, LegR2: { x: deg(40) },
      ArmL1: { x: deg(-40), z: deg(34) }, ArmR1: { x: deg(-30), z: deg(-34) },
      ArmL2: { x: deg(30) }, ArmR2: { x: deg(30) }, Spine1: { x: deg(6) },
    },
    fall: {
      LegL1: { x: deg(-14) }, LegR1: { x: deg(10) }, LegL2: { x: deg(22) }, LegR2: { x: deg(18) },
      ArmL1: { x: deg(-70), z: deg(40) }, ArmR1: { x: deg(-60), z: deg(-40) },
      ArmL2: { x: deg(20) }, ArmR2: { x: deg(20) }, Spine1: { x: deg(-4) },
    },
    velocityReference: 8, // m/s vertical speed that reads as fully rising / falling
  },
  landing: {
    duration: 0.16,
    pose: {
      LegL1: { x: deg(-34) }, LegR1: { x: deg(-34) }, LegL2: { x: deg(58) }, LegR2: { x: deg(58) },
      ArmL1: { x: deg(-18), z: deg(20) }, ArmR1: { x: deg(-18), z: deg(-20) }, Spine1: { x: deg(14) },
    },
    bobY: -0.2,
  },
  transitions: { toLocomotion: 0.14, toAirborne: 0.12, toLanding: 0.06 }, // s to blend a pose change
}

export const FONT_FAMILY = 'Fredoka'

export function clamp(n, min, max) {
  return n < min ? min : n > max ? max : n
}

// Coerce one raw SDK string against its SETTINGS entry.
export function coerceSetting(key, raw) {
  const spec = SETTINGS[key]
  if (!spec) return raw
  const value = raw === '' || raw == null ? spec.def : raw
  if (spec.type === 'bool') return value === 'true' || value === true
  if (spec.type === 'enum') return spec.values.includes(value) ? value : spec.def
  const n = Number(value)
  return clamp(Number.isFinite(n) ? n : Number(spec.def), spec.min, spec.max)
}

// =====================================================================================
// Dart Dash: the game itself. Everything below is gameplay tuning.
// =====================================================================================

// Distances shown to the player are in studs (the scope readout, weapon ranges).
export const STUD = 0.3 // m per stud

// --- World layout (world/*.js) ---------------------------------------------------------
// The hub is a flat plateau at y = 0. Its north edge is the yellow aiming band; past it a
// grass slope drops to the lane at LANE.y. The lane holds every area (WORLDS) one after the
// other, AREA_DEPTH m each: Meadow at the foot of the slope, then Marsh, Forest, Mountain and
// Volcano, which ends at the terraced cliff face. Green barriers between them open with guns.
export const HUB = {
  minX: -55, maxX: 55, minZ: -42, maxZ: 100, // plateau extent (the band is part of it)
  // North to south: the band, the front row (Next Event sign, events board, Dart Shop, gift; z -38..-22),
  // the six bases (z -22..50), the town (other shops, portal) and the leaderboards on the south wall.
  town: { minZ: 52, maxZ: 98 },
  tile: 8, // m per checker tile (two squares)
  wallHeight: 13,
}
export const BAND = { z0: -42, z1: -38.2 } // the yellow band: z from z0 (lane edge) to z1 (hub side)
// Grass slope from the band down to the lane floor (16 m down over 33 m). The lane lies this deep
// so the band looks DOWN the lane: aiming from ~18 m up clears the props in front of far animals.
export const SLOPE = { z0: -42, z1: -75 }
export const AREA_DEPTH = 70 // m of lane per area (5 areas: z -75 .. -425)
const AREA_COUNT = 5 // = Object.keys(WORLDS).length
export const LANE = {
  y: -16,
  minX: -55, maxX: 55, minZ: SLOPE.z1 - AREA_DEPTH * AREA_COUNT, maxZ: SLOPE.z1,
  // Animals roam |x| <= roamX; tall props (trees, pines) stand in the strips treeX[0]..treeX[1]
  // along both sides so the view down the lane to the far areas stays open.
  roamX: 34,
  treeX: [37, 51],
  // Whole-lane roaming bounds (each area narrows z to its own stretch, LANE_AREAS).
  spawn: { minX: -34, maxX: 34, minZ: SLOPE.z1 - AREA_DEPTH * AREA_COUNT + 5, maxZ: SLOPE.z1 - 7 },
  wallHeight: 42,
}
// The green barriers between areas (world/barrier.js): a glowing force field at the far end of
// each area with a big sign naming the next area and the gun that opens it. Owning the gun
// opens it (field, sign and collider go; the edge pylons stay as a gate).
export const BARRIER = { height: 26, sign: { w: 48, h: 16, y: 5 } }
// One room holds ROOM_SIZE players (the backend's ROOM_MAX_CLIENTS, keep them equal) and every
// player owns one of ROOM_SIZE bases, laid out in the hub's east half as a 2 x 3 grid of plots.
// A plot = a fenced pen (its gate in the west fence) + the owner's treadmill and the pen-upgrade
// sign in the strip west of it. The server hands out the slot (0..ROOM_SIZE-1) when you join.
export const ROOM_SIZE = 6
// The bases sit between the front row (Next Event sign) and the town / leaderboards: 3 columns x
// 2 rows. Each plot = an 8 m strip with the owner's treadmill and pen-upgrade sign, then a 31 x 28 m
// fenced pen whose gate is in its NORTH fence (facing the band, so a carry home stays short).
// 6.5 m aisles between the columns lead from the town up to the band.
export const PLOT = { penW: 31, penD: 28, strip: 8, aisle: 6.5, x0: -53, rowZ: [-14, 22] }
function makeBase(slot) {
  const minX = PLOT.x0 + (slot % 3) * (PLOT.penW + PLOT.aisle)
  const minZ = PLOT.rowZ[Math.floor(slot / 3)]
  const maxX = minX + PLOT.penW
  const maxZ = minZ + PLOT.penD
  const midX = (minX + maxX) / 2
  return {
    slot,
    plot: { minX, maxX, minZ: minZ - PLOT.strip, maxZ },
    minX, maxX, minZ, maxZ, // the fenced pen
    gateX: [midX - 4, midX + 4], // gap in the north fence
    treadmill: { x: minX + 4, z: minZ - 3.6 },
    upgradeSign: { x: maxX - 5, z: minZ - 4.5 },
    // Where its owner appears (in front of the gate, facing the band).
    spawn: { x: midX, y: 0.05, z: minZ - 4.5 },
    facing: Math.PI,
  }
}
export const BASES = Array.from({ length: ROOM_SIZE }, (_, i) => makeBase(i))
export const BASE = BASES[0] // legacy default (a session without a server owns slot 0)
export const inAnyPlot = (x, z, pad = 0) => BASES.some((b) => x > b.plot.minX - pad && x < b.plot.maxX + pad && z > b.plot.minZ - pad && z < b.plot.maxZ + pad)

// --- Rarities, worlds + animals (game/animals.js, ui/panels.js Index) -----------------------------
// Every world has one animal of each rarity (the Index shows them as grey, green, blue, purple,
// yellow and red cards). Every world is an area of the lane (LANE_AREAS, in WORLDS order) that
// spawns its own six animals; the Halloween season mixes its own animals into every area.
export const RARITIES = {
  common: { name: 'Common', color: '#f4f4f4', card: '#8d9099', tier: 0 },
  uncommon: { name: 'Uncommon', color: '#8dff6a', card: '#3fc24a', tier: 1 },
  rare: { name: 'Rare', color: '#55c8ff', card: '#2f7fe8', tier: 2 },
  epic: { name: 'Epic', color: '#e07bff', card: '#b24de8', tier: 3 },
  legendary: { name: 'Legendary', color: '#ffd23f', card: '#f2b33a', tier: 4 },
  mythic: { name: 'Mythic', color: '#ff5a5a', card: '#e8483f', tier: 5 },
}
// Per rarity: "1 in N" spawn odds, base $/s range (times the world's mult), hits to put it to sleep.
const R_ODDS = { common: 3, uncommon: 7, rare: 25, epic: 120, legendary: 600, mythic: 3000 }
const R_INCOME = { common: [3, 8], uncommon: [12, 30], rare: [60, 140], epic: [400, 900], legendary: [3000, 6000], mythic: [25000, 50000] }
const R_HP = { common: 1, uncommon: 1, rare: 2, epic: 2, legendary: 3, mythic: 5 }
// The worlds, in portal order: income multiplier, the weapon that unlocks it (Armory; any
// stronger weapon works too), and the Index reward for discovering all six of
// its animals ($ + speed = treadmill steps + that world's aura).
// Each world's look in the lane (ground, cliff caps, props, pond) lives in world/areas.js AREAS.
export const WORLDS = {
  meadow: { name: 'Meadow', mult: 1, weapon: 'blowpipe', reward: { money: 9000, steps: 200 } },
  marsh: { name: 'Marsh', mult: 8, weapon: 'rifle', reward: { money: 400000, steps: 1000 } },
  forest: { name: 'Forest', mult: 60, weapon: 'carbine', reward: { money: 3e7, steps: 5000 } },
  mountain: { name: 'Mountain', mult: 450, weapon: 'sniper', reward: { money: 2e9, steps: 30000 } },
  volcano: { name: 'Volcano', mult: 3500, weapon: 'voidReaper', reward: { money: 1.5e11, steps: 500000 } },
}
export const START_WORLD = 'meadow'
// Each world's stretch of the lane (north = -z): z from minZ (its far end, where the barrier to
// the next area stands) to maxZ, where its animals roam (`spawn`) and its pond (`pond`).
export const AREA_IDS = Object.keys(WORLDS)
const POND_X = [-22, 22, -20, 20, -22]
export const LANE_AREAS = Object.fromEntries(
  AREA_IDS.map((id, i) => {
    const maxZ = LANE.maxZ - i * AREA_DEPTH
    const minZ = maxZ - AREA_DEPTH
    return [id, {
      id,
      index: i,
      minZ,
      maxZ,
      spawn: { minX: -LANE.roamX, maxX: LANE.roamX, minZ: minZ + 5, maxZ: maxZ - (i === 0 ? 7 : 5) },
      pond: { x: POND_X[i], z: (minZ + maxZ) / 2 + (i % 2 ? -6 : 4), r: 10 },
    }]
  }),
)
// The area a lane z lies in (null on the hub / slope).
export function areaAt(z) {
  if (z > LANE.maxZ) return null
  const i = Math.min(AREA_IDS.length - 1, Math.max(0, Math.floor((LANE.maxZ - z) / AREA_DEPTH)))
  return AREA_IDS[i]
}
// Voxel body each animal is built from (game/animalModels.js) and its physical defaults:
// speed m/s wandering (flee x2.2), weight = carry speed multiplier, radius = hit sphere (m, x scale).
const MODELS = {
  chicken: { speed: 2.2, weight: 1, radius: 0.55 },
  rabbit: { speed: 3.2, weight: 1, radius: 0.5 },
  turkey: { speed: 2.4, weight: 0.95, radius: 0.7 },
  goat: { speed: 2.6, weight: 0.9, radius: 0.85 },
  sheep: { speed: 2.2, weight: 0.88, radius: 0.9 },
  pig: { speed: 2.4, weight: 0.86, radius: 0.85 },
  cow: { speed: 2, weight: 0.75, radius: 1.25 },
  deer: { speed: 4.4, weight: 0.82, radius: 1 },
  fox: { speed: 5, weight: 0.9, radius: 0.7 },
  heron: { speed: 2, weight: 0.9, radius: 0.8 },
  boar: { speed: 3.2, weight: 0.72, radius: 1.2 },
}
// [id, name, call (pops on a sleeping hit), model, rarity, extra]. extra: recolor { modelHex: hex },
// scale, zone ('marsh' keeps it near the pond).
const ROSTER = {
  meadow: [
    ['chicken', 'Chicken', 'BAWK', 'chicken', 'common'],
    ['rabbit', 'Bunny', 'EEP', 'rabbit', 'uncommon'],
    ['sheep', 'Sheep', 'BAAH', 'sheep', 'rare'],
    ['cow', 'Meadow Bull', 'MOOH', 'cow', 'epic'],
    ['deer', 'Deer', 'BLEAT', 'deer', 'legendary'],
    ['boar', 'Boar', 'SNORT', 'boar', 'mythic'],
  ],
  marsh: [
    ['mallard', 'Marsh Duck', 'QUACK', 'chicken', 'common', { recolor: { '#f6f4ef': '#8a6a44', '#e7e3da': '#6e5232', '#e8642c': '#2f8a4a', '#c9471e': '#246b39', '#ffffff': '#c9b28a', '#f0a52a': '#c9b28a', '#e3262e': '#2f8a4a', '#1f5a3c': '#3a3a3a', '#2b9a6a': '#5a5a5a' } }],
    ['mudPig', 'Mud Pig', 'OINK', 'pig', 'uncommon', { recolor: { '#f6a6b6': '#9a6a4a', '#f08aa0': '#7a5034' } }],
    ['muskrat', 'Muskrat', 'SQUEAK', 'rabbit', 'rare', { recolor: { '#3e4a6b': '#6a4a30', '#b8b2a8': '#6a4a30', '#f2f2f2': '#c9a27a', '#d8262e': '#3a7a3a' } }],
    ['heron', 'Grey Heron', 'KRAAK', 'heron', 'epic', { zone: 'marsh' }],
    ['bogMoose', 'Bog Moose', 'HRUUM', 'deer', 'legendary', { scale: 1.25, recolor: { '#b9733a': '#4a3222', '#f3dfc0': '#8a6a4a' } }],
    ['swampTusker', 'Swamp Tusker', 'GRUNT', 'boar', 'mythic', { recolor: { '#5a3a26': '#3f5a2a', '#2e1d12': '#24361a', '#3e271a': '#2a3d1c', '#c98a74': '#7a9a5a' } }],
  ],
  forest: [
    ['squirrel', 'Acorn Squirrel', 'CHITTER', 'fox', 'common', { scale: 0.6, recolor: { '#f0761e': '#a8622e', '#ffffff': '#e9d2b0' } }],
    ['turkey', 'Turkey', 'GOBBLE', 'turkey', 'uncommon'],
    ['pig', 'Truffle Pig', 'OINK', 'pig', 'rare'],
    ['fox', 'Fox', 'YIP', 'fox', 'epic'],
    ['stag', 'Forest Stag', 'BELL', 'deer', 'legendary', { scale: 1.15, recolor: { '#b9733a': '#8a4f22' } }],
    ['bear', 'Grizzly', 'GROWL', 'boar', 'mythic', { scale: 1.3, recolor: { '#5a3a26': '#6b4423', '#2e1d12': '#4a2e18', '#fff6dc': '#6b4423', '#c98a74': '#3a2414' } }],
  ],
  mountain: [
    ['goat', 'Mountain Goat', 'MEEH', 'goat', 'common'],
    ['ram', 'Bighorn Ram', 'BRAAH', 'sheep', 'uncommon', { recolor: { '#fbfbf6': '#b8a68a', '#ffffff': '#c9b89a', '#2c2c30': '#6a5a48' } }],
    ['yak', 'Shaggy Yak', 'GRUNT', 'cow', 'rare', { recolor: { '#f6f6f2': '#3a2e28', '#1f1f24': '#5a4a40', '#ffb3c4': '#6a5a50' } }],
    ['snowFox', 'Snow Fox', 'YIP', 'fox', 'epic', { recolor: { '#f0761e': '#f4f7fb', '#2a1a10': '#c9d4e0' } }],
    ['elk', 'Snow Elk', 'BUGLE', 'deer', 'legendary', { scale: 1.2, recolor: { '#b9733a': '#d9d2c4', '#f3dfc0': '#ffffff' } }],
    ['mammoth', 'Woolly Tusker', 'TRUMPET', 'boar', 'mythic', { scale: 1.6, recolor: { '#5a3a26': '#7a5a3a', '#2e1d12': '#5a3e24' } }],
  ],
  volcano: [
    ['emberHen', 'Ember Hen', 'BAWK', 'chicken', 'common', { recolor: { '#f6f4ef': '#3a2a2a', '#e7e3da': '#2a1a1a', '#ffffff': '#ff7a1a', '#e8642c': '#ff5a1a', '#c9471e': '#2a1a1a', '#f0a52a': '#ffb21a' } }],
    ['lavaHog', 'Lava Hog', 'OINK', 'pig', 'uncommon', { recolor: { '#f6a6b6': '#5a2a2a', '#f08aa0': '#ff6a1a' } }],
    ['ashGoat', 'Ash Goat', 'MEEH', 'goat', 'rare', { recolor: { '#f0efea': '#55555c', '#e6dccf': '#3a3a40', '#7a6a58': '#ff7a1a', '#6a5a48': '#ffb21a' } }],
    ['magmaFox', 'Magma Fox', 'YIP', 'fox', 'epic', { recolor: { '#f0761e': '#ff3a0a', '#ffffff': '#2a1a1a' } }],
    ['infernoBull', 'Inferno Bull', 'MOOH', 'cow', 'legendary', { scale: 1.15, recolor: { '#f6f6f2': '#2a1a1a', '#1f1f24': '#ff4a0a', '#ffb3c4': '#ff8a3a' } }],
    ['dragon', 'Cinder Dragon', 'ROAR', 'boar', 'mythic', { scale: 1.4, recolor: { '#5a3a26': '#c9261a', '#2e1d12': '#ffb21a', '#c98a74': '#ff7a3a', '#3e271a': '#8a120a' } }],
  ],
}
// The seasonal event (Index EVENT tab): its animals spawn in any world (`chance` per lane spawn),
// worth the current world's mult x `mult`; claiming the full collection unlocks `reward.skin`.
export const SEASON = { id: 'halloween', name: 'Halloween', chance: 0.12, mult: 1.5, reward: { skin: 'halloweenSniper' } }
const SEASON_ROSTER = [
  ['pumpkinHen', 'Pumpkin Hen', 'BAWK', 'chicken', 'uncommon', { recolor: { '#f6f4ef': '#ff8a1a', '#e7e3da': '#e86a0a', '#ffffff': '#ffb04a', '#e8642c': '#ff8a1a', '#c9471e': '#e86a0a', '#e3262e': '#2a8a2a' } }],
  ['batBunny', 'Bat Bunny', 'EEP', 'rabbit', 'uncommon', { recolor: { '#3e4a6b': '#2a2033', '#b8b2a8': '#2a2033', '#f2f2f2': '#6a4a8a', '#d8262e': '#ff8a1a' } }],
  ['candyPig', 'Candy Pig', 'OINK', 'pig', 'uncommon', { recolor: { '#f6a6b6': '#ff9a2a', '#f08aa0': '#8a3aff' } }],
  ['ghostGoat', 'Ghost Goat', 'BOOH', 'goat', 'rare', { recolor: { '#f0efea': '#e8f4ff', '#e6dccf': '#cfe0f4', '#7a6a58': '#9ab0d0', '#6a5a48': '#8aa0c0' } }],
  ['mummyRam', 'Mummy Ram', 'BRAAH', 'sheep', 'rare', { recolor: { '#fbfbf6': '#e6dcc0', '#ffffff': '#d8ccaa', '#2c2c30': '#7a6a50' } }],
  ['witchCat', 'Witch Cat', 'HISS', 'fox', 'rare', { scale: 0.85, recolor: { '#f0761e': '#1e1a26', '#ffffff': '#8a3aff' } }],
  ['boneTurkey', 'Bone Turkey', 'GOBBLE', 'turkey', 'rare', { recolor: { '#6b3d1f': '#e8e4d8', '#4a2810': '#2a2a2a', '#2a8fa8': '#1e1a26', '#5a3016': '#c9c4b8' } }],
  ['zombieCow', 'Zombie Cow', 'MOOAAH', 'cow', 'epic', { recolor: { '#f6f6f2': '#8ab87a', '#1f1f24': '#4a6a3a', '#ffb3c4': '#c94a4a' } }],
  ['ravenStalker', 'Raven Stalker', 'CAW', 'heron', 'epic', { recolor: { '#9aa3b0': '#1e1a26', '#e9edf2': '#3a3346', '#7d8796': '#2a2433', '#f2c12a': '#c9261a', '#5d6574': '#141018' } }],
  ['shadowFox', 'Shadow Fox', 'YIP', 'fox', 'epic', { recolor: { '#f0761e': '#3a2a5a', '#ffffff': '#1a1226' } }],
  ['phantomDeer', 'Phantom Deer', 'WOOO', 'deer', 'epic', { recolor: { '#b9733a': '#9ab8d8', '#f3dfc0': '#e8f4ff' } }],
  ['jackoBoar', 'Jack-o-Boar', 'SNORT', 'boar', 'legendary', { recolor: { '#5a3a26': '#ff7a0a', '#2e1d12': '#2a8a2a', '#3e271a': '#c95a0a' } }],
  ['nightStag', 'Nightmare Stag', 'SHRIEK', 'deer', 'legendary', { scale: 1.25, recolor: { '#b9733a': '#2a1a2a', '#f3dfc0': '#4a2a4a', '#e9d6a6': '#ff3a3a' } }],
  ['reaperBull', 'Reaper Bull', 'MOOH', 'cow', 'mythic', { scale: 1.2, recolor: { '#f6f6f2': '#1a1a1e', '#1f1f24': '#8a3aff', '#ffb3c4': '#5a3a7a' } }],
  ['hauntedTusker', 'Haunted Tusker', 'WAIL', 'boar', 'mythic', { scale: 1.5, recolor: { '#5a3a26': '#4a3a6a', '#2e1d12': '#8aff6a' } }],
]
// ANIMALS[id]: name, call, model, rarity, world (null = seasonal), season, odds, income [lo, hi]
// $/s, hp, sleep (s asleep), speed, weight, radius, scale, recolor, zone.
function animalDef([, name, call, model, rarity, extra = {}], world, worldIndex, season = null) {
  const m = MODELS[model]
  const scale = extra.scale ?? 1
  const mult = world ? WORLDS[world].mult : 1
  return {
    name, call, model, rarity, world, season,
    odds: R_ODDS[rarity],
    income: R_INCOME[rarity].map((n) => Math.round(n * mult)),
    hp: R_HP[rarity] + Math.floor(worldIndex / 2),
    sleep: 24 + RARITIES[rarity].tier,
    speed: m.speed,
    weight: Math.max(0.6, m.weight - (scale - 1) * 0.12),
    radius: m.radius * scale,
    scale,
    recolor: extra.recolor ?? null,
    zone: extra.zone ?? null,
  }
}
export const ANIMALS = {}
Object.entries(ROSTER).forEach(([world, rows], wi) => rows.forEach((r) => (ANIMALS[r[0]] = animalDef(r, world, wi))))
for (const r of SEASON_ROSTER) ANIMALS[r[0]] = animalDef(r, null, 1, SEASON.id)
export const worldAnimals = (world) => ROSTER[world].map((r) => r[0])
export const seasonAnimals = () => SEASON_ROSTER.map((r) => r[0])
export const INDEX_ANIMALS = Object.keys(ROSTER).flatMap(worldAnimals) // the 30 world animals

// Mutations rolled on spawn: chance 1 in N (divided by luck), income multiplier. The Index
// MUTATIONS tab: catch each of the 30 world animals with that mutation; milestones pay $ (the
// player's income x perIncome, at least `money`), speed (steps), and at 30 the mutation's aura.
export const MUTATIONS = {
  shiny: { name: 'Shiny', odds: 15, mult: 2, color: '#fff6a8', card: '#c9ccd4' },
  golden: { name: 'Golden', odds: 45, mult: 5, color: '#ffc61a', card: '#e8b93a' },
  diamond: { name: 'Diamond', odds: 120, mult: 10, color: '#8ff3ff', card: '#7cc8e8' },
  rainbow: { name: 'Rainbow', odds: 300, mult: 25, color: '#ff7ad9', card: '#ef7ab8' },
  void: { name: 'Void', odds: 1000, mult: 50, color: '#9a4dff', card: '#6a3ae0' },
}
export const MUTATION_ORDER = ['void', 'rainbow', 'diamond', 'golden', 'shiny'] // rarest first (rolls)
export const MUTATION_MILESTONES = [
  { n: 10, money: 5000, perIncome: 120 },
  { n: 20, steps: 2000 },
  { n: 30, aura: true }, // the aura `${mutation}` in COSMETICS.auras
]
export const LANE_ANIMALS = {
  // Animals roaming each area at once: `open` for areas the player has unlocked, `locked` for the
  // ones still behind a barrier (seen from afar); touch devices use the smaller pair.
  perArea: { open: 14, locked: 5 },
  perAreaTouch: { open: 9, locked: 3 },
  respawn: 2.5, // s between refills when below count
  wakeFlee: 6, // s an animal sprints away after waking up / being hit
  hpRegen: 12, // s after the last hit before a partly-dazed animal recovers
  alert: 1.4, // s the "!" stays over an animal that was shot at
  labelRange: 260, // studs: aiming labels shown within this distance (further while scoped)
  tagCone: 0.22, // while scoped, tags show on animals within this fraction of the scope's fov of the crosshair
}
// Angry animals (game/danger.js): step into the lane (past the band) with none of your own
// darted animals asleep or carried and the awake ones nearby turn on you. They notice (rear up,
// snort), charge, wind up and lunge; a hit costs HP and knocks you back. Run back up the slope,
// or dart one to sleep, and they calm down. 0 HP: knocked out and back to the hub.
export const DANGER = {
  laneZ: -44, // z the lane starts at for this (just past the band, BAND.z0)
  notice: 13, // m an animal spots you at (+ noticeTier per rarity tier)
  noticeTier: 2,
  giveUp: 46, // m: past this it gives up the chase
  maxAttackers: 4, // at once (the nearest ones)
  noticeTime: 0.8, // s rearing up before the charge
  chaseMult: 3, // x its walk speed, clamped to chaseSpeed
  chaseSpeed: [7.5, 12.5], // m/s (walk 9, sprint 15: sprinting gets away)
  reach: 1.7, // m past its body radius it starts the attack from
  windup: 0.45, // s rearing back
  lunge: 0.28, // s lunging forward (the hit lands mid-lunge)
  lungeDist: 2.6, // m covered in the lunge
  recover: 0.9, // s before it can attack again
  stagger: 0.6, // s a dart that doesn't put it to sleep stops it
  damage: [12, 15, 19, 24, 30, 40], // HP per hit by rarity tier (common..mythic)
  knock: 9, // m/s knockback (x 1 + tier * 0.12), plus a hop
  hp: 100, // player HP
  regenDelay: 4, // s after a hit before HP refills
  regen: 18, // HP/s
  koTime: 2.2, // s knocked out before waking at the hub
  safeTime: 3, // s untouchable after waking up
}
// Events: a special animal spawns on a timer (banner + wooden sign countdown). `pick` = the
// current world's animal of that rarity, `season` = the seasonal animal of that rarity.
export const EVENTS = {
  every: 240, // s between events
  first: 75, // s after joining for the first one
  lasts: 150, // s the event animal stays catchable before it leaves
  list: [
    { pick: 'legendary', mutation: null },
    { pick: 'epic', mutation: 'golden' },
    { season: 'legendary', mutation: null },
    { pick: 'mythic', mutation: null },
    { pick: 'rare', mutation: 'rainbow' },
    { season: 'mythic', mutation: null },
    { pick: 'legendary', mutation: 'shiny' },
  ],
}

// --- Weapons + darts (game/darts.js, game/weapons.js, the ARMORY and DARTS windows) ---------
// Weapons in Armory order (rank = range). range in studs; cooldown s between shots; speed m/s of
// the dart; drop m/s^2 gravity on it; damage per dart; price in $ (money only); scope = its
// sight (zooms = scope zoom levels, AIM.scopeFovs[0..zooms-1]); spread = aim wobble
// (SPREAD rad); magazine = darts per shot. Owning one unlocks the worlds that ask for it
// (WORLDS[w].weapon) and every world below it.
export const WEAPONS = {
  // Ranges reach from the yellow band to the far end of the area each gun opens (studs; from the
  // band the areas end ~107 / 177 / 247 / 317 / 387 m away): blowpipe Meadow, rifle Marsh,
  // carbine Forest, sniper Mountain, Void Reaper Volcano.
  blowpipe: { name: 'Blowpipe', range: 375, cooldown: 0.55, speed: 80, drop: 3, damage: 1, price: 0, scope: 'Simple Sight', zooms: 1, spread: 'High', magazine: 1 },
  pistol: { name: 'Dart Pistol', range: 400, cooldown: 0.26, speed: 95, drop: 4, damage: 1, price: 2500, scope: 'Simple Sight', zooms: 1, spread: 'High', magazine: 1 },
  rifle: { name: 'Short Scope Rifle', range: 610, cooldown: 0.9, speed: 140, drop: 2, damage: 2, price: 90000, scope: 'Short Scope', zooms: 2, spread: 'Low', magazine: 1 },
  carbine: { name: 'Long Range Carbine', range: 845, cooldown: 1, speed: 175, drop: 1.4, damage: 3, price: 5e6, scope: 'Long Scope', zooms: 3, spread: 'Low', magazine: 1 },
  sniper: { name: 'Giant Sniper', range: 1080, cooldown: 1.3, speed: 230, drop: 0.8, damage: 5, price: 3.5e8, scope: 'Big Scope', zooms: 4, spread: 'None', magazine: 1 },
  voidReaper: { name: 'Void Reaper', range: 1315, cooldown: 0.8, speed: 250, drop: 0.5, damage: 8, price: 3e10, scope: 'Void Scope', zooms: 4, spread: 'None', magazine: 1 },
}
export const SPREAD = { High: 0.01, Low: 0.0035, None: 0 } // rad of random aim wobble per shot
// Darts (DARTS window). classic: sleep = s the animal sleeps, bonus = extra damage. special:
// the same, and `mutation` turns the animal it puts to sleep into that mutation (its income x the
// mutation's mult). price = $ per dart; stock = darts per restock (x2 with the Big Quiver);
// pack = the special darts' x10 pack, sold outside the stock at a premium (money only).
export const DARTS = {
  basic: { name: 'Basic', kind: 'classic', color: '#e8ecf2', tile: '#c9ced6', sleep: 24, bonus: 0, price: 10, stock: 70 },
  reinforced: { name: 'Reinforced', kind: 'classic', color: '#5ddc3a', tile: '#3fae2a', sleep: 30, bonus: 1, price: 2500, stock: 60 },
  powerful: { name: 'Powerful', kind: 'classic', color: '#3ab8ff', tile: '#2a7fe0', sleep: 40, bonus: 2, price: 60000, stock: 30 },
  heavy: { name: 'Heavy', kind: 'classic', color: '#b05cff', tile: '#7a3ad0', sleep: 56, bonus: 4, price: 1.2e6, stock: 15 },
  hibernation: { name: 'Hibernation', kind: 'special', color: '#ff7ad9', tile: '#e04ab8', sleep: 75, bonus: 3, price: 5e7, stock: 1, pack: 10 },
  golden: { name: 'Golden', kind: 'special', mutation: 'golden', color: '#ffd23f', tile: '#c99a1a', sleep: 30, bonus: 2, price: 5e8, stock: 1, pack: 10 },
  diamond: { name: 'Diamond', kind: 'special', mutation: 'diamond', color: '#8ff3ff', tile: '#4ab0d8', sleep: 30, bonus: 2, price: 1e10, stock: 1, pack: 10 },
  rainbow: { name: 'Rainbow', kind: 'special', mutation: 'rainbow', color: '#ff7ad9', tile: '#c04ae0', sleep: 30, bonus: 2, price: 2e11, stock: 1, pack: 10 },
  void: { name: 'Void', kind: 'special', mutation: 'void', color: '#9a4dff', tile: '#4a2a8a', sleep: 30, bonus: 2, price: 5e12, stock: 1, pack: 10 },
}
// The Dart Shop: a restock every `restock` s; a free restock every `freeEvery` s; an instant
// restock for $ (max(base, income/s x perIncome)); the Big Quiver doubles every stock for good;
// a special dart's x10 pack costs packMult x its price (money only, never premium currency).
export const DART_SHOP = { restock: 900, freeEvery: 1800, instant: { base: 5000, perIncome: 300 }, quiver: { price: 500000, mult: 2 }, packMult: 12 }
export const FREE_DARTS = { below: 5, give: 15 } // broke and out of darts: the Dart Shop gives this many basic darts

// --- Aiming (game/aim.js) -----------------------------------------------------------------
export const AIM = {
  fov: 68,
  scopeFovs: [24, 13, 7, 4], // zoom levels (- / + / wheel); a weapon uses the first WEAPONS[w].zooms
  // While scoped the view distance (fog + what is drawn) opens to the weapon's range + `clear` m
  // fog-free and fades out over `fade` m more, so every animal in range is sharp.
  scopeView: { clear: 15, fade: 80 },
  sensitivity: 0.0022, // rad per pixel at AIM.fov (scaled down with zoom)
  eye: 1.62, // m above the feet
  minPitch: -1.2,
  maxPitch: 0.9,
}

// --- Base + economy (game/base.js, game/state.js) -------------------------------------------
// Zoo: only ACTIVE animals (in the pen, earning $/s) count; the rest wait in storage. Active
// slots: baseSlots, +1 per pen level (bought for $, slotPrice(level)), up to maxSlots.
export const PEN = {
  baseSlots: 4,
  maxSlots: 20,
  slotPrice: (level) => { // price of level -> level + 1
    const raw = 2500 * Math.pow(2.6, level - 1)
    const mag = Math.pow(10, Math.floor(Math.log10(raw)) - 1)
    return Math.round(raw / mag) * mag
  },
  storage: 60, // animals kept in storage at most
  sellSeconds: 90, // selling an animal pays this many seconds of its income
  oldCapacity: [4, 6, 8, 10, 13, 16], // v1 saves: pen level -> capacity (migrated to slots)
}
export const TREADMILL = { unlock: 100, perStep: [1, 5, 25, 120], upgrade: [5000, 80000, 1200000], stepEvery: 0.36, speedPer: 0.5, stepsPer: 300, maxBonus: 7 }
export const START = { money: 60, darts: { basic: 30 } }
export const CARRY = { pickupRange: 3.4 }
export const BOOSTS = {
  luck: { name: 'x2 Luck', seconds: 600, base: 800, perIncome: 120 },
  cash: { name: 'x2 Cash/s', seconds: 600, base: 1500, perIncome: 240 },
}
// Treadmill x2 (a Playtime reward, not sold): steps per treadmill step doubled while it lasts.
export const TREAD_BOOST = { mult: 2 }
export const GIFT = { every: 600, base: 250, perIncome: 60, darts: 10, dart: 'reinforced' } // dart: a DARTS id
export const OFFLINE = { cap: 8 * 3600, rate: 0.5 } // offline income: up to cap s at rate x
export const BATTLE_PASS = { xpPerLevel: 100, levels: 25, playXp: 40, playEvery: 300, captureXp: [10, 18, 30, 60, 150, 400] }
export const GOALS = [
  { id: 'cap3', text: 'Capture 3 animals', type: 'captures', n: 3, reward: 150 },
  { id: 'tread', text: 'Unlock the treadmill', type: 'treadmill', n: 1, reward: 100 },
  { id: 'earn1k', text: 'Earn 1K $', type: 'earned', n: 1000, reward: 300 },
  { id: 'unc', text: 'Capture an Uncommon', type: 'tier', n: 1, reward: 500 },
  { id: 'pen2', text: 'Upgrade your pen', type: 'pen', n: 2, reward: 800 },
  { id: 'cap15', text: 'Capture 15 animals', type: 'captures', n: 15, reward: 2500 },
  { id: 'rare', text: 'Capture a Rare', type: 'tier', n: 2, reward: 5000 },
  { id: 'pistol', text: 'Buy the Dart Pistol', type: 'weapon', n: 1, reward: 1500 },
  { id: 'event', text: 'Catch an event animal', type: 'event', n: 1, reward: 20000 },
  { id: 'earn1m', text: 'Earn 1M $', type: 'earned', n: 1e6, reward: 100000 },
  { id: 'cap100', text: 'Capture 100 animals', type: 'captures', n: 100, reward: 250000 },
]
// Cosmetic rarities (shop cards): animal rarities + Secret.
export const COSMETIC_RARITY = {
  common: { name: 'Common', color: '#f4f4f4', card: '#e8ecf2' },
  uncommon: { name: 'Uncommon', color: '#8dff6a', card: '#3fc24a' },
  rare: { name: 'Rare', color: '#55c8ff', card: '#2f7fe8' },
  epic: { name: 'Epic', color: '#e07bff', card: '#b24de8' },
  legendary: { name: 'Legendary', color: '#ffd23f', card: '#f2b33a' },
  mythic: { name: 'Mythical', color: '#ff7ad9', card: '#ef7ab8' },
  secret: { name: 'Secret', color: '#d0a8ff', card: '#5b2bd6' },
}
export const COSMETICS = {
  // Trails (TRAIL SHOP): the trail behind you, and `speed` multiplies the speed (steps) the
  // treadmill gives. price in $.
  trails: {
    none: { name: 'No Trail', price: 0, speed: 1, colors: [] },
    white: { name: 'White Trail', rarity: 'common', price: 5000, speed: 2, colors: ['#ffffff', '#e8ecf2'] },
    green: { name: 'Green Trail', rarity: 'uncommon', price: 250000, speed: 4, colors: ['#5dff7a', '#1fbf4a'] },
    blue: { name: 'Blue Trail', rarity: 'rare', price: 2e7, speed: 8, colors: ['#5fc8ff', '#2a7fe0'] },
    purple: { name: 'Purple Trail', rarity: 'epic', price: 1e9, speed: 16, colors: ['#c78aff', '#8a3ae0'] },
    golden: { name: 'Golden Trail', rarity: 'legendary', price: 5e10, speed: 32, colors: ['#ffe14a', '#ffb21a', '#fff6c8'] },
    rainbow: { name: 'Rainbow Trail', rarity: 'mythic', price: 2e12, speed: 64, colors: ['#ff4d4d', '#ffb02e', '#fff23a', '#4dff6a', '#3ab8ff', '#b05cff'], rainbow: true },
    cosmic: { name: 'Cosmic Trail', rarity: 'secret', price: 1e14, speed: 128, colors: ['#5b2bd6', '#ff7af0', '#ffffff', '#3ab8ff'], stars: true },
  },
  // Auras (AURA SHOP), 24 + none. style: flames | storm (flames + lightning) | sparkles | orbit.
  // get: shop ($ price) | mutation (Index MUTATIONS 30/30 for `id`) | world (`id`'s Index
  // claimed). colors: [main, glow].
  auras: {
    none: { name: 'No Aura', style: 'orbit', get: 'shop', price: 0, colors: ['#ffffff', '#ffffff'] },
    ember: { name: 'Aura Ember', style: 'flames', get: 'shop', price: 25000, colors: ['#ff5a1a', '#ffd23f'] },
    leaf: { name: 'Aura Meadow', style: 'orbit', get: 'shop', price: 12000, colors: ['#7dff6a', '#d8ff9a'] },
    venom: { name: 'Aura Venom', style: 'flames', get: 'shop', price: 250000, colors: ['#5dff3a', '#1f9a2a'] },
    frost: { name: 'Aura Frost', style: 'sparkles', get: 'shop', price: 100000, colors: ['#8fe8ff', '#ffffff'] },
    flame: { name: 'Aura Blaze', style: 'flames', get: 'shop', price: 500000, colors: ['#ff8a2a', '#ff2e1a'] },
    sakura: { name: 'Aura Sakura', style: 'flames', get: 'shop', price: 2e6, colors: ['#ff7ac8', '#ffd0e8'] },
    galaxy: { name: 'Aura Galaxy', style: 'sparkles', get: 'shop', price: 3e6, colors: ['#b77bff', '#ff7af0'] },
    storm: { name: 'Aura Storm', style: 'storm', get: 'shop', price: 2e7, colors: ['#3ab8ff', '#e8f8ff'] },
    ocean: { name: 'Aura Tide', style: 'flames', get: 'shop', price: 6e7, colors: ['#2ad8c8', '#bff8ff'] },
    sunburst: { name: 'Aura Sunburst', style: 'storm', get: 'shop', price: 3e8, colors: ['#ffd23f', '#fff6c8'] },
    shadow: { name: 'Aura Shadow', style: 'flames', get: 'shop', price: 2e9, colors: ['#3a1a5a', '#9a4dff'] },
    plasma: { name: 'Aura Plasma', style: 'storm', get: 'shop', price: 1e10, colors: ['#ff3af0', '#3ab8ff'] },
    inferno: { name: 'Aura Inferno', style: 'storm', get: 'shop', price: 6e10, colors: ['#ff2e1a', '#ffb21a'] },
    cosmic: { name: 'Aura Cosmos', style: 'sparkles', get: 'shop', price: 4e11, colors: ['#5b2bd6', '#ffffff'] },
    shiny: { name: 'Aura Shiny', style: 'sparkles', get: 'mutation', id: 'shiny', colors: ['#fff6a8', '#ffffff'] },
    golden: { name: 'Aura Golden', style: 'storm', get: 'mutation', id: 'golden', colors: ['#ffc61a', '#fff1b0'] },
    diamond: { name: 'Aura Diamond', style: 'storm', get: 'mutation', id: 'diamond', colors: ['#8ff3ff', '#ffffff'] },
    rainbow: { name: 'Aura Rainbow', style: 'storm', get: 'mutation', id: 'rainbow', colors: ['#ff7ad9', '#7ad7ff'], rainbow: true },
    void: { name: 'Aura Void', style: 'storm', get: 'mutation', id: 'void', colors: ['#9a4dff', '#1a0b2a'] },
    bloom: { name: 'Aura Bloom', style: 'orbit', get: 'world', id: 'meadow', colors: ['#ffd0e8', '#7dff6a'] },
    bog: { name: 'Aura Bog', style: 'flames', get: 'world', id: 'marsh', colors: ['#6a8a3a', '#c9d84a'] },
    grove: { name: 'Aura Grove', style: 'sparkles', get: 'world', id: 'forest', colors: ['#3fae2a', '#e9d2b0'] },
    summit: { name: 'Aura Summit', style: 'storm', get: 'world', id: 'mountain', colors: ['#e8f4ff', '#7ab0e0'] },
    magma: { name: 'Aura Magma', style: 'storm', get: 'world', id: 'volcano', colors: ['#ff4a0a', '#2a1a1a'] },
  },
}
// Weapon skins (the SKIN window lists them all; the SKIN SHOP sells the `shop` ones for $).
// Each restyles every weapon ([main, second, accent], null = the weapon's own colours), adds a
// `deco` (crystals | spikes | wings | tentacles | stars | teeth), paints the darts and tints
// the scope ring. unlock: default | shop (price in $, money only) | season (the seasonal Index
// reward) | captures (n animals caught) | mutation (n Index animals caught with it) | world
// (that world's Index complete) | playtime (hours played).
export const SKINS = {
  classic: { name: 'Original', rarity: 'common', colors: null, dart: null, dartName: 'Classic', scope: { name: 'Classic', tint: '#0d0d0d' }, unlock: { type: 'default' } },
  // --- Skin Shop (15) ---
  neon: { name: 'Neon', rarity: 'common', colors: ['#39ff8f', '#1b1b2b', '#39e8ff'], dart: '#39e8ff', dartName: 'Glow Sticks', scope: { name: 'Neon', tint: '#39e8ff' }, unlock: { type: 'shop', price: 8000 } },
  camo: { name: 'Camo', rarity: 'common', colors: ['#5a7a3a', '#3a4a26', '#8a7a4a'], dart: '#5a7a3a', dartName: 'Camo', scope: { name: 'Hunter', tint: '#3a4a26' }, unlock: { type: 'shop', price: 15000 } },
  candy: { name: 'Bubblegum', rarity: 'common', colors: ['#ff7ac8', '#ffffff', '#7ad7ff'], dart: '#ff7ac8', dartName: 'Sweets', scope: { name: 'Pastel', tint: '#ff7ac8' }, unlock: { type: 'shop', price: 30000 } },
  toxic: { name: 'Toxic', rarity: 'common', colors: ['#8aff3a', '#1e2a14', '#d8ff3a'], dart: '#8aff3a', dartName: 'Goo', scope: { name: 'Hazard', tint: '#6ad82a' }, deco: 'spikes', unlock: { type: 'shop', price: 40000 } },
  pumpkin: { name: 'Pumpkin Patch', rarity: 'rare', colors: ['#ff8a1a', '#2a8a2a', '#3a2a1a'], dart: '#ff8a1a', dartName: 'Seeds', scope: { name: 'Harvest', tint: '#ff8a1a' }, unlock: { type: 'shop', price: 90000 } },
  sakura: { name: 'Sakura', rarity: 'rare', colors: ['#ffc2dc', '#7a3a4a', '#ffffff'], dart: '#ff9ac8', dartName: 'Petals', scope: { name: 'Blossom', tint: '#ff7ab0' }, deco: 'stars', unlock: { type: 'shop', price: 150000 } },
  eternalFrost: { name: 'Eternal Frost', rarity: 'rare', colors: ['#bfefff', '#4a8adf', '#ffffff'], dart: '#8fe8ff', dartName: 'Ice Shards', scope: { name: 'Frosted', tint: '#4ab8ff' }, deco: 'crystals', unlock: { type: 'shop', price: 400000 } },
  coral: { name: 'Coral Reef', rarity: 'rare', colors: ['#ff5a7a', '#ffd0a8', '#3ad8c8'], dart: '#ff5a7a', dartName: 'Coral Shards', scope: { name: 'Coral', tint: '#ff5a7a' }, deco: 'spikes', unlock: { type: 'shop', price: 2e6 } },
  galaxy: { name: 'Cosmic Galaxy', rarity: 'epic', colors: ['#5b2bd6', '#1a0b40', '#ff7af0'], dart: '#b77bff', dartName: 'Stardust', scope: { name: 'Cosmic', tint: '#b77bff' }, deco: 'stars', unlock: { type: 'shop', price: 1.5e7 } },
  abyss: { name: 'Abyss', rarity: 'epic', colors: ['#14304a', '#0a1420', '#3af0ff'], dart: '#3af0ff', dartName: 'Deep Spines', scope: { name: 'Abyssal', tint: '#3af0ff' }, deco: 'spikes', unlock: { type: 'shop', price: 8e7 } },
  voltJelly: { name: 'Volt Jellyfish', rarity: 'epic', colors: ['#b77bff', '#ffffff', '#3af0ff'], dart: '#e8b8ff', dartName: 'Stingers', scope: { name: 'Electric', tint: '#b77bff' }, deco: 'tentacles', unlock: { type: 'shop', price: 4e8 } },
  meteor: { name: 'Meteor Strike', rarity: 'epic', colors: ['#3a2a2a', '#ff5a1a', '#ffb21a'], dart: '#ff5a1a', dartName: 'Mini Meteors', scope: { name: 'Impact', tint: '#ff5a1a' }, deco: 'crystals', unlock: { type: 'shop', price: 2e9 } },
  royal: { name: 'Royal', rarity: 'legendary', colors: ['#3a2aa8', '#ffd23f', '#ff3a5a'], dart: '#ffd23f', dartName: 'Crowns', scope: { name: 'Regal', tint: '#ffd23f' }, deco: 'wings', unlock: { type: 'shop', price: 2e10 } },
  celestial: { name: 'Celestial Bow', rarity: 'legendary', colors: ['#fff6d8', '#ffd23f', '#ffffff'], dart: '#fff6c8', dartName: 'Light Arrows', scope: { name: 'Celestial', tint: '#ffd23f' }, deco: 'wings', unlock: { type: 'shop', price: 1.5e11 } },
  kraken: { name: 'Deep Kraken', rarity: 'mythic', colors: ['#2a1a4a', '#5b2bd6', '#3af0a0'], dart: '#3af0a0', dartName: 'Ink Bolts', scope: { name: 'Depths', tint: '#5b2bd6' }, deco: 'tentacles', unlock: { type: 'shop', price: 2e12 } },
  // --- Earned ---
  halloweenSniper: { name: 'Halloween Sniper', rarity: 'epic', colors: ['#ff7a0a', '#2a1a33', '#8aff3a'], dart: '#ff7a0a', dartName: 'Pumpkins', scope: { name: 'Spooky', tint: '#ff7a0a' }, deco: 'spikes', unlock: { type: 'season', id: 'halloween' } },
  candyCane: { name: 'Candy Cane', rarity: 'rare', colors: ['#ff2e3a', '#ffffff', '#3fc24a'], dart: '#ff2e3a', dartName: 'Candy Canes', scope: { name: 'Festive', tint: '#ff2e3a' }, unlock: { type: 'captures', n: 50 } },
  gold: { name: 'Gold', rarity: 'epic', colors: ['#ffcf3a', '#fff1b0', '#c98b10'], dart: '#ffcf3a', dartName: 'Gold', scope: { name: 'Gilded', tint: '#c98b10' }, unlock: { type: 'mutation', id: 'golden', n: 10 } },
  meadowMaster: { name: 'Meadow Master', rarity: 'uncommon', colors: ['#7fcf45', '#ffe36a', '#ffffff'], dart: '#7fcf45', dartName: 'Clover', scope: { name: 'Meadow', tint: '#3fc24a' }, unlock: { type: 'world', id: 'meadow' } },
  swampKing: { name: 'Swamp King', rarity: 'rare', colors: ['#3f5a2a', '#8a6a44', '#c9d84a'], dart: '#6a8a3a', dartName: 'Reeds', scope: { name: 'Bog', tint: '#3f5a2a' }, unlock: { type: 'world', id: 'marsh' } },
  woodland: { name: 'Woodland', rarity: 'rare', colors: ['#8a4f22', '#2f6a2a', '#e9d2b0'], dart: '#8a4f22', dartName: 'Acorns', scope: { name: 'Bark', tint: '#6b4423' }, unlock: { type: 'world', id: 'forest' } },
  glacier: { name: 'Glacier', rarity: 'epic', colors: ['#e8f4ff', '#7ab0e0', '#3a6aa8'], dart: '#e8f4ff', dartName: 'Icicles', scope: { name: 'Glacier', tint: '#7ab0e0' }, deco: 'crystals', unlock: { type: 'world', id: 'mountain' } },
  magma: { name: 'Magma', rarity: 'legendary', colors: ['#2a1a1a', '#ff4a0a', '#ffb21a'], dart: '#ff4a0a', dartName: 'Embers', scope: { name: 'Molten', tint: '#ff4a0a' }, deco: 'spikes', unlock: { type: 'world', id: 'volcano' } },
  shinyStar: { name: 'Shiny Star', rarity: 'rare', colors: ['#fff6a8', '#ffffff', '#ffd23f'], dart: '#fff6a8', dartName: 'Stars', scope: { name: 'Twinkle', tint: '#ffd23f' }, deco: 'stars', unlock: { type: 'mutation', id: 'shiny', n: 10 } },
  diamond: { name: 'Diamond', rarity: 'epic', colors: ['#8ff3ff', '#ffffff', '#4ab8e8'], dart: '#8ff3ff', dartName: 'Gems', scope: { name: 'Crystal', tint: '#4ab8e8' }, deco: 'crystals', unlock: { type: 'mutation', id: 'diamond', n: 5 } },
  prism: { name: 'Prism', rarity: 'legendary', colors: ['#ff7ad9', '#7ad7ff', '#fff23a'], dart: '#ff7ad9', dartName: 'Prisms', scope: { name: 'Rainbow', tint: '#ff7ad9' }, deco: 'crystals', unlock: { type: 'mutation', id: 'rainbow', n: 5 } },
  voidwalker: { name: 'Voidwalker', rarity: 'mythic', colors: ['#1a0b2a', '#9a4dff', '#ff3af0'], dart: '#9a4dff', dartName: 'Void Shards', scope: { name: 'Abyss', tint: '#9a4dff' }, deco: 'teeth', unlock: { type: 'mutation', id: 'void', n: 3 } },
  veteran: { name: 'Veteran', rarity: 'epic', colors: ['#3a3f4a', '#c9a24a', '#ff3a3a'], dart: '#c9a24a', dartName: 'Brass', scope: { name: 'Marksman', tint: '#ff3a3a' }, unlock: { type: 'captures', n: 500 } },
  timeless: { name: 'Timeless', rarity: 'legendary', colors: ['#f4f4f4', '#2a2a2a', '#ffd23f'], dart: '#f4f4f4', dartName: 'Hourglass', scope: { name: 'Clockwork', tint: '#ffd23f' }, deco: 'wings', unlock: { type: 'playtime', h: 10 } },
}
// Playtime Rewards (gift icon): unlock at `at` s of play today (UTC day; the server counts it,
// see ../Dart-dash-backend src/constants.ts PLAYTIME_STEPS, which must match `at`). Kinds:
// darts { dart, n } | money { base, perIncome } ($ = max(base, income/s x perIncome)) | steps { n }
// | animal { species, mutation } (to the zoo) | treadmill { seconds } (Treadmill x2).
export const PLAYTIME = [
  { at: 60, kind: 'darts', dart: 'basic', n: 30, bg: 'blue' },
  { at: 180, kind: 'money', base: 2000, perIncome: 40, bg: 'blue' },
  { at: 300, kind: 'steps', n: 60, bg: 'blue' },
  { at: 480, kind: 'animal', species: 'sheep', mutation: 'shiny', bg: 'blue' },
  { at: 660, kind: 'money', base: 6000, perIncome: 90, bg: 'purple' },
  { at: 840, kind: 'treadmill', seconds: 1800, bg: 'purple' },
  { at: 1020, kind: 'darts', dart: 'heavy', n: 15, bg: 'purple' },
  { at: 1200, kind: 'animal', species: 'squirrel', mutation: 'golden', bg: 'purple' },
  { at: 1500, kind: 'money', base: 20000, perIncome: 200, bg: 'gold' },
  { at: 1800, kind: 'steps', n: 300, bg: 'gold' },
  { at: 2700, kind: 'darts', dart: 'golden', n: 2, bg: 'gold' },
  { at: 3600, kind: 'animal', species: 'fox', mutation: 'rainbow', bg: 'rainbow' },
]
// The SETTINGS window's switches (saved with the progress).
export const GAME_SETTINGS = { music: 'Music', ambience: 'Ambience', effects: 'Effects', interface: 'Interface' }
export const SAVE_KEY = 'dart-dash.save.v1'
// Server link (net.js; backend ../Dart-dash-backend). Dev builds talk to a local server
// (VITE_SERVER_URL_DEV, default ws://localhost:2567); production resolves it through Bloxity.
export const SERVER_URL = import.meta.env.DEV ? import.meta.env.VITE_SERVER_URL_DEV || 'ws://localhost:2567' : ''
export const NET = { saveEvery: 6, retry: 4, retryMax: 60, requestTimeout: 8, poseEvery: 0.1, baseEvery: 1.5, joinWindow: 60 }
// Watch-an-ad rewards (Bloxity rewarded ads; never Gems). Ids are the ad placements (lowercase,
// digits, hyphens) and match the backend's AD_PLACEMENTS. Each is a free boost, once per cooldown.
export const AD_REWARDS = {
  'free-darts': { name: 'Free Darts', desc: '+25 Basic darts', darts: { basic: 25 }, cooldown: 120 },
  'cash-boost': { name: 'x2 Cash', desc: 'x2 cash/s for 5 min', boost: { id: 'cash', seconds: 300 }, cooldown: 600 },
  'luck-boost': { name: 'x2 Luck', desc: 'x2 luck for 5 min', boost: { id: 'luck', seconds: 300 }, cooldown: 600 },
}
// Bloxity leaderboards (SDK define + server-side reporting); ids lowercase a-z, 0-9, _ or -.
export const LEADERBOARDS = [
  { id: 'captures', label: 'Captures', order: 'desc', mode: 'best', format: 'compact', reset: 'none', stat: 'captures' },
  { id: 'steps', label: 'Treadmill steps', order: 'desc', mode: 'best', format: 'compact', reset: 'none', stat: 'steps' },
  { id: 'earned', label: 'Total earned', order: 'desc', mode: 'best', format: 'compact', reset: 'weekly', stat: 'earned' },
]

// --- Audio (audio/*) ---------------------------------------------------------------------------
export const AUDIO = {
  volume: 0.8,
  storageKey: 'dart-dash.sound',
  buses: { ui: 0.8, sfx: 0.9, amb: 0.5, engine: 0.4 },
  duck: 0.45,
  maxVoices: 48,
  maxVoicesTouch: 24,
  latency: 0.04,
  latencyTouch: 0.07,
  lead: 0.02,
  reverb: { seconds: 1.6, preDelay: 0.01, early: [[17, 0.4], [29, 0.3], [43, 0.22], [67, 0.15], [91, 0.1]], decay: 1.1, tail: 0.15, darken: 1.8, send: 0.8 },
  music: 0.14, // background music level (0 = off)
}

// Upper-body poses laid over the walk cycle (avatar/animator.js setOverlay).
export const POSES = {
  carry: { ArmL1: { x: deg(-165), z: deg(18) }, ArmR1: { x: deg(-165), z: deg(-18) }, ArmL2: { x: deg(-20) }, ArmR2: { x: deg(-20) }, Spine1: { x: deg(-4) } },
  aim: { ArmR1: { x: deg(-85), y: deg(-10) }, ArmL1: { x: deg(-80), y: deg(30), z: deg(20) }, ArmR2: { x: deg(-10) }, ArmL2: { x: deg(-30) } },
}
