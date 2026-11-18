// Aim mode: stepping onto the yellow band from the hub puts the player in a
// first-person aiming stance over the lane. Mouse (pointer lock) or touch drag
// aims, click / SHOOT fires, right-click / SCOPE zooms through a scope (- / +
// or the wheel change the zoom), E cycles darts, Q weapons, Alt frees the
// mouse, X / BACK leaves. Darts converge on the crosshair with their drop
// compensated, so what you see is what you hit.
import { Vector3 } from 'three'
import { AIM, BAND, DARTS, SPREAD, STUD, WEAPONS } from '../config.js'
import { inputState, isLocked, onKey, requestLock } from '../input.js'
import { getPitch, getYaw, setView, syncYawToPlayer } from '../camera.js'
import { player } from '../player.js'
import { raySegment } from '../physics.js'
import { getCameraSensitivity } from '../camera.js'
import { emit, state } from './state.js'
import { buildViewModel } from './weapons.js'
import { puff } from '../fx/particles.js'
import * as hud from '../ui/hud.js'
import { sfx } from '../audio/index.js'

const fwd = new Vector3()
const tmp = new Vector3()
const muzzle = new Vector3()
const aimPoint = new Vector3()

export function createAim({ camera, scene, darts, animals, playerName, onEnter, onExit }) {
  let active = false
  let scoped = false
  let zoom = 0
  let armed = true // re-arms once the player steps off the band onto the hub
  let cooldown = 0
  let triggerHeld = false
  let recoil = 0
  let swayX = 0
  let swayY = 0
  let viewModel = null
  let viewKey = ''
  let fovNow = AIM.fov
  let lastEmptyToast = 0
  let lookingAt = null
  scene.add(camera)

  function rebuildViewModel() {
    const key = `${state.weapon}|${state.cosmetics.skin}`
    if (key === viewKey && viewModel) return
    viewModel?.removeFromParent()
    viewModel = buildViewModel(state.weapon, state.cosmetics.skin)
    viewModel.scale.setScalar(0.62)
    viewModel.visible = active && !scoped
    camera.add(viewModel)
    viewKey = key
  }

  const onBand = () => {
    const p = player.position
    return p.z < BAND.z1 + 0.2 && p.z > BAND.z0 - 0.4 && p.y > -0.6
  }

  function enter() {
    active = true
    armed = false
    scoped = false
    zoom = 0
    cooldown = 0.25
    // Face the lane, slightly down.
    setView(0, 0.12)
    player.facing = Math.PI
    player.locked = true
    player.velocity.x = player.velocity.z = 0
    rebuildViewModel()
    viewModel.visible = true
    hud.setAiming(true)
    hud.setScoped(false)
    hud.setHints(false)
    sfx.switchWeapon()
    onEnter?.()
  }

  function exit() {
    if (!active) return
    active = false
    scoped = false
    triggerHeld = false
    player.locked = false
    if (viewModel) viewModel.visible = false
    hud.setAiming(false)
    hud.setScoped(false)
    if (isLocked()) document.exitPointerLock?.()
    camera.fov = AIM.fov
    camera.updateProjectionMatrix()
    syncYawToPlayer()
    onExit?.()
  }

  function setScope(on) {
    if (!active || on === scoped) return
    scoped = on
    viewModel.visible = !on
    hud.setScoped(on)
    hud.setHints(on)
    sfx.scope(on)
  }
  // The equipped weapon's scope: how many of AIM.scopeFovs it can use.
  const maxZoom = () => Math.max(0, Math.min(AIM.scopeFovs.length, WEAPONS[state.weapon]?.zooms ?? AIM.scopeFovs.length) - 1)
  function stepZoom(d) {
    if (!scoped) {
      if (d > 0) setScope(true)
      return
    }
    const next = Math.max(0, Math.min(maxZoom(), zoom + d))
    if (next === zoom) {
      if (d < 0) setScope(false)
      return
    }
    zoom = next
    sfx.zoomStep(d > 0)
  }

  function cycleDart() {
    const ids = Object.keys(DARTS).filter((id) => (state.darts[id] ?? 0) > 0)
    if (!ids.length) return
    const i = ids.indexOf(state.dartType)
    state.dartType = ids[(i + 1) % ids.length]
    sfx.switchWeapon()
    emit('darts')
    hud.toast(`${DARTS[state.dartType].name} darts`)
  }
  function cycleWeapon() {
    const ids = Object.keys(WEAPONS).filter((id) => state.weapons[id])
    if (ids.length < 2) {
      hud.toast('Buy more weapons in the ARMORY')
      return
    }
    state.weapon = ids[(ids.indexOf(state.weapon) + 1) % ids.length]
    sfx.switchWeapon()
    emit('weapon')
  }

  // Where the crosshair points: the first animal or surface within range.
  function trace(range) {
    camera.getWorldDirection(fwd)
    const a = camera.position
    const b = tmp.copy(a).addScaledVector(fwd, range)
    const hit = animals.hitTest(a, b)
    const wall = raySegment(a.x, a.y, a.z, b.x, b.y, b.z)
    if (hit && (!wall || hit.t <= wall.t)) return { point: hit.point, dist: hit.t * range, animal: hit.animal }
    if (wall) return { point: new Vector3(wall.x, wall.y, wall.z), dist: wall.t * range, animal: null }
    return null
  }

  function fire() {
    if (!active || cooldown > 0) return
    const type = state.dartType
    if ((state.darts[type] ?? 0) <= 0) {
      // Switch to any dart type still in stock, else complain.
      const other = Object.keys(DARTS).find((id) => (state.darts[id] ?? 0) > 0)
      if (other) {
        state.dartType = other
        emit('darts')
      } else {
        sfx.empty()
        cooldown = 0.3
        if (performance.now() - lastEmptyToast > 2500) {
          lastEmptyToast = performance.now()
          hud.toast('Out of darts! Buy more at the Dart Shop', { error: true })
        }
        return
      }
    }
    const w = WEAPONS[state.weapon]
    cooldown = w.cooldown
    state.darts[state.dartType]--
    emit('darts')

    camera.updateMatrixWorld(true)
    camera.getWorldDirection(fwd)
    if (scoped || !viewModel) muzzle.copy(camera.position).addScaledVector(fwd, 0.5).y -= 0.08
    else viewModel.userData.muzzle.getWorldPosition(muzzle)
    const range = w.range * STUD
    const t = trace(range * 1.05)
    if (t) aimPoint.copy(t.point)
    else aimPoint.copy(camera.position).addScaledVector(fwd, range)
    const dir = aimPoint.clone().sub(muzzle)
    const dist = dir.length()
    dir.normalize()
    // The weapon's spread (WEAPONS[w].spread): a small random wobble, halved through the scope.
    const sp = (SPREAD[w.spread] ?? 0) * (scoped ? 0.5 : 1)
    if (sp > 0) {
      dir.x += (Math.random() - 0.5) * 2 * sp
      dir.y += (Math.random() - 0.5) * 2 * sp
      dir.z += (Math.random() - 0.5) * 2 * sp
      dir.normalize()
    }
    // Lift the shot to cancel the drop over its flight time.
    const flight = dist / w.speed
    const vel = dir.multiplyScalar(w.speed)
    vel.y += 0.5 * w.drop * flight
    darts.fire(muzzle, vel, state.weapon, state.dartType, { name: playerName(), isPlayer: true })
    recoil = 1
    setView(getYaw(), getPitch() - 0.012 * (scoped ? 0.4 : 1)) // a little kick up
    if (!scoped) puff(muzzle, '#ffffff', 4, 0.4, 0.18)
    sfx.fire(state.weapon)
  }

  // --- Input -----------------------------------------------------------------------------------
  const canvas = () => document.querySelector('canvas')
  window.addEventListener('pointerdown', (e) => {
    if (!active || e.target !== canvas() || e.pointerType !== 'mouse') return
    if (e.button === 2) {
      setScope(!scoped)
      return
    }
    if (e.button === 0) {
      if (isLocked()) {
        triggerHeld = true
        fire()
      } else requestLock()
    }
  })
  window.addEventListener('pointerup', (e) => {
    if (e.button === 0) triggerHeld = false
  })
  onKey('KeyX', () => active && exit())
  onKey('AltLeft', () => active && isLocked() && document.exitPointerLock?.())
  onKey('AltRight', () => active && isLocked() && document.exitPointerLock?.())
  hud.onAction('back', exit)
  hud.onAction('scope', () => setScope(!scoped))
  hud.onAction('zoomIn', () => stepZoom(1))
  hud.onAction('zoomOut', () => stepZoom(-1))
  hud.onAction('shoot', (b) => {
    triggerHeld = true
    fire()
    const up = () => {
      triggerHeld = false
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  })

  return {
    get active() {
      return active
    },
    get scoped() {
      return scoped
    },
    exit,
    cycleDart,
    cycleWeapon,
    rebuildViewModel,
    canAim: () => !active,
    // Per frame, before the camera. ctx: { carrying, menuOpen }
    update(dt, ctx) {
      cooldown = Math.max(0, cooldown - dt)
      hud.setCooldown(cooldown)
      if (!active) {
        if (!onBand() && player.position.z > BAND.z1 + 0.6) armed = true // back on the hub
        if (armed && onBand() && !ctx.carrying && !ctx.menuOpen && player.velocity.z <= 0.5) enter()
        return
      }
      if (ctx.carrying) {
        exit()
        return
      }
      rebuildViewModel()
      if (triggerHeld && cooldown <= 0) fire()
      // Wheel = zoom while aiming.
      if (inputState.zoom !== 0) {
        stepZoom(inputState.zoom < 0 ? 1 : -1)
        inputState.zoom = 0
      }
    },
    // Replaces camera.update while aiming.
    updateCamera(dt) {
      if (zoom > maxZoom()) zoom = maxZoom() // switched to a weapon with a shorter scope
      const targetFov = scoped ? AIM.scopeFovs[zoom] : AIM.fov
      fovNow += (targetFov - fovNow) * (1 - Math.exp(-14 * dt))
      const sens = AIM.sensitivity * getCameraSensitivity() * (fovNow / AIM.fov)
      let yaw = getYaw() - inputState.look.dx * sens
      let pitch = getPitch() + inputState.look.dy * sens
      swayX += (inputState.look.dx * 0.0015 - swayX) * Math.min(1, dt * 10)
      swayY += (inputState.look.dy * 0.0015 - swayY) * Math.min(1, dt * 10)
      inputState.look.dx = inputState.look.dy = 0
      pitch = Math.max(AIM.minPitch, Math.min(AIM.maxPitch, pitch))
      setView(yaw, pitch)
      player.facing = yaw + Math.PI
      const p = player.renderPosition
      const eye = p.y + AIM.eye
      const cp = Math.cos(pitch)
      camera.position.set(p.x, eye, p.z)
      camera.lookAt(p.x - Math.sin(yaw) * cp, eye - Math.sin(pitch), p.z - Math.cos(yaw) * cp)
      if (Math.abs(camera.fov - fovNow) > 0.01) {
        camera.fov = fovNow
        camera.updateProjectionMatrix()
      }
      // View model: rest pose, recoil kick, look sway, breathing.
      recoil = Math.max(0, recoil - dt * 6)
      if (viewModel) {
        const t = performance.now() / 1000
        const long = state.weapon !== 'pistol'
        viewModel.position.set(long ? 0.26 : 0.24, (long ? -0.3 : -0.26) + Math.sin(t * 1.6) * 0.005 + swayY * 0.3, (long ? -0.36 : -0.48) + recoil * 0.07)
        viewModel.rotation.set(-0.02 + recoil * 0.1 - swayY * 0.4, Math.PI + 0.1 - swayX * 0.5, swayX * 0.25 + 0.05)
      }
      // Distance readout + crosshair lock.
      const range = WEAPONS[state.weapon].range * STUD
      const tr = trace(Math.max(range * 2, 200))
      lookingAt = tr?.animal ?? null
      hud.setDistance(tr ? tr.dist / STUD : null)
      hud.setLockOn(!!lookingAt && !lookingAt.asleep && tr.dist <= range)
    },
  }
}
