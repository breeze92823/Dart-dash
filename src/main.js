import { ACESFilmicToneMapping, Clock, Group, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'
import { BATTLE_PASS, CAMERA, LANE, MUTATIONS, SKINS, WEAPONS, WORLDS, graphicsPreset, RENDER } from './config.js'
import * as bloxity from './bloxity.js'
import { install as installInput, onKey, setLockPolicy, isLocked } from './input.js'
import { installTouch } from './touch.js'
import { createPlayerBody, interpolate as interpolatePlayer, player, resetPlayer, respawn } from './player.js'
import { setCameraSensitivity, setView, syncYawToPlayer, update as updateCamera } from './camera.js'
import { onModeChanged, toggleMode } from './modes.js'
import { bodyCount, initPhysics, stepPhysics } from './physics.js'
import { createLighting } from './lighting.js'
import { createPostFx } from './postfx.js'
import { setNeonBloom } from './propkit.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { buildWorld } from './world/world.js'
import { buildHub } from './world/hub.js'
import { buildLane } from './world/lane.js'
import { buildBarrier } from './world/barrier.js'
import { AREAS } from './world/areas.js'
import { weaponThumb } from './ui/thumbs.js'
import { initParticles, setParticleQuality, updateParticles } from './fx/particles.js'
import { updateLabels } from './fx/labels.js'
import { AnimalManager } from './game/animals.js'
import { tickMutations } from './game/animalModels.js'
import { Darts } from './game/darts.js'
import { createAim } from './game/aim.js'
import { createBase } from './game/base.js'
import { createEvents } from './game/events.js'
import { createBots } from './game/bots.js'
import { createCosmetics } from './game/cosmetics.js'
import { addMoney, addXp, emit, fmt, fmtTime, on, save, skinOwned, state, checkGoals, worldUnlocked } from './game/state.js'
import * as playtime from './game/playtime.js'
import { initNet, net } from './net.js'
import * as hud from './ui/hud.js'
import { closePanel, isPanelOpen, onPanelChange, openPanel, tickShop } from './ui/panels.js'
import { installAudio, setBusOn, setMusic, sfx, updateAudio } from './audio/index.js'

// Boot order: Bloxity SDK -> renderer -> Rapier (async wasm) -> world, hub, lane,
// player -> avatar (async) -> game systems -> loop. The SDK is optional at every step.
let lighting = null
let renderer = null
let postfx = null

function applySetting(key, value) {
  if (key === 'camera_sensitivity') setCameraSensitivity(value)
  else if (key === 'fullscreen') bloxity.requestFullscreen(value)
  else if (key === 'graphics_quality' && renderer) {
    const next = graphicsPreset(value)
    renderer.shadowMap.enabled = next.shadows
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, next.dpr))
    lighting?.setShadows(next)
    postfx?.configure(next)
    setNeonBloom(next.bloom)
    setParticleQuality(next.particles)
    postfx?.setSize(window.innerWidth, window.innerHeight)
  }
}
bloxity.onSetting(applySetting)
bloxity.init()

// --- Renderer ---------------------------------------------------------------
const preset = graphicsPreset(bloxity.settings.graphics_quality)
renderer = new WebGLRenderer({ antialias: preset.antialias, powerPreference: 'high-performance' })
renderer.outputColorSpace = SRGBColorSpace
renderer.toneMapping = ACESFilmicToneMapping
renderer.toneMappingExposure = RENDER.exposure
renderer.shadowMap.enabled = preset.shadows
renderer.shadowMap.type = PCFSoftShadowMap
renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.dpr))
document.body.appendChild(renderer.domElement)
installInput(() => bloxity.showMenu(), renderer.domElement)

const scene = new Scene()
const camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far)
postfx = createPostFx(renderer, scene, camera)
postfx.configure(preset)

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight)
  postfx.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()
