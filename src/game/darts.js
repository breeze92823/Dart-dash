// Dart projectiles: they fly with a little drop, leave a trail, and each frame
// test the swept segment against the animals' hit spheres and the static world.
// A hit animal takes damage (asleep at 0 hp) and keeps the dart stuck in it;
// misses stick in the ground or a tree for a few seconds and startle animals
// nearby. Past the weapon's range a dart tumbles and falls.
import { Group, Quaternion, Vector3 } from 'three'
import { DARTS, SKINS, STUD, WEAPONS } from '../config.js'
import { raySegment } from '../physics.js'
import { dartTail, groundHit, hitBurst } from '../fx/particles.js'
import { popLabel } from '../fx/labels.js'
import { buildDart } from './weapons.js'
import { state } from './state.js'
import { sfx } from '../audio/index.js'

const FEATHERED = new Set(['chicken', 'turkey', 'heron'])
const FUR = { chicken: '#ffffff', turkey: '#6b3d1f', heron: '#c8cfd8', rabbit: '#8a94b0', goat: '#f0efea', sheep: '#ffffff', pig: '#f6a6b6', cow: '#f6f6f2', deer: '#b9733a', fox: '#f0761e', boar: '#5a3a26' }

export class Darts {
  constructor(scene, animals) {
    this.scene = scene
    this.animals = animals
    this.group = new Group()
    scene.add(this.group)
    this.flying = []
    this.stuck = []
    this.onHit = null // (animal, slept, owner, dart) => void
    this.now = 0
  }

  // owner: { name, isPlayer }
  fire(origin, dir, weaponId, dartType, owner) {
    const w = WEAPONS[weaponId]
    const mesh = buildDart(dartType, owner.isPlayer ? state.cosmetics.skin : null)
    mesh.position.copy(origin)
    this.group.add(mesh)
    const d = {
      mesh,
      pos: mesh.position,
      vel: dir.clone().normalize().multiplyScalar(w.speed),
      origin: origin.clone(),
      range: w.range * STUD,
      drop: w.drop,
      damage: w.damage + (DARTS[dartType]?.bonus ?? 0),
      sleep: DARTS[dartType]?.sleep ?? 0, // s asleep (0 = the species' own)
      mutation: DARTS[dartType]?.mutation ?? null, // a mutation dart turns what it puts to sleep
      // The tail glows in the dart's own colour (the equipped skin's for the player).
      color: (owner.isPlayer && SKINS[state.cosmetics.skin]?.dart) || (DARTS[dartType]?.color ?? '#ffffff'),
      owner,
      age: 0,
      trail: 0,
      falling: false,
    }
    mesh.lookAt(tmpA.copy(d.pos).add(d.vel))
    this.flying.push(d)
    return d
  }

  update(dt) {
    this.now += dt
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const d = this.flying[i]
      d.age += dt
      const from = tmpA.copy(d.pos)
      const traveled = d.pos.distanceTo(d.origin)
      if (traveled > d.range && !d.falling) {
        d.falling = true
        d.vel.multiplyScalar(0.45)
      }
      d.vel.y -= (d.falling ? 22 : d.drop) * dt
      const to = tmpB.copy(d.pos).addScaledVector(d.vel, dt)

      // Animals first (they stand in front of the ground), then the world.
      const hit = this.animals.hitTest(from, to)
      const wall = raySegment(from.x, from.y, from.z, to.x, to.y, to.z)
      if (hit && (!wall || hit.t <= wall.t)) {
        this.hitAnimal(d, hit)
        this.flying.splice(i, 1)
        continue
      }
      if (wall) {
        d.pos.set(wall.x, wall.y, wall.z)
        this.stickWorld(d)
        this.flying.splice(i, 1)
        continue
      }
      d.pos.copy(to)
      d.mesh.lookAt(tmpC.copy(d.pos).add(d.vel))
      if (d.falling) d.mesh.rotateX(d.age * 6)
      if (!d.falling) this.tail(d, from)
      if (d.age > 6 || d.pos.y < -60) {
        d.mesh.removeFromParent()
        this.flying.splice(i, 1)
      }
    }
    for (let i = this.stuck.length - 1; i >= 0; i--) {
      const s = this.stuck[i]
      s.life -= dt
      if (s.life < 0.4) s.mesh.scale.setScalar(Math.max(0.01, s.life / 0.4))
      if (s.life <= 0) {
        s.mesh.removeFromParent()
        this.stuck.splice(i, 1)
      }
    }
  }

  // Particle tail behind the dart: puffs every TAIL_STEP m along the segment it just
  // flew (bots' darts more sparsely), from the tail end of the model, not the nose.
  tail(d, from) {
    const step = d.owner.isPlayer ? TAIL_STEP : TAIL_STEP * 2.5
    d.trail += from.distanceTo(d.pos)
    if (d.trail < step) return
    let n = Math.floor(d.trail / step)
    d.trail -= n * step
    n = Math.min(n, 10)
    tmpD.copy(d.vel).normalize()
    const k = Math.min(1, Math.max(0.12, (d.pos.distanceTo(d.origin) - 0.8) / 6))
    for (let j = 1; j <= n; j++) {
      tmpC.lerpVectors(from, d.pos, j / n).addScaledVector(tmpD, -0.22)
      dartTail(tmpC, tmpD, d.color, k, d.owner.isPlayer)
    }
  }

  hitAnimal(d, hit) {
    const a = hit.animal
    const slept = a.hit(d.damage, d.sleep, d.owner.name, d.origin, this.now, d.owner.isPlayer)
    if (slept && d.mutation && a.setMutation(d.mutation) && d.owner.isPlayer) this.onMutate?.(a, d.mutation)
    // Stick the dart in, nose first, a little way into the body.
    d.pos.copy(hit.point).addScaledVector(tmpC.copy(d.vel).normalize(), 0.12)
    d.mesh.lookAt(tmpC.copy(d.pos).add(d.vel))
    if (a.stuck.length < 6) a.stickDart(d.mesh)
    else d.mesh.removeFromParent()
    hitBurst(hit.point, FUR[a.species] ?? '#ffffff', FEATHERED.has(a.species))
    if (d.owner.isPlayer) {
      sfx.dartHit(slept, a.species)
      hitWords(hit.point, a, slept)
      if (slept) sfx.animalCall(a.species, a.pos)
    } else sfx.dartHitFar(hit.point)
    this.onHit?.(a, slept, d.owner, d)
  }

  stickWorld(d) {
    groundHit(d.pos)
    if (d.owner.isPlayer) sfx.dartThunk(d.pos)
    this.animals.startleNear(d.pos, 5, d.origin)
    this.stuck.push({ mesh: d.mesh, life: 4 })
    if (this.stuck.length > 30) {
      const old = this.stuck.shift()
      old.mesh.removeFromParent()
    }
  }
}

// Comic hit words over the animal (the player's own darts only): every hit says "POK!";
// the hit that puts it to sleep stacks its call ("MOOH") and a dizzy "@!@" on top.
function hitWords(p, a, slept) {
  const html = slept
    ? `<div class="hw-call">${a.def.call ?? ''}</div><div class="hw-dizzy">@!@</div><div class="hw-pok">POK!</div>`
    : `<div class="hw-pok">POK!</div>`
  popLabel(p.clone(), html, 'wl-hit', { rise: 0.3, life: 1.15, size: 2.2, min: 0.5, max: 1 })
}

const TAIL_STEP = 0.4 // m of flight between tail puffs
const tmpA = new Vector3()
const tmpB = new Vector3()
const tmpC = new Vector3()
const tmpD = new Vector3()
export const _q = new Quaternion()
