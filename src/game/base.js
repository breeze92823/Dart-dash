// The capture loop after the dart: pick up a sleeping animal (E / tap the
// prompt), carry it overhead (slower for heavy ones) back to your base before
// it wakes, and it is placed in the pen the moment you step inside. Pen animals
// earn $ every second with a "+N $" pop. Also: shop pads, the gift, portal,
// pen-upgrade sign and the treadmill (steps = permanent speed).
import { Color, Vector3 } from 'three'
import { ANIMALS, BASE, CARRY, DARTS, FREE_DARTS, MUTATIONS, PEN, POSES, RARITIES, TREADMILL } from '../config.js'
import { player } from '../player.js'
import { addLabel, popLabel } from '../fx/labels.js'
import { CELL, cashBurst, confetti, dust, emit as fx, ringPulse, sparkle } from '../fx/particles.js'
import { BELT_TILE } from '../world/hub.js'
import { Animal, displayName, landedFx } from './animals.js'
import { animalThumb } from '../ui/thumbs.js'
import { addMoney, addSteps, addToPen, emit, fmt, incomePerSec, on, penCapacity, penUpgradePrice, save, speedBonus, state, stepsPerStep, unlockTreadmill, upgradePen } from './state.js'
import * as hud from '../ui/hud.js'
import { openPanel, isPanelOpen } from '../ui/panels.js'
import { sfx } from '../audio/index.js'

const tmp = new Vector3()
const inside = (z, p, pad = 0) => p.x > z.minX - pad && p.x < z.maxX + pad && p.z > z.minZ - pad && p.z < z.maxZ + pad && p.y > -1