for (const key of Object.keys(bloxity.settings)) applySetting(key, bloxity.settings[key])

// --- Physics + world -------------------------------------------------------------
bloxity.loadingStep('Starting physics')
await initPhysics()
lighting = createLighting(scene, renderer, preset)
bloxity.loadingStep('Building the meadow')
const world = buildWorld(scene)
const hub = buildHub(scene)
const lane = buildLane(scene)
const barrier = buildBarrier(scene)
createPlayerBody()
syncYawToPlayer()
initParticles(scene, preset.particles)

// --- Player avatar ----------------------------------------------------------------
const playerGroup = new Group()
scene.add(playerGroup)
let avatar = null
let animator = null
let generation = 0
let avatarReady = false

function setAvatar(next) {
  if (avatar) playerGroup.remove(avatar)
  const overlay = animator?.overlayOn ? animator.overlay : null
  disposeAnimator(animator)
  avatar = next
  playerGroup.add(avatar)
  animator = makeAnimator(avatar)
  if (overlay) animator.setOverlay(overlay)
}
setAvatar(buildDefaultCharacter())

async function loadAvatar() {
  const mine = ++generation
  try {
    const group = await loadBaseCharacter()
    if (mine !== generation) return
    const equipped = bloxity.authState.user ? bloxity.getEquippedAvatar() : null
    await attachEquippedAccessories(group, equipped, { skinTextureUrl: bloxity.getSkinTextureUrl() })
    if (mine !== generation) return
    applyProportions(group, bloxity.authState.user ? bloxity.getProportions() : null)
    setAvatar(group)
  } finally {
    if (mine === generation) avatarReady = true
  }
}
let signedIn = null
bloxity.subscribeAuth((s) => {
  const now = !!s.user
  if (now !== signedIn) {
    signedIn = now
    loadAvatar()
  }
})
bloxity.onAvatarChanged(loadAvatar)
bloxity.onProportionsChanged(() => applyProportions(avatar, bloxity.getProportions()))
bloxity.onRespawnRequest(respawn)
const playerName = () => {
  const n = bloxity.displayName()
  return n === 'Offline' ? 'You' : n
}

// --- Game systems ------------------------------------------------------------------
// Offline income comes with a save (the browser's now, or the server's when it answers).
let pendingOffline = 0
on('offline', (n) => (pendingOffline += n))
initNet()
installAudio()
const animals = new AnimalManager(scene, lane.obstacles)
const darts = new Darts(scene, animals)
const events = createEvents({ animals, live: hub.live })
const bots = createBots({ scene, animals, darts, events, live: hub.live })
const cosmetics = createCosmetics({ playerGroup })
const base = createBase({
  scene,
  animals,
  hubZones: hub.zones,
  live: hub.live,
  playerGroup,
  getAnimator: () => animator,
  playerName,
})
let firstPerson = false
const aim = createAim({
  camera,
  scene,
  darts,
  animals,
  playerName,
  onEnter: () => closePanel(),
  onExit: () => {},
})
// Click on the world grabs the cursor (Esc / Alt gives it back), except while a shop panel is open.
setLockPolicy(() => !isPanelOpen())

let carriedEvent = null // the event animal while the player carries it

// A mutation dart turned the animal it put to sleep.
darts.onMutate = (animal, m) => {
  hud.announce(`${MUTATIONS[m].name.toUpperCase()} ${animal.def.name.toUpperCase()}! ${fmt(animal.income)} $/S`, MUTATIONS[m].color, 3)
  sfx.levelUp()
}
darts.onHit = (animal, slept, owner) => {
  bots.onHit(animal, slept, owner)
  if (owner.isPlayer && slept && state.captures < 3) {
    hud.toast(`${animal.def.name} is asleep! Go grab it — ${Math.round(animal.sleepLeft)}s`, { check: true })
  }
}

