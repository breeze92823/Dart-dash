// The capture loop after the dart: pick up a sleeping animal (E / tap the
// prompt), carry it overhead (slower for heavy ones) back to your base before
// it wakes, and it is placed in the pen the moment you step inside. Pen animals
// earn $ every second with a "+N $" pop. Also: shop pads, the gift, portal,
// pen-upgrade sign and the treadmill (steps = permanent speed). This drives the LOCAL player's base
// (the slot the server gave them, setSlot); the other players' bases are game/remoteBases.js.
import { Vector3 } from 'three'
import { ANIMALS, BASES, CARRY, DARTS, FREE_DARTS, MUTATIONS, PEN, POSES, RARITIES, TREADMILL } from '../config.js'
import { player } from '../player.js'
import { addLabel, popLabel } from '../fx/labels.js'
import { cashBurst, confetti, dust, ringPulse, sparkle } from '../fx/particles.js'
import { baseMarkerHtml } from '../world/hub.js'
import { animateMill, consoleView, millSpeedUp } from './treadmillFx.js'
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
  let mySlot = 0
  const mine = () => live.bases[mySlot]
  const myBase = () => BASES[mySlot]
  let carried = null
  let warnTimer = 0
  let fullWarned = false
  let incomeTimer = 1
  let stepTimer = 0
  let training = false
  const inZone = new Set()

  mine().marker.html = baseMarkerHtml('YOUR BASE')

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
    const a = new Animal(entry.species, entry.mutation, { income: entry.income, mode: 'pen', bounds: myBase() })
    a.entryId = entry.id
    if (at) a.pos.copy(at)
    else {
      const B = myBase()
      a.pos.set(B.minX + 3 + Math.random() * (B.maxX - B.minX - 6), 0, B.minZ + 3 + Math.random() * (B.maxZ - B.minZ - 6))
    }
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
    const b = mine()
    const up = penUpgradePrice()
    b.upgradeSign.redraw(state.pen.level, up == null ? 'MAX' : `${fmt(up)} $`)
    const t = state.treadmill
    if (!t.unlocked) b.treadmillSign.redraw('UNLOCK', 'TREADMILL', `${fmt(TREADMILL.unlock)} $`)
    else {
      const p = TREADMILL.upgrade[t.level]
      b.treadmillSign.redraw('TREADMILL', `LVL ${t.level + 1}`, p == null ? 'MAX' : `${fmt(p)} $`)
    }
    b.stepLabel.html = `+${fmt(stepsPerStep())}/STEP`
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
    const B = myBase()
    spot.x = Math.min(B.maxX - 2, Math.max(B.minX + 2, spot.x))
    spot.z = Math.min(B.maxZ - 2, Math.max(B.minZ + 2, spot.z))
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

  // --- Treadmill machine (game/treadmillFx.js animates it) -----------------------------------------------
  const runner = { x: 0, y: 0, z: 0, facing: 0, speed: 0 }
  function millView() {
    const bonus = speedBonus()
    return consoleView({ steps: state.steps, stepsText: fmt(state.steps), perStepText: fmt(stepsPerStep()), bonus })
  }
  const millPull = { x: 0, z: 1, cx: 0, cz: 0 } // belt carries you toward +z (the mill faces -z)
  function aimMill() {
    const TM = myBase().treadmill
    millPull.cx = TM.x
    millPull.cz = TM.z + 0.3
  }
  aimMill()

  // --- Zones ------------------------------------------------------------------------------------------
  const penZone = () => mine().penZone
  const treadZone = () => mine().treadZone
  const myZone = (z) => z.slot === undefined || z.slot === mySlot // a plot's zones only work for its owner
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
      if (!myZone(z)) continue
      let here
      if (z.r != null) here = Math.hypot(p.x - z.x, p.z - z.z) < z.r && p.y > -1
      else here = inside(z, p)
      if (here && !inZone.has(z.id)) {
        inZone.add(z.id)
        if (!isPanelOpen()) enterZone(z)
      } else if (!here && inZone.has(z.id)) inZone.delete(z.id)
      if (here && (z.kind === 'gift' || z.kind === 'upgradePen' || z.kind === 'treadmillSign')) best = z
    }
    if (!inZone.has(penZone().id)) fullWarned = false
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
          confetti(tmp.set(myBase().minX + 2, 2, (myBase().minZ + myBase().maxZ) / 2), 30)
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
    get slot() {
      return mySlot
    },
    get treadmillRunning() {
      return training
    },
    // The server gave this player base `slot` (0..ROOM_SIZE-1): move the pen, signs and treadmill
    // controls there. Returns false when nothing changed.
    setSlot(slot) {
      if (!Number.isInteger(slot) || slot < 0 || slot >= BASES.length || slot === mySlot) return false
      live.bases[mySlot].marker.el.classList.remove('pulse')
      mySlot = slot
      mine().marker.html = baseMarkerHtml('YOUR BASE')
      inZone.clear()
      aimMill()
      for (const a of pen) {
        a.bounds = myBase()
        a.pos.set(myBase().minX + 3 + Math.random() * (myBase().maxX - myBase().minX - 6), 0, myBase().minZ + 3 + Math.random() * (myBase().maxZ - myBase().minZ - 6))
        a.pickTarget()
      }
      redrawSigns()
      return true
    },
    update(dt, ctx) {
      // Pen animals live their lives.
      for (const a of pen) a.update(dt, ctx)
      mine().marker.el.classList.toggle('pulse', !!carried) // YOUR BASE bobs while you carry one home

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
          if (inside(penZone(), player.position)) place()
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
      const onMill = inside(treadZone(), player.position) && player.grounded
      const moving = Math.hypot(player.velocity.x, player.velocity.z) > 2
      training = onMill && moving && state.treadmill.unlocked
      player.belt = training ? millPull : null
      runner.x = player.position.x
      runner.y = player.position.y
      runner.z = player.position.z
      runner.facing = player.facing
      runner.speed = Math.hypot(player.velocity.x, player.velocity.z)
      animateMill(mine(), dt, { training, runner, unlocked: state.treadmill.unlocked, view: millView(), near: ctx.near })
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
            millSpeedUp(mine(), player.position)
          }
        }
      }
      stepTimer -= dt
    },
  }
}
