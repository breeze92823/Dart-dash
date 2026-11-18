import * as THREE from 'three'
import { ACESFilmicToneMapping, Clock, Group, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'
import { AIM, AREA_IDS, BASES, BATTLE_PASS, CAMERA, FOG, LANE, LANE_AREAS, MUTATIONS, NET, SKINS, STUD, WEAPONS, WORLDS, areaAt, graphicsPreset, RENDER } from './config.js'
import * as bloxity from './bloxity.js'
import { install as installInput, onKey, setLockPolicy, isLocked } from './input.js'
import { installTouch } from './touch.js'
import { createPlayerBody, interpolate as interpolatePlayer, player, resetPlayer, respawn, setSpawn } from './player.js'
import { setCameraSensitivity, setView, syncYawToPlayer, update as updateCamera } from './camera.js'
import { onModeChanged, toggleMode } from './modes.js'
import { bodyCount, initPhysics, stepPhysics } from './physics.js'
import { createLighting } from './lighting.js'
import { createPostFx } from './postfx.js'
import { setNeonBloom } from './propkit.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { EmotePlayer } from './avatar/emotes.js'
import { buildWorld } from './world/world.js'
import { buildHub } from './world/hub.js'
import { buildLane } from './world/lane.js'
import { buildBarriers } from './world/barrier.js'
import { weaponThumb } from './ui/thumbs.js'
import { initParticles, setParticleQuality, updateParticles } from './fx/particles.js'
import { updateLabels } from './fx/labels.js'
import { AnimalManager } from './game/animals.js'
import { tickMutations } from './game/animalModels.js'
import { Darts } from './game/darts.js'
import { createAim } from './game/aim.js'
import { createBase } from './game/base.js'
import { createEvents } from './game/events.js'
import { createBoards } from './game/boards.js'
import { createCosmetics } from './game/cosmetics.js'
import { createRemotePlayers, packAvatar } from './game/remotePlayers.js'
import { createRemoteBases } from './game/remoteBases.js'
import { createDanger } from './game/danger.js'
import { addMoney, addXp, emit, enterArea, fmt, fmtTime, on, save, skinOwned, state, checkGoals, worldUnlocked } from './game/state.js'
import * as playtime from './game/playtime.js'
import { globalTop, roomRows, tickLeaderboards } from './game/leaderboards.js'
import { initNet, net, sendAvatar, sendBase, sendEmote, sendPose, setJoinPresence } from './net.js'
import * as hud from './ui/hud.js'
import { closePanel, isPanelOpen, onPanelChange, openPanel, tickShop } from './ui/panels.js'
import { installAudio, isMuted, setBusOn, setMuted, setMusic, sfx, updateAudio } from './audio/index.js'

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
const barriers = buildBarriers(scene)
setSpawn(BASES[0].spawn, BASES[0].facing)
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
// Bloxity emotes: the portal menu's pick plays on the avatar and is replayed on everyone's screen.
const localEmote = new EmotePlayer(() => animator?.rig?.bindings ?? [])
let emoteClips = new Map()
bloxity.loadEmotes().then((list) => (emoteClips = new Map(list.map((e) => [e.id, e.clip]))))
bloxity.onEmote((id) => {
  if (aim.active || !localEmote.play(id, emoteClips.get(id))) return
  sendEmote(id)
})
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
const boards = createBoards({ live: hub.live })
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
// Angry animals: entering the lane without a sleeping catch makes them attack (game/danger.js).
const danger = createDanger({ animals, base, hud, playerGroup })
// The other players of the room (net.players) and their bases (pen animals, treadmill, signs).
const remotePlayers = createRemotePlayers({ scene })
const remoteBases = createRemoteBases({ scene, live: hub.live, getMySlot: () => base.slot, remotePlayers })
// Bloxity chat: bubbles over the speakers (the SDK draws the chat UI itself).
bloxity.onChat((m) => {
  if (m?.isLocalPlayer) bloxity.attachChatBubble(THREE, playerGroup, bloxity.chatBubbleText(m), 2.6)
  else remotePlayers.onChat(m)
})
// Ad breaks (Bloxity can start one at any time): pause the simulation and mute until it ends.
let adPaused = false
let mutedBeforeAd = false
bloxity.onAdBreak((on) => {
  if (on === adPaused) return
  adPaused = on
  if (on) {
    mutedBeforeAd = isMuted()
    setMuted(true)
    if (isLocked()) document.exitPointerLock?.()
  } else setMuted(mutedBeforeAd)
})
// Where this player's base is: the server's slot assignment moves the pen, signs and spawn there.
let placedSlot = -1
function syncSlot() {
  const s = net.slot
  if (s < 0 || s === placedSlot) return
  const first = placedSlot < 0
  placedSlot = s
  base.setSlot(s)
  setSpawn(BASES[s].spawn, BASES[s].facing)
  if (!base.carrying) respawn() // walk out of the gate of your own base
  hud.toast(`Your base is number ${s + 1}${first ? '' : ' now'}`, { check: true })
}
setJoinPresence(
  () => ({ x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.facing, speed: 0 }),
  () => (bloxity.authState.user ? packAvatar(bloxity.getEquippedAvatar(), bloxity.getProportions()) : ''),
)
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
// Invite: a link into this very room (Bloxity builds it; friends also see the room in the portal).
hud.onAction('invite', async () => {
  const link = bloxity.inviteLink(net.room?.roomId)
  if (!link) return hud.toast('Invites work inside Bloxity', { error: true })
  try {
    await navigator.clipboard.writeText(link)
    hud.toast('Invite link copied! Up to 6 players per room', { check: true })
  } catch {
    hud.toast(link, { seconds: 8 })
  }
})
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
// Areas: every world lies along the lane (Meadow .. Volcano, config LANE_AREAS). Walking into one
// makes it the current world; the portal's TRAVEL drops you at an area's gate.
function trackArea() {
  const p = player.position
  const id = p.y < -2 ? areaAt(p.z) : null
  if (!id || id === state.world || !worldUnlocked(id)) return
  enterArea(id)
  hud.announce(`WELCOME TO THE ${WORLDS[id].name.toUpperCase()}!`, '#8dff6a', 3)
  sfx.fanfare()
}
on('travel', (id) => {
  const A = LANE_AREAS[id]
  if (!A) return
  closePanel()
  aim.exit()
  // Just inside the area, facing down the lane (the Meadow: at the foot of the slope).
  resetPlayer({ x: 0, y: LANE.y + 0.2, z: A.maxZ - (A.index === 0 ? 4 : 3) }, Math.PI)
  syncYawToPlayer()
  trackArea()
})
// The green barriers: each names the area behind it and the gun that opens it; owning the gun
// opens it. A newly opened area fills up with its animals right away.
let barrierKey = ''
function applyBarrier() {
  const key = `${AREA_IDS.map((id) => (worldUnlocked(id) ? 1 : 0)).join('')}|${state.cosmetics.skin}`
  if (key === barrierKey) return
  barrierKey = key
  AREA_IDS.slice(1).forEach((next, i) => {
    const gun = WORLDS[next].weapon
    const locked = !worldUnlocked(next)
    barriers.show(i, { area: WORLDS[next].name.toUpperCase(), locked, gun: WEAPONS[gun].name.toUpperCase(), price: fmt(WEAPONS[gun].price), imgSrc: locked ? weaponThumb(gun, state.cosmetics.skin) : null })
  })
  animals.fill()
}
for (const ev of ['worlds', 'weapon', 'cosmetic', 'hydrate']) on(ev, applyBarrier)
applyBarrier()
// View distance: short normally (the far areas are not drawn at all), the weapon's whole range
// while scoped so every animal it can reach is sharp. Eased so the fog does not pop.
const view = { near: FOG.near, far: FOG.far }
function applyView(dt) {
  let near = FOG.near
  let far = FOG.far
  if (aim.active && aim.scoped) {
    const range = (WEAPONS[state.weapon]?.range ?? 0) * STUD
    near = Math.max(near, range + AIM.scopeView.clear)
    far = Math.max(far, near + AIM.scopeView.fade)
  }
  const k = 1 - Math.exp(-6 * dt)
  view.near += (near - view.near) * k
  view.far += (far - view.far) * k
  if (scene.fog) {
    scene.fog.near = view.near
    scene.fog.far = view.far
  }
  lane.cull(camera.position.z, view.far + 10)
  ctx.camZ = camera.position.z
  ctx.viewDist = view.far + 10
}
// A whole save loaded (the server's): redraw everything that reads it.
on('hydrate', () => {
  applySettings()
  applySkin()
  hud.refreshHud()
  emit('weapon')
  checkGoals()
})
onPanelChange((p) => {
  if (p && isLocked()) document.exitPointerLock?.()
  // Banner ads only while a menu is open, never over gameplay.
  if (p) bloxity.adScreen('panel')
  else bloxity.hideAdScreen()
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
const ctx = { now: 0, near, showTags: false, camZ: 0, viewDist: FOG.far, camera }
const tmp = new Vector3()

let poseTimer = 0
let baseTimer = 0
const r2 = (v) => Math.round(v * 100) / 100

// What the others need to draw this player: sent ~10x/s (only when it changed).
function sendPresence(dt, speed) {
  if (!net.connected) return
  poseTimer -= dt
  if (poseTimer <= 0) {
    poseTimer = NET.poseEvery
    const c = base.carrying
    sendPose({
      x: r2(player.position.x),
      y: r2(player.position.y),
      z: r2(player.position.z),
      yaw: r2(player.facing),
      speed: r2(speed),
      tm: base.treadmillRunning,
      aim: aim.active,
      carry: c ? `${c.species}:${c.mutation || '_'}` : '',
    })
  }
  baseTimer -= dt
  if (baseTimer <= 0) {
    baseTimer = NET.baseEvery
    sendBase({
      animals: state.pen.animals.map((a) => ({ species: a.species, mutation: a.mutation || null })),
      level: state.pen.level,
      tml: state.treadmill.unlocked ? state.treadmill.level : -1,
      steps: state.steps,
      money: Math.floor(state.money),
      captures: state.captures,
      trail: state.cosmetics.trail || '',
      aura: state.cosmetics.aura || '',
      weapon: state.weapon || '',
      world: state.world || '',
    })
    if (bloxity.authState.user) sendAvatar(packAvatar(bloxity.getEquippedAvatar(), bloxity.getProportions()))
  }
}

function frame(forcedDt) {
  if (adPaused) return // an ad break: frozen until Bloxity ends it
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
  if (speed > 1.5 || aim.active) localEmote.stop() // moving or aiming ends an emote
  localEmote.update(dt)
  syncSlot()

  aim.update(dt, { carrying: !!base.carrying, menuOpen: isPanelOpen() })
  playerGroup.visible = !aim.active && !firstPerson
  if (aim.active) aim.updateCamera(dt)
  else {
    updateCamera(camera, dt)
    camera.position.add(danger.shakeOffset)
  }

  applyView(dt)
  trackArea()
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
  remotePlayers.update(dt)
  remoteBases.update(dt, ctx)
  sendPresence(dt, speed)
  danger.update(dt)
  cosmetics.update(dt, { moving: speed > 1.5, visible: playerGroup.visible })

  // Hub life: the portal swirls, shop pads breathe, mutations shimmer.
  if (hub.live.portal?.userData.swirl) hub.live.portal.userData.swirl.uniforms.time.value = elapsed
  barriers.update(elapsed)
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
    tickLeaderboards()
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
    boards.redrawBoards(playerName(), net.boards, roomRows(), globalTop)
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
  window.__game = { remotePlayers, remoteBases, step, aimAt, darts, player, scene, renderer, camera, postfx, bodies: bodyCount, toggleMode, teleport, state, animals, base, aim, events, boards, addMoney, LANE, net, playtime, openPanel, danger,
    lane, barriers,
    // Jump to an area's gate, open or not (testing): __game.goArea('volcano')
    goArea: (id) => {
      const A = LANE_AREAS[id]
      teleport(0, LANE.y + 0.2, A.maxZ - 3, Math.PI)
    },
  }
}