// --- HUD + keys ---------------------------------------------------------------------
hud.onAction('shop', () => openPanel('shop'))
hud.onAction('index', () => openPanel('index'))
hud.onAction('zoo', () => openPanel('zoo'))
hud.onAction('skins', () => openPanel('skins'))
hud.onAction('bp', () => openPanel('bp'))
hud.onAction('gift', () => openPanel('gift'))
hud.onAction('playtime', () => openPanel('playtime'))
hud.onAction('settings', () => openPanel('settings'))
hud.onAction('luck', () => openPanel('shop', 'boosts'))
hud.onAction('cash', () => openPanel('shop', 'boosts'))
hud.onAction('weapon', () => aim.cycleWeapon())
hud.onAction('dart', () => aim.cycleDart())
// Settings window: music, ambience, effects, interface.
function applySettings() {
  const st = state.settings
  setMusic(st.music)
  setBusOn('amb', st.ambience)
  setBusOn('sfx', st.effects)
  hud.setInterface(st.interface)
}
on('settings', applySettings)
applySettings()
// The equipped weapon skin tints the scope ring.
const applySkin = () => hud.setScopeTint(SKINS[state.cosmetics.skin]?.scope.tint ?? '#1b1d1f')
on('cosmetic', applySkin)
applySkin()
// Worlds: the lane is dressed in the area's look (areas.js: ground, cliff caps, props, pond), the
// strip past the barrier in the next area's, and the lane fills with the area's animals.
let laneWorld = state.world
function applyWorld(announce) {
  const ids = Object.keys(WORLDS)
  const next = ids[ids.indexOf(state.world) + 1] ?? null
  lane.setArea(state.world, next)
  world.setGround(AREAS[state.world] ?? AREAS.meadow, next && AREAS[next])
  if (laneWorld === state.world) return
  laneWorld = state.world
  animals.reroll()
  if (announce) {
    hud.announce(`WELCOME TO THE ${WORLDS[state.world].name.toUpperCase()}!`, '#8dff6a', 3.5)
    sfx.fanfare()
  }
}
on('world', () => applyWorld(true))
applyWorld(false)
// The green barrier at the lane's far end names the next area and the gun that opens it.
let barrierKey = ''
function applyBarrier() {
  const ids = Object.keys(WORLDS)
  const next = ids[ids.indexOf(state.world) + 1]
  const locked = next ? !worldUnlocked(next) : false
  const key = `${next}|${locked}|${state.cosmetics.skin}`
  if (key === barrierKey) return
  barrierKey = key
  if (!next) return barrier.show({ final: true })
  const gun = WORLDS[next].weapon
  barrier.show({ area: WORLDS[next].name.toUpperCase(), locked, gun: WEAPONS[gun].name.toUpperCase(), price: fmt(WEAPONS[gun].price), imgSrc: locked ? weaponThumb(gun, state.cosmetics.skin) : null })
}
for (const ev of ['world', 'worlds', 'weapon', 'cosmetic', 'hydrate']) on(ev, applyBarrier)
applyBarrier()
// A whole save loaded (the server's): redraw everything that reads it.
on('hydrate', () => {
  applySettings()
  applySkin()
  applyWorld(false)
  hud.refreshHud()
  emit('weapon')
  checkGoals()
})
onPanelChange((p) => {
  if (p && isLocked()) document.exitPointerLock?.()
})

onModeChanged((mode) => {
  firstPerson = mode === 'player'
})
onKey('KeyV', () => !aim.active && toggleMode())
onKey('KeyN', () => lighting.toggleDayNight())
onKey('KeyR', () => !aim.active && respawn())
onKey('KeyE', () => (aim.active ? aim.cycleDart() : base.interact()))
onKey('KeyQ', () => aim.cycleWeapon())
onKey('Digit1', () => aim.cycleWeapon())
onKey('Digit2', () => aim.cycleDart())
onKey('KeyM', () => openPanel('shop'))
installTouch({ mode: () => !aim.active && toggleMode(), day: () => lighting.toggleDayNight(), respawn })