export function createBase({ scene, animals, hubZones, live, playerGroup, getAnimator, playerName, onCaptured }) {
  const pen = [] // Animal (mode 'pen')
  let carried = null
  let warnTimer = 0
  let fullWarned = false
  let incomeTimer = 1
  let stepTimer = 0
  const inZone = new Set()

  // --- Prompt (one shared proximity prompt) -----------------------------------------------------
  const promptPos = new Vector3()
  const prompt = addLabel({ pos: promptPos, size: 0.9, min: 0.35, max: 0.85, maxDist: 30, className: 'wl-prompt' })
  prompt.visible = false
  let promptAction = null
  let promptKey = ''
  function showPrompt(pos, title, sub, action) {
    promptPos.copy(pos)
    const key = `${title}|${sub}`
    if (key !== promptKey) {
      promptKey = key
      prompt.html = `<div class="key">E</div><div>${title}${sub ? `<span class="sub">${sub}</span>` : ''}</div>`
    }
    prompt.visible = true
    promptAction = action
  }
  prompt.el.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    promptAction?.()
  })

  // --- Pen animals --------------------------------------------------------------------------------
  function spawnPenAnimal(entry, at = null) {
    const a = new Animal(entry.species, entry.mutation, { income: entry.income, mode: 'pen' })
    a.entryId = entry.id
    if (at) a.pos.copy(at)
    else a.pos.set(BASE.minX + 3 + Math.random() * (BASE.maxX - BASE.minX - 6), 0, BASE.minZ + 3 + Math.random() * (BASE.maxZ - BASE.minZ - 6))
    a.pos.y = 0
    a.groundAt = 0
    a.pickTarget()
    scene.add(a.model)
    pen.push(a)
    return a
  }
  for (const e of state.pen.animals) spawnPenAnimal(e)
  // Selling / storing / equipping in the ZOO window: keep the 3D pen in step with the active list.
  function syncPen(fx = true) {
    for (let i = pen.length - 1; i >= 0; i--) {
      if (!state.pen.animals.some((e) => e.id === pen[i].entryId)) {
        if (fx) sparkle(tmp.copy(pen[i].pos).setY(1), '#ffffff', 10)
        pen[i].dispose()
        pen.splice(i, 1)
      }
    }
    for (const e of state.pen.animals) {
      if (pen.some((a) => a.entryId === e.id)) continue
      const a = spawnPenAnimal(e)
      if (fx) sparkle(tmp.copy(a.pos).setY(1), e.mutation ? MUTATIONS[e.mutation].color : '#ffffff', 12)
    }
    redrawSigns()
  }
  on('pen', () => syncPen(true))
  // A whole save loaded (the server's): rebuild the pen from scratch.
  on('hydrate', () => {
    for (const a of pen) a.dispose()
    pen.length = 0
    syncPen(false)
  })

  // --- Signs --------------------------------------------------------------------------------------
  function redrawSigns() {
    const up = penUpgradePrice()
    live.upgradeSign.redraw(state.pen.level, up == null ? 'MAX' : `${fmt(up)} $`)
    const t = state.treadmill
    if (!t.unlocked) live.treadmillSign.redraw('UNLOCK', 'TREADMILL', `${fmt(TREADMILL.unlock)} $`)
    else {
      const p = TREADMILL.upgrade[t.level]
      live.treadmillSign.redraw('TREADMILL', `LVL ${t.level + 1}`, p == null ? 'MAX' : `${fmt(p)} $`)
    }
    live.stepLabel.html = `+${fmt(stepsPerStep())}/STEP`
  }
  redrawSigns()
  on('treadmill', redrawSigns)
  on('cosmetic', redrawSigns) // the trail multiplies steps per step
  on('boost', redrawSigns) // Treadmill x2

  // --- Pick up / carry / place ----------------------------------------------------------------------
  function pickUp(a) {
    if (carried || a.state !== 'asleep') return
    carried = a
    a.state = 'carried'
    a.carriedBy = playerName()
    a.carriedByPlayer = true
    a.clearDarts()
    player.speedMult = a.def.weight
    getAnimator()?.setOverlay(POSES.carry)
    hud.setCarrying(true)
    sfx.pickup()
    sparkle(tmp.copy(a.pos).setY(a.pos.y + 1), '#ffffff', 10, 3)
    // New players get told where to go; the YOUR BASE marker does it after that.
    if (state.captures < 3) hud.toast(`Run it back to your base! ${Math.ceil(a.sleepLeft)}s`)
  }
  function release(woke) {
    if (!carried) return
    const a = carried
    carried = null
    player.speedMult = 1
    getAnimator()?.setOverlay(null)
    hud.setCarrying(false)
    if (woke) {
      // It jumps down beside you and bolts.
      a.pos.set(player.position.x + Math.sin(player.facing) * 1.4, player.position.y, player.position.z + Math.cos(player.facing) * 1.4)
      a.groundTimer = 0
      sfx.escaped()
      hud.toast(`The ${a.def.name} woke up and escaped!`, { error: true })
    }
  }
  function place() {
    const a = carried
    if (state.pen.animals.length >= penCapacity() && state.storage.length >= PEN.storage) {
      if (!fullWarned) {
        fullWarned = true
        sfx.deny()
        hud.toast(`Zoo full! Sell animals or buy an active slot in ZOO`, { error: true, seconds: 3.5 })
      }
      return
    }
    const info = a.info()
    const isNew = !state.discovered[info.species]
    const added = addToPen(info)
    if (!added) return
    const entry = added.entry
    release(false)
    animals.remove(a)
    if (added.where === 'storage') {
      // No free active slot: it goes to storage (no pen model, no income until equipped).
      const rar = RARITIES[ANIMALS[entry.species].rarity]
      const mut = entry.mutation ? MUTATIONS[entry.mutation] : null
      sfx.place(rar.tier)
      confetti(tmp.copy(player.position).setY(1.5), 20)
      if (isNew) hud.newSpecies({ img: animalThumb(entry.species, entry.mutation), name: `${mut ? mut.name + ' ' : ''}${ANIMALS[entry.species].name}`, rarity: rar.name, color: rar.color, nameColor: mut?.color })
      hud.toast(`Active slots full: the ${ANIMALS[entry.species].name} went to STORAGE (ZOO)`, { seconds: 3.5 })
      onCaptured?.(entry, info, null)
      save()
      return
    }
    const spot = new Vector3(player.position.x + Math.sin(player.facing) * 1.5, 0, player.position.z + Math.cos(player.facing) * 1.5)
    spot.x = Math.min(BASE.maxX - 2, Math.max(BASE.minX + 2, spot.x))
    spot.z = Math.min(BASE.maxZ - 2, Math.max(BASE.minZ + 2, spot.z))
    const pa = spawnPenAnimal(entry, spot)
    const tier = RARITIES[ANIMALS[entry.species].rarity].tier
    const fxAt = tmp.copy(spot).setY(1.2)
    confetti(fxAt, 30 + tier * 15)
    cashBurst(fxAt, 10 + tier * 6)
    ringPulse(fxAt, '#ffffff', 5)
    landedFx(fxAt, entry.mutation)
    sfx.place(tier)
    popLabel(new Vector3(spot.x, 3.2, spot.z), `+${fmt(entry.income)} $/s`, 'big', { rise: 2.2, life: 2 })
    const rar = RARITIES[ANIMALS[entry.species].rarity]
    if (isNew) {
      // First of its kind: the NEW SPECIES! card with its portrait.
      const mut = entry.mutation ? MUTATIONS[entry.mutation] : null
      hud.newSpecies({ img: animalThumb(entry.species, entry.mutation), name: `${mut ? mut.name + ' ' : ''}${ANIMALS[entry.species].name}`, rarity: rar.name, color: rar.color, nameColor: mut?.color })
      sfx.levelUp()
    } else hud.announce(`${displayName(entry.species, entry.mutation).toUpperCase()} ${ANIMALS[entry.species].name.toUpperCase()} CAPTURED!`, rar.color, 2.6)
    onCaptured?.(entry, info, pa)
    save()
  }

  // --- Treadmill machine: belt, rollers, fan, LEDs, console screen, the runner's sweat ----------------
  const mill = live.mill
  const TM = BASE.treadmill
  const millPull = { x: 0, z: 1, cx: TM.x, cz: TM.z + 0.3 } // belt carries you toward +z (the mill faces -z)
  const ledIdle = new Color('#3fe0ff')
  const ledLocked = new Color('#ff3b3b')
  const ledFlash = new Color('#ffffff')
  const screenData = { locked: true, steps: '0', perStep: '1', bonus: '0.0', next: 0, bpm: 72, run: 0, banner: '', blink: false }
  let millRun = 0 // 0 idle .. 1 full speed, eased
  let millT = 0
  let screenTimer = 0
  let sweatTimer = 0
  let windTimer = 0
  let gritTimer = 0
  let flash = 0
  let bannerLeft = 0
  const rnd = (a, b) => a + Math.random() * (b - a)

  function millSpeedUp() {
    flash = 1
    bannerLeft = 1.8
    screenTimer = 0
    const p = player.position
    ringPulse(tmp.set(TM.x, 0.5, TM.z), '#5dffc0', 7)
    sparkle(tmp.set(p.x, p.y + 1.4, p.z), '#5dffc0', 18, 5)
    confetti(tmp.set(p.x, p.y + 2.2, p.z), 24)
  }

  function animateMill(dt, training, ctx) {
    if (!mill) return
    millT += dt
    const unlocked = state.treadmill.unlocked
    millRun += ((training ? 1 : 0) - millRun) * Math.min(1, dt * (training ? 5 : 1.6))
    if (millRun < 0.002) millRun = 0
    const speed = Math.hypot(player.velocity.x, player.velocity.z)
    const v = millRun * Math.min(7, 2.5 + speed * 0.4) // belt surface m/s (capped so the slats don't strobe)
    if (v > 0) {
      live.belt.offset.y = (live.belt.offset.y - (dt * v) / BELT_TILE) % 1
      for (const r of mill.rollers) r.rotation.x = (r.rotation.x + (dt * v) / mill.rollerR) % (Math.PI * 2)
    }
    mill.fan.rotation.z = (mill.fan.rotation.z - dt * millRun * 24) % (Math.PI * 2)
    mill.group.position.y = mill.baseY + Math.abs(Math.sin(millT * 13)) * 0.014 * millRun // motor rumble

    // LED strips: dim red while locked, a slow cyan breath when ready, a fast pulse while running.
    flash = Math.max(0, flash - dt * 1.2)
    const led = mill.led
    if (!unlocked) {
      led.emissive.copy(ledLocked)
      led.emissiveIntensity = 0.3 + 0.15 * Math.sin(millT * 3)
    } else {
      led.emissive.copy(ledIdle).lerp(ledFlash, flash)
      led.emissiveIntensity = 0.5 + 0.2 * Math.sin(millT * 2) + millRun * (1.1 + 0.7 * Math.sin(millT * 14)) + flash * 3
    }

    // Console screen, refreshed a few times a second while the camera is near.
    bannerLeft = Math.max(0, bannerLeft - dt)
    screenTimer -= dt
    if (screenTimer <= 0 && ctx.near(tmp.set(TM.x, 2, TM.z), 40)) {
      screenTimer = 0.25
      const bonus = speedBonus()
      screenData.locked = !unlocked
      screenData.steps = fmt(state.steps)
      screenData.perStep = fmt(stepsPerStep())
      screenData.bonus = bonus.toFixed(1)
      screenData.next = bonus >= TREADMILL.maxBonus ? 1 : (state.steps % TREADMILL.stepsPer) / TREADMILL.stepsPer
      screenData.run = millRun
      screenData.bpm = Math.round(72 + millRun * 78 + (millRun > 0.5 ? rnd(-3, 3) : 0))
      screenData.blink = !screenData.blink
      screenData.banner = bannerLeft > 0 ? 'SPEED UP!' : ''
      mill.screen.redraw(screenData)
    }

    if (!training) return
    const p = player.position
    // Sweat drops flicked off to the sides.
    sweatTimer -= dt
    if (sweatTimer <= 0) {
      sweatTimer = rnd(0.3, 0.6)
      const a = player.facing + (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 2 + rnd(-0.4, 0.4))
      const s = rnd(1, 2)
      fx({ x: p.x, y: p.y + 1.9, z: p.z, vx: Math.sin(a) * s, vy: rnd(1.6, 2.8), vz: Math.cos(a) * s, life: 0.75, size: 0.17, size2: 0.1, gravity: 12, alpha: 0.95 }, '#8fe3ff')
    }
    // Wind streaks rushing past the runner, the way the belt goes.
    windTimer -= dt
    if (windTimer <= 0) {
      windTimer = 0.07
      const w = 6 + v
      fx({ x: p.x + rnd(-0.8, 0.8), y: p.y + rnd(0.3, 2), z: p.z + rnd(-0.6, 0.2), vx: millPull.x * w, vz: millPull.z * w, life: 0.3, size: 0.11, size2: 0.02, alpha: 0.6 }, '#ffffff', true)
    }
    // Grit thrown off the back roller.
    gritTimer -= dt
    if (gritTimer <= 0) {
      gritTimer = rnd(0.15, 0.35)
      fx({ x: TM.x + rnd(-0.8, 0.8), y: 0.4, z: TM.z + 2.35, vx: rnd(-0.4, 0.4), vy: rnd(0.6, 1.6), vz: v * 0.5 + rnd(0, 1), life: 0.5, size: 0.08, gravity: 9, cell: CELL.square, rot: rnd(0, 6) }, '#5a5e68')
    }
  }

  // --- Zones ------------------------------------------------------------------------------------------
  const zone = (id) => hubZones.find((z) => z.id === id)
  const penZone = zone('pen')
  const treadZone = zone('treadmill')
  function enterZone(z) {
    if (z.kind === 'shop') {
      if (z.id === 'darts') {
        const total = Object.values(state.darts).reduce((s, n) => s + n, 0)
        if (total < FREE_DARTS.below && state.money < DARTS.basic.price) {
          state.darts.basic += FREE_DARTS.give
          emit('darts')
          hud.toast(`Free refill: +${FREE_DARTS.give} Basic darts`)
          sfx.gift()
        }
        openPanel('darts')
      } else openPanel({ weapons: 'armory', trails: 'trailShop', skins: 'skinShop', auras: 'auraShop' }[z.id] ?? 'darts')
      ringPulse(tmp.set(z.x, 0.3, z.z), '#ffffff', 6)
    } else if (z.kind === 'portal') {
      sfx.portal()
      openPanel('worlds')
    }
  }

  function updateZones() {
    const p = player.position
    let best = null
    for (const z of hubZones) {
      let here
      if (z.r != null) here = Math.hypot(p.x - z.x, p.z - z.z) < z.r && p.y > -1
      else here = inside(z, p)
      if (here && !inZone.has(z.id)) {
        inZone.add(z.id)
        if (!isPanelOpen()) enterZone(z)
      } else if (!here && inZone.has(z.id)) inZone.delete(z.id)
      if (here && (z.kind === 'gift' || z.kind === 'upgradePen' || z.kind === 'treadmillSign')) best = z
    }
    if (!inZone.has('pen')) fullWarned = false
    return best
  }

  function promptFor(z) {
    if (z.kind === 'gift') {
      const ready = state.giftAt <= Date.now()
      showPrompt(tmp.set(z.x, 2.6, z.z - 1), ready ? 'Open Gift' : 'Gift', ready ? 'Free reward!' : 'Not ready yet', () => openPanel('gift'))
    } else if (z.kind === 'upgradePen') {
      const up = penUpgradePrice()
      showPrompt(tmp.set(z.x + 1.5, 2.6, z.z), up == null ? 'Pen maxed' : 'Upgrade Pen', up == null ? `${penCapacity()} active slots` : `$${fmt(up)} · +1 active slot`, () => {
        if (up == null) return
        if (upgradePen()) {
          sfx.purchase()
          confetti(tmp.set(BASE.minX + 2, 2, (BASE.minZ + BASE.maxZ) / 2), 30)
          hud.toast(`+1 active slot! ${penCapacity()} animals earn now`)
          save()
        } else {
          sfx.deny()
          hud.toast('Not enough money', { error: true })
        }
      })
    } else if (z.kind === 'treadmillSign') {
      const t = state.treadmill
      const price = t.unlocked ? TREADMILL.upgrade[t.level] : TREADMILL.unlock
      showPrompt(tmp.set(z.x, 2.6, z.z), t.unlocked ? (price == null ? 'Treadmill maxed' : 'Upgrade Treadmill') : 'Unlock Treadmill', price == null ? '' : `$${fmt(price)}`, () => {
        if (price == null) return
        if (unlockTreadmill()) {
          sfx.purchase()
          hud.toast(t.unlocked && t.level > 0 ? `Treadmill level ${t.level + 1}!` : 'Treadmill unlocked! Walk on it to earn steps (speed)')
          save()
        } else {
          sfx.deny()
          hud.toast('Not enough money', { error: true })
        }
      })
    }
  }

  return {
    // E / tap: run whatever the prompt offers.
    interact() {
      if (!player.locked && promptAction && prompt.visible) promptAction()
    },
    get carrying() {
      return carried
    },
    pen,
    update(dt, ctx) {
      // Pen animals live their lives.
      for (const a of pen) a.update(dt, ctx)
      live.baseMarker?.el.classList.toggle('pulse', !!carried) // YOUR BASE bobs while you carry one home

      // Carried animal rides overhead; it may wake.
      if (carried) {
        const a = carried
        if (a.state !== 'carried') release(true)
        else {
          const pp = playerGroup.position
          a.pos.set(pp.x, pp.y + 2.05 + a.def.radius * 0.15, pp.z)
          a.model.rotation.set(0, player.facing + Math.PI / 2, 0)
          warnTimer -= dt
          if (a.sleepLeft < 6 && warnTimer <= 0) {
            warnTimer = a.sleepLeft < 2.5 ? 0.25 : 0.5
            sfx.warnTick(a.sleepLeft < 2.5)
          }
          if (inside(penZone, player.position)) place()
        }
      }

      // Prompts: a sleeping animal in reach, else a hub sign.
      prompt.visible = false
      promptAction = null
      const sign = updateZones()
      if (!carried && !player.locked) {
        const a = animals.nearestSleeping(player.position, CARRY.pickupRange)
        if (a) showPrompt(tmp.copy(a.pos).setY(a.pos.y + 1.6), 'Pick Up', `${a.mutation ? MUTATIONS[a.mutation].name + ' ' : ''}${a.def.name} · ${Math.ceil(a.sleepLeft)}s`, () => pickUp(a))
        else if (sign) promptFor(sign)
      }

      // Income: every second, with pops over animals near you.
      incomeTimer -= dt
      if (incomeTimer <= 0) {
        incomeTimer += 1
        const inc = incomePerSec()
        if (inc > 0) {
          addMoney(inc, true)
          const mult = inc / Math.max(1, pen.reduce((s, a) => s + a.income, 0))
          for (const a of pen) {
            if (ctx.near(a.pos, 45)) {
              popLabel(tmp.copy(a.pos).setY(a.pos.y + a.rig.height + 0.3), `+${fmt(a.income * mult)} $`, '', { rise: 1.4, life: 1 })
              sfx.coinTick(a.pos)
            }
          }
        }
      }

      // Treadmill: steps while you walk on it.
      player.speedBonus = speedBonus()
      const onMill = inside(treadZone, player.position) && player.grounded
      const moving = Math.hypot(player.velocity.x, player.velocity.z) > 2
      const training = onMill && moving && state.treadmill.unlocked
      player.belt = training ? millPull : null
      animateMill(dt, training, ctx)
      if (onMill && moving) {
        if (!state.treadmill.unlocked) {
          if (stepTimer <= 0) {
            hud.toast(`Unlock the treadmill ($${TREADMILL.unlock}) at the sign`, { error: true })
            stepTimer = 3
          }
        } else if (stepTimer <= 0) {
          stepTimer = TREADMILL.stepEvery
          const n = stepsPerStep()
          const before = speedBonus()
          addSteps(n)
          sfx.treadStep()
          dust(player.position, 2)
          popLabel(tmp.set(player.position.x, player.position.y + 2.6, player.position.z), `+${fmt(n)}`, 'gold', { rise: 1, life: 0.7, size: 0.7 })
          if (speedBonus() > before) {
            hud.toast(`Speed up! +${speedBonus().toFixed(1)} m/s`)
            sfx.levelUp()
            millSpeedUp()
          }
        }
      }
      stepTimer -= dt
    },
  }
}
