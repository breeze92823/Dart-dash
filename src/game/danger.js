// Angry animals. Step into the lane (past the band) with none of your own darted animals asleep or
// carried and the awake animals nearby turn on you: each one notices (rears up, snorts, "!!"),
// charges (head down, dust, red steam), winds up and lunges. A hit costs HP (by rarity), knocks
// you back, shakes the camera and flashes the screen red. A dart that doesn't put it to sleep
// staggers it. Get back up the slope, or dart one to sleep, and they calm down. At 0 HP you are
// knocked out (you fall over, stars), drop what you carry, and wake up at the hub.
// The animals' movement + poses run in Animal (animals.js: `anger`, `apTarget`); this file is
// the brain, the player's HP, the HUD (heart bar, vignette, damage numbers) and the effects.
import { Vector3 } from 'three'
import { DANGER, LANE } from '../config.js'
import { player, respawn } from '../player.js'
import { dust, emit, hitBurst, puff, sparkle } from '../fx/particles.js'
import * as snd from '../audio/danger.js'
import './danger.css'

const rnd = (a, b) => a + Math.random() * (b - a)
const v = new Vector3()

export function createDanger({ animals, base, hud, playerGroup }) {
  // --- HUD ------------------------------------------------------------------------------------
  const root = document.createElement('div')
  root.className = 'dg'
  root.innerHTML = `<div class="dg-vig"></div><div class="dg-ko"><b>KNOCKED OUT!</b><span>The animals got you</span></div>
    <div class="dg-hp"><i class="dg-heart">❤</i><div class="dg-bar"><i class="dg-lag"></i><i class="dg-fill"></i><b class="dg-num">100</b></div></div><div class="dg-pops"></div>`
  document.body.appendChild(root)
  const el = {
    vig: root.querySelector('.dg-vig'),
    ko: root.querySelector('.dg-ko'),
    hpBox: root.querySelector('.dg-hp'),
    fill: root.querySelector('.dg-fill'),
    lag: root.querySelector('.dg-lag'),
    num: root.querySelector('.dg-num'),
    pops: root.querySelector('.dg-pops'),
  }
  function damagePop(n) {
    const d = document.createElement('div')
    d.className = 'dg-pop'
    d.textContent = `-${n}`
    d.style.left = `${50 + rnd(-8, 8)}%`
    el.pops.appendChild(d)
    setTimeout(() => d.remove(), 1100)
  }

  // --- State ---------------------------------------------------------------------------------
  let hp = DANGER.hp
  let lagHp = hp
  let sinceHit = 99
  let ko = 0 // s left knocked out
  let safe = 0 // s untouchable after waking up
  let flash = 0 // red screen flash 0..1
  let beat = 0
  let warned = false
  let tilt = 0 // 0 standing .. 1 flat on your back
  let outOfReach = 0
  const shake = { amp: 0, t: 0, offset: new Vector3() }
  playerGroup.rotation.order = 'YXZ'

  const tierOf = (a) => a.rarity.tier
  const feet = () => v.set(player.position.x, player.position.y, player.position.z)
  const distTo = (a) => Math.hypot(a.pos.x - player.position.x, a.pos.z - player.position.z)
  const gainAt = (p) => 1 / (1 + Math.hypot(p.x - player.position.x, p.z - player.position.z) / 14)
  const head = (a, out = new Vector3()) => out.set(a.pos.x + Math.sin(a.yaw) * a.def.radius * 0.8, a.pos.y + a.rig.height * 0.9, a.pos.z + Math.cos(a.yaw) * a.def.radius * 0.8)
  const faceYaw = (a) => Math.atan2(player.position.x - a.pos.x, player.position.z - a.pos.z)
  function turnToPlayer(a, dt, rate = 8) {
    const want = faceYaw(a)
    const diff = Math.atan2(Math.sin(want - a.yaw), Math.cos(want - a.yaw))
    a.yaw += diff * Math.min(1, dt * rate)
  }
  function pose(a, pitch, push, head) {
    a.apTarget.pitch = pitch
    a.apTarget.push = push
    a.apTarget.head = head
  }
  // Red steam from the head: it's furious.
  function steam(a) {
    const h = head(a)
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1
      emit({ x: h.x, y: h.y + 0.2, z: h.z, vx: s * rnd(0.4, 0.9) + rnd(-0.2, 0.2), vy: rnd(1.6, 2.4), vz: rnd(-0.3, 0.3), life: rnd(0.5, 0.8), size: 0.25, size2: 0.75, drag: 2, gravity: -0.5, alpha: 0.8 }, i ? '#ff6a4a' : '#ffffff')
    }
  }

  function anger(a) {
    a.anger = { phase: 'notice', t: 0, fx: 0, step: 0, hit: false, dir: new Vector3(), growl: rnd(0.8, 1.6) }
    a.fleeLeft = 0
    a.wait = 0
    a.alertLeft = DANGER.noticeTime + 0.4
    snd.growl(gainAt(a.pos), 0.8 + a.def.radius * 0.3)
    if (!warned) {
      warned = true
      hud.toast('The animals are angry! Dart one to sleep first, or run back up the slope!', { error: true, seconds: 4 })
    }
  }
  function calm(a) {
    if (!a.anger) return
    a.anger = null
    a.alertLeft = 0
    a.wait = rnd(0.6, 1.5)
    a.pickTarget()
    puff(v.copy(a.pos).setY(a.pos.y + a.rig.height * 0.8), '#ffffff', 4, 0.6, 0.4)
  }

  function hitPlayer(a) {
    const tier = tierOf(a)
    const dmg = DANGER.damage[tier] ?? DANGER.damage[0]
    hp = Math.max(0, hp - dmg)
    sinceHit = 0
    flash = 1
    shake.amp = 0.35 + tier * 0.06
    // Knockback away from the animal, with a hop.
    const dx = player.position.x - a.pos.x
    const dz = player.position.z - a.pos.z
    const l = Math.hypot(dx, dz) || 1
    const k = DANGER.knock * (1 + tier * 0.12)
    player.velocity.x = (dx / l) * k
    player.velocity.z = (dz / l) * k
    player.velocity.y = 5.5
    // Effects at your chest.
    const c = new Vector3(player.position.x, player.position.y + 1.2, player.position.z)
    hitBurst(c, '#ffffff')
    sparkle(c, '#ff4a3a', 14, 6, 0.6)
    sparkle(c, '#ffe36a', 8, 4, 0.5)
    dust(feet(), 8)
    snd.impact()
    snd.hurt()
    damagePop(dmg)
    el.hpBox.classList.remove('hit')
    void el.hpBox.offsetWidth
    el.hpBox.classList.add('hit')
    if (hp <= 0) knockOut()
  }

  function knockOut() {
    ko = DANGER.koTime
    player.locked = true
    player.velocity.x *= 0.4
    player.velocity.z *= 0.4
    const carried = base.carrying
    if (carried) carried.wake() // you drop it and it runs off
    for (const a of animals.list) if (a.anger) calm(a)
    snd.knockout()
    el.ko.classList.add('on')
  }
  function wakeUp() {
    player.locked = false
    tilt = 0
    playerGroup.rotation.x = 0
    respawn()
    hp = lagHp = DANGER.hp
    safe = DANGER.safeTime
    el.ko.classList.remove('on')
    puff(feet().setY(player.position.y + 1), '#ffffff', 14, 1.2, 0.7)
    sparkle(feet().setY(player.position.y + 1.2), '#7dff6a', 16, 4, 0.5)
    snd.revive()
    hud.toast('Put an animal to sleep with a dart before you go down into the lane!', { seconds: 4 })
  }

  // --- One angry animal's step (called from Animal.update while `anger` is set) ---------------
  animals.angerStep = (a, dt) => {
    const g = a.anger
    g.t += dt
    g.fx -= dt
    const d = distTo(a)
    const reach = a.def.radius + DANGER.reach
    switch (g.phase) {
      case 'notice': {
        turnToPlayer(a, dt, 10)
        a.speedNow *= 1 - Math.min(1, dt * 8)
        const k = g.t / DANGER.noticeTime
        pose(a, k < 0.6 ? -0.55 : 0.1, 0, k < 0.6 ? -0.3 : 0.35)
        if (g.fx <= 0) {
          g.fx = 0.18
          steam(a)
        }
        if (k > 0.35 && !g.snorted) {
          g.snorted = true
          snd.snort(gainAt(a.pos))
          puff(head(a), '#e9e2c8', 5, 0.6, 0.35)
        }
        if (g.t >= DANGER.noticeTime) Object.assign(g, { phase: 'chase', t: 0 })
        break
      }
      case 'chase': {
        const [lo, hi] = DANGER.chaseSpeed
        const speed = Math.min(hi, Math.max(lo, a.def.speed * DANGER.chaseMult)) + tierOf(a) * 0.25
        a.moveToward(dt, feet(), speed)
        pose(a, 0.14, 0, 0.5)
        a.phase += dt * 4 // faster gallop
        g.step -= dt
        if (g.step <= 0) {
          g.step = 0.16
          dust(v.copy(a.pos), 3)
          if (Math.random() < 0.5) snd.stomp(gainAt(a.pos) * 0.7)
        }
        if (g.fx <= 0) {
          g.fx = 0.32
          steam(a)
        }
        g.growl -= dt
        if (g.growl <= 0) {
          g.growl = rnd(1.4, 2.6)
          snd.growl(gainAt(a.pos) * 0.8, 0.8 + a.def.radius * 0.3)
        }
        a.alertLeft = 0.3
        if (d < reach) Object.assign(g, { phase: 'windup', t: 0 })
        break
      }
      case 'windup': {
        turnToPlayer(a, dt, 12)
        a.speedNow *= 1 - Math.min(1, dt * 10)
        pose(a, -0.6, -0.25, -0.35)
        if (g.fx <= 0) {
          g.fx = 0.1
          dust(v.copy(a.pos), 2)
        }
        if (g.t >= DANGER.windup) {
          g.dir.set(player.position.x - a.pos.x, 0, player.position.z - a.pos.z).normalize()
          Object.assign(g, { phase: 'lunge', t: 0, hit: false })
          snd.snort(gainAt(a.pos))
        }
        break
      }
      case 'lunge': {
        const speed = DANGER.lungeDist / DANGER.lunge
        v.copy(a.pos).addScaledVector(g.dir, 3)
        a.speedNow = speed
        a.moveToward(dt, v, speed)
        pose(a, 0.4, 0.45, 0.7)
        if (!g.hit && g.t >= DANGER.lunge * 0.45) {
          g.hit = true
          const close = d < a.def.radius + 1.5 && Math.abs(player.position.y - a.pos.y) < 2.2
          if (close && ko <= 0 && safe <= 0) hitPlayer(a)
          else puff(head(a), '#e9e2c8', 6, 0.8, 0.4) // missed: bites the dust
        }
        if (g.t >= DANGER.lunge) Object.assign(g, { phase: 'recover', t: 0 })
        break
      }
      case 'recover': {
        a.speedNow *= 1 - Math.min(1, dt * 5)
        turnToPlayer(a, dt, 4)
        pose(a, 0, 0, 0.2)
        if (g.t >= DANGER.recover) Object.assign(g, { phase: 'chase', t: 0 })
        break
      }
      case 'stagger': {
        a.speedNow *= 1 - Math.min(1, dt * 8)
        pose(a, -0.25, -0.15, -0.4)
        a.yaw += Math.sin(g.t * 30) * dt * 3
        if (g.fx <= 0) {
          g.fx = 0.15
          sparkle(head(a).setY(a.pos.y + a.rig.height + 0.3), '#ffe36a', 3, 1.5, 0.4) // dizzy stars
        }
        if (g.t >= DANGER.stagger) Object.assign(g, { phase: 'chase', t: 0 })
        break
      }
    }
  }
  // A dart that didn't put it to sleep: it staggers, then comes on again.
  animals.onAngryHit = (a) => {
    Object.assign(a.anger, { phase: 'stagger', t: 0, fx: 0 })
    snd.growl(gainAt(a.pos), 0.7)
  }

  // --- Per frame -----------------------------------------------------------------------------
  return {
    get hp() {
      return hp
    },
    get knockedOut() {
      return ko > 0
    },
    shakeOffset: shake.offset,
    update(dt) {
      sinceHit += dt
      safe = Math.max(0, safe - dt)
      // Knocked out: fall over, stars spin, then wake at the hub.
      if (ko > 0) {
        ko -= dt
        tilt += (1 - tilt) * Math.min(1, dt * 7)
        if (Math.random() < dt * 8) sparkle(new Vector3(player.position.x + rnd(-0.6, 0.6), player.position.y + 0.6, player.position.z + rnd(-0.6, 0.6)), '#ffe36a', 1, 1.2, 0.45)
        if (ko <= 0) wakeUp()
      } else tilt = 0
      playerGroup.rotation.x = -tilt * 1.45

      const inLane = player.position.z < DANGER.laneZ && ko <= 0
      const licensed = !!base.carrying || animals.list.some((a) => a.asleep && (a.sleptByPlayer || a.carriedByPlayer))
      const hunting = inLane && !licensed && safe <= 0
      // Out of their reach (up on the slope): they pace at the edge, then give up.
      outOfReach = player.position.z > LANE.spawn.maxZ + 3 ? outOfReach + dt : 0

      let angry = 0
      for (const a of animals.list) {
        if (!a.anger) continue
        if (!hunting || a.state !== 'wander' || distTo(a) > DANGER.giveUp || outOfReach > 2.5) calm(a)
        else angry++
      }
      if (hunting && angry < DANGER.maxAttackers && outOfReach === 0) {
        const near = animals.list
          .filter((a) => !a.anger && a.mode === 'lane' && a.state === 'wander' && distTo(a) < DANGER.notice + tierOf(a) * DANGER.noticeTier)
          .sort((p, q) => distTo(p) - distTo(q))
        for (const a of near.slice(0, DANGER.maxAttackers - angry)) anger(a)
      }

      // HP: regen after a quiet spell; the lag bar trails the real one.
      if (ko <= 0 && sinceHit > DANGER.regenDelay && hp < DANGER.hp) hp = Math.min(DANGER.hp, hp + DANGER.regen * dt)
      lagHp += (hp - lagHp) * Math.min(1, dt * (lagHp > hp ? 2.2 : 20))
      const show = inLane || hp < DANGER.hp || ko > 0 || angry > 0
      root.classList.toggle('show', show)
      el.fill.style.width = `${(hp / DANGER.hp) * 100}%`
      el.lag.style.width = `${(lagHp / DANGER.hp) * 100}%`
      el.num.textContent = String(Math.ceil(hp))
      const low = hp / DANGER.hp < 0.3 && ko <= 0
      root.classList.toggle('low', low)
      root.classList.toggle('safe', safe > 0)
      if (low) {
        beat -= dt
        if (beat <= 0) {
          beat = 0.9
          snd.heartbeat()
        }
      }
      flash = Math.max(0, flash - dt * 2.2)
      el.vig.style.opacity = String(Math.min(1, flash + (low ? 0.35 + Math.sin(performance.now() / 160) * 0.12 : 0) + (ko > 0 ? 0.6 : 0)))

      // Camera shake (main.js adds shakeOffset after the camera update).
      shake.amp = Math.max(0, shake.amp - dt * 1.4)
      shake.t += dt * 40
      shake.offset.set(Math.sin(shake.t * 1.3) * shake.amp, Math.sin(shake.t * 1.7 + 1) * shake.amp * 0.7, Math.cos(shake.t * 1.1) * shake.amp)
    },
  }
}