hud.refreshHud()
checkGoals()
// Offline income, paid a moment after the save that brought it.
setInterval(() => {
  if (!(pendingOffline > 0)) return
  const n = pendingOffline
  pendingOffline = 0
  addMoney(n)
  hud.banner(`YOU EARNED ${fmt(n)} $ OFFLINE`, 5)
  sfx.purchase()
}, 1200)
setTimeout(() => {
  if (!state.captures) hud.announce('STEP ON THE YELLOW BAND TO AIM!', '#ffe14a', 5)
}, 1800)

// --- Loop ---------------------------------------------------------------------------
const clock = new Clock()
let simTime = 0
let shownLoading = true
let readySince = 0
let secondTimer = 0
let saveTimer = 0
let boardTimer = 0
let playTimer = 0
let callTimer = 2
const near = (p, r) => camera.position.distanceToSquared(p) < r * r
const ctx = { now: 0, near, showTags: false }
const tmp = new Vector3()

function frame(forcedDt) {
  const dt = forcedDt ?? Math.min(clock.getDelta(), 0.1)
  const elapsed = forcedDt != null ? (simTime += forcedDt) : clock.elapsedTime
  ctx.now = elapsed

  stepPhysics(dt)
  interpolatePlayer()
  const p = player.renderPosition
  playerGroup.position.set(p.x, p.y, p.z)
  playerGroup.rotation.y = player.facing
  const speed = Math.hypot(player.velocity.x, player.velocity.z)
  animator?.update(dt, { grounded: player.grounded, speed, verticalVelocity: player.velocity.y, turn: 0 })

  aim.update(dt, { carrying: !!base.carrying, menuOpen: isPanelOpen() })
  playerGroup.visible = !aim.active && !firstPerson
  if (aim.active) aim.updateCamera(dt)
  else updateCamera(camera, dt)

  ctx.showTags = aim.active && aim.scoped
  animals.update(dt, ctx)
  darts.update(dt)
  base.update(dt, ctx)
  // A carried event animal that reaches the pen ends the event.
  if (base.carrying?.event) carriedEvent = base.carrying
  else if (carriedEvent) {
    if (!animals.list.includes(carriedEvent) && events.current?.animal === carriedEvent) events.captured(carriedEvent, playerName())
    carriedEvent = null
  }
  events.update(dt)
  bots.update(dt, ctx)
  cosmetics.update(dt, { moving: speed > 1.5, visible: playerGroup.visible })

  // Hub life: the portal swirls, shop pads breathe, mutations shimmer.
  if (hub.live.portal?.userData.swirl) hub.live.portal.userData.swirl.uniforms.time.value = elapsed
  barrier.update(elapsed)
  lane.update(elapsed)
  for (const d of hub.live.discs) {
    d.userData.ring.scale.setScalar(1 + Math.sin(elapsed * 2.5) * 0.04)
    d.userData.disc.material.emissiveIntensity = 0.28 + Math.sin(elapsed * 2.5) * 0.1
  }
  tickMutations(elapsed)

  // Animal chatter near the camera.
  callTimer -= dt
  if (callTimer <= 0) {
    callTimer = 1.5 + Math.random() * 3
    const nearby = animals.list.filter((a) => !a.asleep && near(a.pos, 70))
    const a = nearby[Math.floor(Math.random() * nearby.length)]
    if (a) sfx.animalCall(a.species, a.pos)
    else if (base.pen.length && Math.random() < 0.4) {
      const b = base.pen[Math.floor(Math.random() * base.pen.length)]
      sfx.animalCall(b.species, b.pos)
    }
  }

  // Once a second: timers, XP for playtime, saves, leaderboards.
  secondTimer -= dt
  if (secondTimer <= 0) {
    secondTimer = 1
    hud.tickHud()
    tickShop()
    if (!document.hidden) state.playtime += 1
    playtime.tick()
    hud.setPlaytimeReady(playtime.anyReady())
    // Skins earned by playing (catches, Index, playtime) unlock themselves.
    for (const id of Object.keys(SKINS)) {
      if (state.cosmetics.skins[id] || SKINS[id].unlock.type === 'shop') continue
      if (skinOwned(id)) {
        hud.toast(`New skin unlocked: ${SKINS[id].name}! Equip it in SKIN`, { check: true, seconds: 4 })
        sfx.levelUp()
      }
    }
    const restock = fmtTime((state.dartShop.restockAt - Date.now()) / 1000)
    hub.live.shopLabels.darts.html = `<div class="t" style="color:#5dea4a">Dart Shop</div><div class="s">Next restock in ${restock}</div>`
    const giftIn = (state.giftAt - Date.now()) / 1000
    hub.live.giftLabel.html = `<div class="t" style="color:#ffd23f">Free Gift</div><div class="s">${giftIn <= 0 ? 'READY!' : fmtTime(giftIn)}</div>`
  }
  playTimer += dt
  if (playTimer >= BATTLE_PASS.playEvery) {
    playTimer = 0
    addXp(BATTLE_PASS.playXp)
    hud.toast(`PLAY FOR ${BATTLE_PASS.playEvery / 60} MIN: +${BATTLE_PASS.playXp} BATTLE PASS XP`, { check: true, seconds: 4 })
  }
  saveTimer += dt
  if (saveTimer > 10) {
    saveTimer = 0
    save()
  }
  boardTimer -= dt
  if (boardTimer <= 0) {
    boardTimer = 5
    bots.redrawBoards(playerName(), net.boards)
  }

  const viewH = renderer.getDrawingBufferSize(tmp).y
  updateParticles(dt, camera, viewH)
  updateLabels(camera, dt)
  updateAudio(dt, {
    camera,
    player: { x: p.x, y: p.y, z: p.z, vy: player.velocity.y, grounded: player.grounded },
    speed,
    surface: p.z < -38 && p.y > -1 ? 'yellow' : 'grass',
    inLane: p.z < -40,
    menuOpen: isPanelOpen(),
  })
  lighting.update(dt, playerGroup.position)
  postfx.render()

  if (shownLoading) {
    readySince += dt
    if (avatarReady || readySince > 5) {
      shownLoading = false
      bloxity.notifyFirstFrame()
    }
  }
}
renderer.setAnimationLoop(() => frame())

