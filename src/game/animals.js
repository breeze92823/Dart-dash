// Animals: the lane population (wander, graze, flee, sleep, wake) and the pen
// animals (wander inside the base). One Animal class drives both; the manager
// keeps every area of the lane stocked with that area's animals by "1 in N" odds
// (luck boosts rares and mutations), runs dart hit tests and owns the floating
// labels (aiming tag, sleep ring, value, "!"). A lane animal lives in one area
// (`area`, config LANE_AREAS) and never leaves it.
import { AdditiveBlending, CylinderGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { ANIMALS, AREA_IDS, BASE, COARSE_POINTER, LANE, LANE_ANIMALS, LANE_AREAS, MUTATIONS, MUTATION_ORDER, RARITIES, SEASON, STUD, WORLDS, seasonAnimals, worldAnimals } from '../config.js'
import { groundY } from '../physics.js'
import { addLabel } from '../fx/labels.js'
import { hearts, puff, shimmer, sparkle, zee } from '../fx/particles.js'
import { buildAnimal } from './animalModels.js'
import { fmt, luckMult, state, worldUnlocked } from './state.js'
import { sfx } from '../audio/index.js'

const rnd = (a, b) => a + Math.random() * (b - a)
const TAU = Math.PI * 2
const tmp = new Vector3()
const fwd = new Vector3()
const RING = 2 * Math.PI * 54
const ZERO_POSE = { pitch: 0, push: 0, head: 0 }

// Seasonal animals are worth the mult of the area they roam (`world`) x SEASON.mult.
export function rollIncome(species, mutation, world = state.world) {
  const d = ANIMALS[species]
  const [lo, hi] = d.income
  const base = lo + (hi - lo) * Math.pow(Math.random(), 1.6)
  const season = d.world ? 1 : (WORLDS[world]?.mult ?? 1) * SEASON.mult
  return Math.max(1, Math.round(base * season * (mutation ? MUTATIONS[mutation].mult : 1)))
}
export const oddsOf = (species, mutation) => ANIMALS[species].odds * (mutation ? MUTATIONS[mutation].odds : 1)
export function displayName(species, mutation) {
  const r = RARITIES[ANIMALS[species].rarity]
  return `${mutation ? MUTATIONS[mutation].name + ' ' : ''}${r.name}`
}

let nextId = 1

export class Animal {
  constructor(species, mutation, { income, event = false, mode = 'lane', bounds = BASE, area = null } = {}) {
    this.id = nextId++
    this.bounds = bounds // the pen this animal lives in (config BASES[i])
    // The lane area it roams (its own world's area; a seasonal one the area it was spawned in).
    this.area = LANE_AREAS[area ?? ANIMALS[species]?.world ?? 'meadow'] ?? LANE_AREAS.meadow
    this.species = species
    this.def = ANIMALS[species]
    this.rarity = RARITIES[this.def.rarity]
    this.mutation = mutation
    this.income = income ?? rollIncome(species, mutation, this.area.id)
    this.event = event
    this.mode = mode
    this.model = buildAnimal(species, mutation)
    this.rig = this.model.userData.rig
    this.pos = this.model.position
    this.yaw = rnd(0, TAU)
    this.state = mode === 'pen' ? 'pen' : 'wander'
    this.hp = this.def.hp
    this.lastHit = -99
    this.sleepLeft = 0
    this.sleepTotal = 1
    this.sleptBy = ''
    this.target = new Vector3()
    this.wait = rnd(0, 2)
    this.phase = rnd(0, TAU)
    this.speedNow = 0
    this.fleeLeft = 0
    this.fleeFrom = new Vector3()
    this.alertLeft = 0
    this.zTimer = 0
    this.shimmerTimer = 0
    this.lieAmount = 0 // 0 standing .. 1 lying on its side
    this.gone = false
    this.age = 0
    this.stuck = [] // darts stuck in it
    this.groundTimer = 0
    this.labels = {}
    // Angry at the player (game/danger.js drives it): { phase, t, ... } or null. `ap` is the attack
    // pose (pitch: rear back < 0 < lunge, push: body slides forward, head: head down) eased in animate.
    this.anger = null
    this.ap = { pitch: 0, push: 0, head: 0 }
    this.apTarget = { pitch: 0, push: 0, head: 0 }
    this.pickTarget()
  }

  get asleep() {
    return this.state === 'asleep' || this.state === 'carried'
  }
  info() {
    return { species: this.species, mutation: this.mutation, income: this.income, event: this.event }
  }
  // Hit-sphere centre.
  center(out = tmp) {
    const lying = this.lieAmount > 0.5
    return out.set(this.pos.x, this.pos.y + (lying ? this.def.radius * 0.75 : this.rig.centerY), this.pos.z)
  }

  pickTarget() {
    if (this.mode === 'pen') {
      const B = this.bounds
      this.target.set(rnd(B.minX + 2, B.maxX - 2), 0, rnd(B.minZ + 2, B.maxZ - 2))
      return
    }
    const S = this.area.spawn
    if (this.def.zone === 'marsh') {
      const P = this.area.pond
      const a = rnd(0, TAU)
      const r = P.r + rnd(2.5, 9)
      this.target.set(P.x + Math.cos(a) * r, LANE.y, P.z + Math.sin(a) * r)
      return
    }
    // Mostly short hops from where it is, sometimes a long walk.
    const far = Math.random() < 0.25
    const d = far ? rnd(15, 40) : rnd(3, 12)
    const a = rnd(0, TAU)
    this.target.set(
      Math.min(S.maxX, Math.max(S.minX, this.pos.x + Math.cos(a) * d)),
      LANE.y,
      Math.min(S.maxZ, Math.max(S.minZ, this.pos.z + Math.sin(a) * d)),
    )
  }

  // --- Damage / sleep ------------------------------------------------------------------------
  // sleepSeconds: how long the dart puts it to sleep (DARTS[type].sleep).
  hit(damage, sleepSeconds, by, from, now, byPlayer = false) {
    if (this.asleep || this.state === 'pen') return false
    this.hp -= damage
    this.lastHit = now
    this.alertLeft = LANE_ANIMALS.alert
    if (this.hp <= 0) {
      this.fallAsleep(sleepSeconds, by)
      this.sleptByPlayer = byPlayer
      return true
    }
    if (this.anger) manager?.onAngryHit?.(this) // an angry one staggers instead of running off
    else this.flee(from)
    return false
  }
  fallAsleep(seconds, by) {
    this.anger = null
    this.state = 'asleep'
    this.sleepTotal = this.sleepLeft = seconds > 0 ? seconds : this.def.sleep
    this.sleptBy = by
    this.speedNow = 0
    this.alertLeft = 0
    for (const e of this.rig.eyesOpen) e.visible = false
    for (const e of this.rig.eyesClosed) e.visible = true
    sfx.sleepy(this.pos)
  }
  wake() {
    this.state = 'wander'
    this.hp = this.def.hp
    this.alertLeft = LANE_ANIMALS.alert
    this.fleeLeft = LANE_ANIMALS.wakeFlee
    this.fleeFrom.set(this.pos.x + rnd(-1, 1), 0, this.pos.z + 2)
    for (const e of this.rig.eyesOpen) e.visible = true
    for (const e of this.rig.eyesClosed) e.visible = false
    this.clearDarts()
    puff(tmp.copy(this.pos).setY(this.pos.y + 0.6), '#ffffff', 8)
    sfx.wake(this.pos)
  }
  flee(from) {
    this.fleeLeft = LANE_ANIMALS.wakeFlee * 0.6
    this.fleeFrom.copy(from)
    this.state = 'wander'
  }
  startle(from) {
    if (this.asleep || this.state === 'pen') return
    this.alertLeft = LANE_ANIMALS.alert
    if (this.fleeLeft <= 0) this.flee(from)
  }
  // A mutation dart turned it into `mutation`: new materials, income x the mutation's mult
  // (replacing any mutation it had). Keeps its pose, state and stuck darts.
  setMutation(mutation) {
    if (!MUTATIONS[mutation] || this.mutation === mutation) return false
    const old = this.mutation ? MUTATIONS[this.mutation].mult : 1
    this.income = Math.max(1, Math.round((this.income / old) * MUTATIONS[mutation].mult))
    this.mutation = mutation
    const prev = this.model
    const next = buildAnimal(this.species, mutation)
    next.position.copy(prev.position)
    next.rotation.copy(prev.rotation)
    for (const d of this.stuck) next.attach(d)
    if (this.beam) next.add(this.beam)
    prev.parent?.add(next)
    prev.removeFromParent()
    this.model = next
    this.pos = next.position
    const lie = this.rig.pose.rotation.clone()
    const lieP = this.rig.pose.position.clone()
    this.rig = next.userData.rig
    this.rig.pose.rotation.copy(lie)
    this.rig.pose.position.copy(lieP)
    for (const e of this.rig.eyesOpen) e.visible = !this.asleep
    for (const e of this.rig.eyesClosed) e.visible = this.asleep
    // Labels show the new mutation and income.
    for (const l of Object.values(this.labels)) l.remove()
    this.labels = {}
    sparkle(tmp.copy(this.pos).setY(this.pos.y + this.rig.centerY), MUTATIONS[mutation].color, 30, 6, 0.7)
    return true
  }
  stickDart(mesh) {
    this.model.attach(mesh)
    this.stuck.push(mesh)
  }
  clearDarts() {
    for (const d of this.stuck) d.removeFromParent()
    this.stuck.length = 0
  }

  // --- Per frame ---------------------------------------------------------------------------------
  update(dt, ctx) {
    this.age += dt
    const def = this.def
    const rig = this.rig
    this.alertLeft = Math.max(0, this.alertLeft - dt)

    if (this.state === 'asleep') {
      this.sleepLeft -= dt
      this.zTimer -= dt
      if (this.zTimer <= 0 && ctx.near(this.pos, 70)) {
        zee(tmp.copy(this.pos).setY(this.pos.y + def.radius * 1.4 + 0.4))
        this.zTimer = 0.9
      }
      if (this.sleepLeft <= 0) this.wake()
    } else if (this.state === 'carried') {
      this.sleepLeft -= dt
      if (this.sleepLeft <= 0) this.wake() // the carrier notices and drops it
    } else if (this.state === 'leaving') {
      this.moveToward(dt, this.target, def.speed * 2.4)
      if (this.pos.distanceTo(this.target) < 3) this.gone = true
    } else {
      // Wander / pen / flee.
      if (this.mode === 'lane' && this.hp < def.hp && ctx.now - this.lastHit > LANE_ANIMALS.hpRegen) this.hp = def.hp
      let speed = 0
      if (this.anger && manager?.angerStep) {
        manager.angerStep(this, dt, ctx)
      } else if (this.fleeLeft > 0) {
        this.fleeLeft -= dt
        const dx = this.pos.x - this.fleeFrom.x
        const dz = this.pos.z - this.fleeFrom.z
        const l = Math.hypot(dx, dz) || 1
        tmp.set(this.pos.x + (dx / l) * 6, this.pos.y, this.pos.z + (dz / l) * 6)
        this.clampToArea(tmp)
        speed = def.speed * 2.2
        this.moveToward(dt, tmp, speed)
        if (this.fleeLeft <= 0) this.pickTarget()
      } else if (this.wait > 0) {
        this.wait -= dt
        this.speedNow += (0 - this.speedNow) * Math.min(1, dt * 6)
      } else {
        speed = def.speed * (this.mode === 'pen' ? 0.55 : 1)
        if (this.moveToward(dt, this.target, speed) < 0.6) {
          this.wait = rnd(1, 4.5)
          this.pickTarget()
        }
      }
      if (this.mode === 'pen' && Math.random() < dt * 0.05) hearts(tmp.copy(this.pos).setY(this.pos.y + rig.height), 2)
    }

    // Ground follow (raycast a few times a second; lanes are mostly flat).
    if (this.state !== 'carried') {
      this.groundTimer -= dt
      if (this.groundTimer <= 0) {
        this.groundTimer = 0.15 + Math.random() * 0.1
        const gy = groundY(this.pos.x, this.pos.z, this.pos.y + 1.6, 6)
        this.groundAt = gy ?? (this.mode === 'pen' ? 0 : LANE.y)
      }
      this.pos.y += ((this.groundAt ?? this.pos.y) - this.pos.y) * Math.min(1, dt * 12)
    }

    if (this.model.visible) this.animate(dt) // past the view distance: AI only

    // Mutation shimmer.
    if (this.mutation || this.event) {
      this.shimmerTimer -= dt
      if (this.shimmerTimer <= 0 && ctx.near(this.pos, 110)) {
        this.shimmerTimer = COARSE_POINTER ? 0.3 : 0.14
        const color = this.mutation ? MUTATIONS[this.mutation].color : this.rarity.color
        shimmer(tmp.copy(this.pos).setY(this.pos.y + rig.centerY), this.mutation === 'rainbow' ? `hsl(${(this.age * 90) % 360},100%,70%)` : color, def.radius * 1.3)
      }
    }
  }

  clampToArea(p) {
    if (this.mode === 'pen') {
      const B = this.bounds
      p.x = Math.min(B.maxX - 1.5, Math.max(B.minX + 1.5, p.x))
      p.z = Math.min(B.maxZ - 1.5, Math.max(B.minZ + 1.5, p.z))
    } else {
      // Its own area, short of the barriers at either end.
      const A = this.area
      const S = A.spawn
      p.x = Math.min(S.maxX + 4, Math.max(S.minX - 4, p.x))
      p.z = Math.min(Math.min(S.maxZ + 2, A.maxZ - 1.5), Math.max(A.minZ + 2, p.z))
    }
  }

  // Steps toward p, steering round obstacles; returns the remaining distance.
  moveToward(dt, p, speed) {
    const dx = p.x - this.pos.x
    const dz = p.z - this.pos.z
    const dist = Math.hypot(dx, dz)
    if (dist < 0.05) return dist
    let wantYaw = Math.atan2(dx, dz)
    const diff = Math.atan2(Math.sin(wantYaw - this.yaw), Math.cos(wantYaw - this.yaw))
    this.yaw += diff * Math.min(1, dt * 5)
    this.speedNow += (speed - this.speedNow) * Math.min(1, dt * 4)
    const step = Math.min(dist, this.speedNow * dt * Math.max(0.2, Math.cos(diff)))
    let nx = this.pos.x + Math.sin(this.yaw) * step
    let nz = this.pos.z + Math.cos(this.yaw) * step
    // Push out of obstacles (trees, hay, fences, the pond).
    const r = this.def.radius
    for (const o of (this.mode === 'pen' ? null : manager?.obstacles?.[this.area.id]) ?? []) {
      const ox = nx - o.x
      const oz = nz - o.z
      const d = Math.hypot(ox, oz)
      const min = o.r + r * 0.8
      if (d < min && d > 1e-3) {
        nx = o.x + (ox / d) * min
        nz = o.z + (oz / d) * min
        if (this.fleeLeft <= 0 && Math.random() < 0.05) this.pickTarget()
      }
    }
    tmp.set(nx, 0, nz)
    this.clampToArea(tmp)
    this.pos.x = tmp.x
    this.pos.z = tmp.z
    return dist
  }

  animate(dt) {
    const rig = this.rig
    const lying = this.asleep ? 1 : 0
    this.lieAmount += (lying - this.lieAmount) * Math.min(1, dt * (lying ? 7 : 5))
    const L = this.lieAmount
    const moving = Math.min(1, this.speedNow / Math.max(0.5, this.def.speed))
    this.phase += dt * (3 + this.speedNow * 3.2)
    const sw = Math.sin(this.phase)
    const legAmp = 0.65 * moving * (1 - L)
    const hops = this.model.userData.hops
    const legs = rig.legs
    if (legs.length === 4) {
      legs[0].rotation.x = sw * legAmp
      legs[3].rotation.x = sw * legAmp
      legs[1].rotation.x = -sw * legAmp
      legs[2].rotation.x = -sw * legAmp
      if (hops) for (const l of legs) l.rotation.x = moving > 0.2 ? -0.6 * Math.abs(sw) * (1 - L) : 0
    } else if (legs.length === 2) {
      legs[0].rotation.x = sw * legAmp * 1.1
      legs[1].rotation.x = -sw * legAmp * 1.1
    }
    if (L > 0.01) for (const l of legs) l.rotation.x = l.rotation.x * (1 - L) + 0.35 * L

    // Body: bob / hop / waddle, then tip over onto its side when asleep.
    const pose = rig.pose
    let bob = Math.abs(Math.cos(this.phase)) * 0.05 * moving
    if (hops && moving > 0.2) bob = Math.abs(sw) * 0.4 * moving
    const breathe = this.asleep ? Math.sin(this.age * 2.4) * 0.025 : 0
    const r = this.def.radius
    pose.rotation.z = (legs.length === 2 ? Math.sin(this.phase) * 0.09 * moving : 0) * (1 - L) + L * (Math.PI / 2)
    pose.position.set(L * this.rig.centerY * 0.25, bob * (1 - L) + L * r * 0.55, 0)
    pose.scale.set(1, 1 + breathe, 1 + breathe)

    // Head: look around, peck or graze while idle.
    if (rig.head) {
      const idle = (1 - moving) * (1 - L)
      const peck = this.def.speed < 3 && rig.legs.length === 2 ? Math.max(0, Math.sin(this.age * 5)) ** 6 * 0.9 : 0
      const graze = rig.legs.length === 4 ? (Math.sin(this.age * 0.7 + this.id) > 0.3 ? 0.7 : 0) : 0
      rig.head.rotation.x += ((peck + graze) * idle - rig.head.rotation.x) * Math.min(1, dt * 5)
      rig.head.rotation.y = Math.sin(this.age * 0.9 + this.id) * 0.35 * idle
    }
    for (const w of rig.wings) {
      const s = Math.sign(w.position.x) || 1
      const flap = this.fleeLeft > 0 || this.alertLeft > 0 ? Math.abs(Math.sin(this.age * 22)) * 1.1 : 0.05
      w.rotation.z = s * flap * (1 - L)
    }
    if (rig.tail) rig.tail.rotation.y = Math.sin(this.age * 3 + this.id) * 0.25 * (1 - L)

    // Attack pose (angry): rear back, lunge, head down for the charge; the tail lashes.
    const ap = this.ap
    const at = this.anger ? this.apTarget : ZERO_POSE
    const k = Math.min(1, dt * (this.anger?.phase === 'lunge' ? 22 : 9))
    ap.pitch += (at.pitch - ap.pitch) * k
    ap.push += (at.push - ap.push) * k
    ap.head += (at.head - ap.head) * k
    if (Math.abs(ap.pitch) + Math.abs(ap.push) + Math.abs(ap.head) > 1e-3) {
      pose.rotation.x = ap.pitch * (1 - L)
      pose.position.z += ap.push * (1 - L)
      pose.position.y += Math.max(0, -ap.pitch) * this.def.radius * 0.6
      if (rig.head) rig.head.rotation.x += ap.head
      if (ap.pitch < -0.1 && legs.length === 4) {
        legs[0].rotation.x = legs[1].rotation.x = -1.1 * -ap.pitch // front legs kick up while rearing
      }
      if (rig.tail && this.anger) rig.tail.rotation.y = Math.sin(this.age * 18) * 0.6
    } else pose.rotation.x = 0

    if (this.state !== 'carried') this.model.rotation.set(0, this.yaw, 0)
  }

  // --- Labels ------------------------------------------------------------------------------------
  ensureLabels() {
    if (this.labels.tag) return
    const lp = () => tmp.copy(this.pos).setY(this.pos.y + this.rig.height + 0.25)
    const top = new Vector3()
    const ringPos = new Vector3()
    const valPos = new Vector3()
    this.labels.tag = addLabel({ pos: () => top.copy(this.pos).setY(this.pos.y + this.rig.height + 0.35), size: 1.6, min: 0.3, max: 0.8, maxDist: LANE_ANIMALS.labelRange * STUD, className: 'wl-animal' })
    this.labels.ring = addLabel({ pos: () => ringPos.copy(this.pos).setY(this.pos.y + this.def.radius * 1.6 + 0.9), size: 1.6, min: 0.26, max: 0.7, maxDist: 160, className: 'wl-sleep' })
    this.labels.value = addLabel({ pos: () => valPos.copy(this.pos).setY(this.pos.y + this.def.radius * 1.6 + 2.9), size: 1.8, min: 0.2, max: 0.65, maxDist: 160, className: 'wl-value' })
    this.labels.alert = addLabel({ pos: lp, size: 1.2, min: 0.3, max: 0.9, maxDist: 160, className: 'wl-alert' })
    const name = displayName(this.species, this.mutation)
    const mut = this.mutation ? `<span class="mut" style="color:${MUTATIONS[this.mutation].color}">${MUTATIONS[this.mutation].name} ·</span>` : ''
    this.tagHtml = (hp) => `<div class="t" style="color:${this.rarity.color}">${mut}${this.rarity.name} · ${fmt(this.income)} $/s</div><div class="s">${hp}1 in ${fmt(oddsOf(this.species, this.mutation))}</div>`
    this.labels.tag.html = this.tagHtml('')
    this.labels.ring.html = `<div class="ring"><svg viewBox="0 0 130 130"><circle cx="65" cy="65" r="54" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="12"/><circle class="arc" cx="65" cy="65" r="54" fill="none" stroke="#7dff5a" stroke-width="12" stroke-linecap="round" stroke-dasharray="${RING}" stroke-dashoffset="0"/></svg><div class="num">0</div><div class="z">Z</div></div><div class="by"></div>`
    this.labels.value.html = `<div class="t">${fmt(this.income)} $/s</div><div class="s" style="color:${this.rarity.color}">${name}</div>`
    this.labels.alert.html = `<span style="color:#ffd23f">!</span><span style="color:#ff4d3a">!</span>`
    this.ringArc = this.labels.ring.el.querySelector('.arc')
    this.ringNum = this.labels.ring.el.querySelector('.num')
    this.ringBy = this.labels.ring.el.querySelector('.by')
    this.lastHpShown = -1
    this.lastNum = ''
  }

  // viewDist: how far the camera sees right now (tags reach as far, so a scoped shot at a far
  // area shows its animals' tags).
  updateLabels(showTags, viewDist = LANE_ANIMALS.labelRange * STUD, nearCross = true) {
    if (this.mode === 'pen') return
    this.ensureLabels()
    const L = this.labels
    L.tag.maxDist = Math.max(LANE_ANIMALS.labelRange * STUD, viewDist)
    L.tag.visible = showTags && nearCross && this.model.visible && !this.asleep && this.state !== 'leaving'
    if (L.tag.visible && this.hp !== this.lastHpShown) {
      this.lastHpShown = this.hp
      const dmg = this.hp < this.def.hp ? `<span style="color:#ff6b5a">${'■'.repeat(this.hp)}<span style="opacity:.35">${'■'.repeat(this.def.hp - this.hp)}</span></span> ` : ''
      L.tag.html = this.tagHtml(dmg)
    }
    // Sleeping: just the countdown ring. Carried: the value rides above it.
    L.ring.visible = this.asleep
    L.value.visible = this.state === 'carried'
    L.alert.visible = this.alertLeft > 0 && !this.asleep
    if (this.asleep) {
      const t = Math.max(0, this.sleepLeft)
      const num = t.toFixed(1)
      if (num !== this.lastNum) {
        this.lastNum = num
        this.ringNum.textContent = num
        this.ringArc.setAttribute('stroke-dashoffset', String(RING * (1 - t / this.sleepTotal)))
        const warn = t < 5
        L.ring.el.classList.toggle('warn', warn)
        this.ringArc.setAttribute('stroke', warn ? '#ff5a4a' : '#7dff5a')
      }
      // Who has it, only when that is someone else (a bot's catch you can steal).
      const carried = this.state === 'carried'
      const by = carried ? (this.carriedByPlayer ? '' : `Carried by ${this.carriedBy ?? ''}`) : this.sleptByPlayer ? '' : `Put to sleep by ${this.sleptBy}`
      if (this.ringBy.textContent !== by) this.ringBy.textContent = by
    }
  }

  dispose() {
    for (const l of Object.values(this.labels)) l.remove()
    this.labels = {}
    this.model.removeFromParent()
    this.beam?.removeFromParent()
  }
}

// --- Manager ---------------------------------------------------------------------------------------
let manager = null

export class AnimalManager {
  // obstacles: area id -> circles its animals steer round (lane.js).
  constructor(scene, obstacles) {
    manager = this
    this.scene = scene
    this.obstacles = obstacles
    this.group = new Group()
    scene.add(this.group)
    this.list = []
    this.spawnTimer = 0
    this.counts = Object.fromEntries(AREA_IDS.map((id) => [id, 0]))
    this.beamMat = new MeshBasicMaterial({ color: '#ffe36a', transparent: true, opacity: 0.25, blending: AdditiveBlending, depthWrite: false })
    this.beamGeo = new CylinderGeometry(0.6, 1.2, 60, 16, 1, true)
    this.fill()
  }

  // How many animals roam area `id` at once (more once the player has opened it).
  targetFor(id) {
    const t = COARSE_POINTER ? LANE_ANIMALS.perAreaTouch : LANE_ANIMALS.perArea
    return worldUnlocked(id) ? t.open : t.locked
  }
  // Free-roaming (non-event) animals per area, into this.counts.
  count() {
    for (const id of AREA_IDS) this.counts[id] = 0
    for (const a of this.list) if (!a.event && a.mode === 'lane') this.counts[a.area.id]++
    return this.counts
  }
  // Stock every area up to its target right away (start, or an area just opened).
  fill() {
    this.count()
    for (const id of AREA_IDS) for (let n = this.counts[id]; n < this.targetFor(id); n++) this.spawn(null, undefined, { area: id })
  }

  // Area `world`'s animals by "1 in N" weight (luck favours Rare and up); a seasonal animal
  // instead with SEASON.chance.
  pickSpecies(world = 'meadow') {
    const luck = luckMult()
    const ids = Math.random() < SEASON.chance ? seasonAnimals() : worldAnimals(world)
    let total = 0
    const w = ids.map((id) => {
      const d = ANIMALS[id]
      const x = (1 / d.odds) * (RARITIES[d.rarity].tier >= 2 ? luck : 1)
      total += x
      return x
    })
    let r = Math.random() * total
    for (let i = 0; i < ids.length; i++) {
      r -= w[i]
      if (r <= 0) return ids[i]
    }
    return ids[0]
  }
  pickMutation() {
    const luck = luckMult()
    for (const id of MUTATION_ORDER) if (Math.random() < luck / MUTATIONS[id].odds) return id
    return null
  }
  // opts.area: the area to spawn in (default: the species' own world, else the Meadow).
  spawn(species = null, mutation = undefined, opts = {}) {
    const area = opts.area ?? (species && ANIMALS[species]?.world) ?? 'meadow'
    species ??= this.pickSpecies(area)
    if (mutation === undefined) mutation = this.pickMutation()
    const a = new Animal(species, mutation, { ...opts, area })
    const A = a.area
    const S = A.spawn
    const obs = this.obstacles[A.id] ?? []
    for (let tries = 0; tries < 30; tries++) {
      let x = rnd(S.minX, S.maxX)
      let z = rnd(S.minZ, S.maxZ)
      if (a.def.zone === 'marsh') {
        const ang = rnd(0, TAU)
        const r = A.pond.r + rnd(3, 8)
        x = A.pond.x + Math.cos(ang) * r
        z = A.pond.z + Math.sin(ang) * r
      }
      if (obs.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + a.def.radius + 0.5)) continue
      a.pos.set(x, LANE.y, z)
      break
    }
    a.model.rotation.y = a.yaw
    a.pickTarget()
    this.group.add(a.model)
    this.list.push(a)
    if (opts.event) {
      const beam = new Mesh(this.beamGeo, this.beamMat)
      beam.position.y = 30
      a.model.add(beam)
      a.beam = beam
    }
    puff(tmp.copy(a.pos).setY(a.pos.y + 0.5), '#ffffff', 6)
    return a
  }

  remove(a) {
    const i = this.list.indexOf(a)
    if (i >= 0) this.list.splice(i, 1)
    a.dispose()
  }

  // Nearest animal whose hit sphere the segment a->b passes through: { animal, t, point }.
  hitTest(a, b) {
    let best = null
    const ab = tmp.copy(b).sub(a)
    const len2 = ab.lengthSq()
    const c = new Vector3()
    for (const an of this.list) {
      if (an.state === 'carried' || an.state === 'leaving') continue
      an.center(c)
      const r = an.def.radius * (an.lieAmount > 0.5 ? 1.15 : 1)
      const t = Math.max(0, Math.min(1, c.clone().sub(a).dot(ab) / len2))
      const px = a.x + ab.x * t
      const py = a.y + ab.y * t
      const pz = a.z + ab.z * t
      const d2 = (px - c.x) ** 2 + (py - c.y) ** 2 + (pz - c.z) ** 2
      if (d2 <= r * r && (!best || t < best.t)) best = { animal: an, t, point: new Vector3(px, py, pz) }
    }
    return best
  }

  // Animals within r m of p are startled by a dart landing nearby.
  startleNear(p, r, from) {
    for (const a of this.list) if (a.pos.distanceTo(p) < r) a.startle(from)
  }

  nearestSleeping(p, range) {
    let best = null
    let bd = range
    for (const a of this.list) {
      if (a.state !== 'asleep') continue
      const d = Math.hypot(a.pos.x - p.x, a.pos.z - p.z, (a.pos.y - p.y) * 0.5)
      if (d < bd) {
        bd = d
        best = a
      }
    }
    return best
  }

  // ctx: { camZ, viewDist } decide what is drawn: an animal further down the lane than the view
  // distance is hidden (and skips its animation) until the camera comes near or scopes in.
  // ctx.camera (while scoped): tags only on the animals near the crosshair, so a far scope view
  // full of animals stays readable.
  update(dt, ctx) {
    const camZ = ctx.camZ ?? 0
    const view = ctx.viewDist ?? Infinity
    const cam = ctx.showTags ? ctx.camera : null
    let cosTag = -2
    if (cam) {
      cam.getWorldDirection(fwd)
      cosTag = Math.cos(((cam.fov * Math.PI) / 180) * LANE_ANIMALS.tagCone)
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const a = this.list[i]
      a.model.visible = a.state === 'carried' || Math.abs(a.pos.z - camZ) < view
      a.update(dt, ctx)
      let nearCross = true
      if (cam) {
        tmp.copy(a.pos).setY(a.pos.y + a.rig.centerY).sub(cam.position)
        nearCross = tmp.dot(fwd) > tmp.length() * cosTag
      }
      a.updateLabels(ctx.showTags, view, nearCross)
      if (a.beam) a.beam.material.opacity = 0.18 + Math.sin(a.age * 3) * 0.08
      if (a.gone) this.remove(a)
    }
    // One refill at a time, into the area furthest below its target.
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      this.spawnTimer = LANE_ANIMALS.respawn
      this.count()
      let best = null
      let gap = 0
      for (const id of AREA_IDS) {
        const g = this.targetFor(id) - this.counts[id]
        if (g > gap) {
          gap = g
          best = id
        }
      }
      if (best) this.spawn(null, undefined, { area: best })
    }
  }
}

// Celebration when an animal lands in the pen.
export function landedFx(p, mutation) {
  sparkle(p, mutation ? MUTATIONS[mutation].color : '#ffffff', 18, 5, 0.6)
}