window.addEventListener('beforeunload', () => {
  save()
  bloxity.teardown()
})

// Dev-only console hook, e.g. __game.teleport(0, 0, -39)
if (import.meta.env.DEV) {
  const teleport = (x, y, z, facing = player.facing) => {
    resetPlayer({ x, y, z }, facing)
    syncYawToPlayer()
  }
  // step(n, dt) runs n frames by hand (a hidden tab gets no animation frames).
  const step = (n = 1, dt = 1 / 30) => {
    for (let i = 0; i < n; i++) frame(dt)
  }
  // aimAt(animal): point the aim camera at it (testing).
  const aimAt = (a) => {
    const c = a.center(new Vector3())
    const e = new Vector3(player.position.x, player.position.y + 1.62, player.position.z)
    const d = c.sub(e)
    setView(Math.atan2(-d.x, -d.z), -Math.atan2(d.y, Math.hypot(d.x, d.z)))
  }
  window.__game = { step, aimAt, darts, player, scene, renderer, camera, postfx, bodies: bodyCount, toggleMode, teleport, state, animals, base, aim, events, bots, addMoney, LANE, net, playtime, openPanel,
    // Preview an area's look without travelling (the save is untouched): __game.lookAs('volcano')
    lookAs: (id, next = null) => {
      lane.setArea(id, next)
      world.setGround(AREAS[id], next && AREAS[next])
    },
  }
}
