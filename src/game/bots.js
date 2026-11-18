// NPC hunters so the hub feels alive. Each bot walks to the band, darts an
// animal, runs down to fetch it and carries it back to the portal (its own
// zoo). Their sleeping catches can be stolen. They also fill the leaderboards
// alongside the player.
import { Group, Vector3 } from 'three'
import { BAND, BOT_NAMES, BOTS, LANE, POSES, STUD, WEAPONS } from '../config.js'
import { groundY } from '../physics.js'
import { addLabel } from '../fx/labels.js'
import { buildDefaultCharacter } from '../avatar/character.js'
import { makeAnimator } from '../avatar/animator.js'
import { buildWeapon } from './weapons.js'
import { fmt, state } from './state.js'

const rnd = (a, b) => a + Math.random() * (b - a)
const OUTFITS = [
  { suit: '#2f86ff', legs: '#26324a', hair: '#f2d06a' },
  { suit: '#e8392a', legs: '#2a2a30', hair: '#3a2416' },
  { suit: '#3fc24a', legs: '#4a3a2a', hair: '#1a1a1a' },
  { suit: '#a35be8', legs: '#2a2a40', hair: '#ff8a3a' },
  { suit: '#f2b33a', legs: '#3a2a1a', hair: '#7a4a22' },
]
const PORTAL = new Vector3(-22, 0, 37)

export function createBots({ scene, animals, darts, events, live }) {
  const names = [...BOT_NAMES].sort(() => Math.random() - 0.5)
  const bots = []
  for (let i = 0; i < BOTS.count; i++) {
    const group = new Group()
    const body = buildDefaultCharacter(OUTFITS[i % OUTFITS.length])
    group.add(body)
    const gun = buildWeapon(i % 2 ? 'pistol' : 'blowpipe')
    gun.position.set(-0.32, 1.25, 0.35)
    gun.visible = false
    group.add(gun)
    scene.add(group)
    const bot = {
      name: names[i],
      group,
      gun,
      animator: makeAnimator(body),
      pos: group.position,
      yaw: 0,
      speed: 0,
      vy: 0,
      state: 'idle',
      timer: rnd(1, 6),
      path: [],
      aimTarget: null,
      slept: null,
      carried: null,
      cooldown: 0,
      money: Math.round(rnd(800, 60000)),
      captures: Math.floor(rnd(3, 60)),
      steps: Math.floor(rnd(100, 4000)),
      income: Math.round(rnd(20, 400)),
      groundT: 0,
      gy: 0,
    }
    bot.pos.set(rnd(-30, 20), 0, rnd(-20, 30))
    bot.tag = addLabel({ pos: () => new Vector3(bot.pos.x, bot.pos.y + 2.25, bot.pos.z), size: 0.55, min: 0.2, max: 0.6, maxDist: 60, className: 'wl-name', html: bot.name })
    bots.push(bot)
  }

  const go = (bot, pts, state) => {
    bot.path = pts.map((p) => p.clone())
    bot.state = state
  }

  function think(bot) {
    switch (bot.state) {
      case 'idle':
        if (Math.random() < 0.7) {
          const x = rnd(-40, 40)
          go(bot, [new Vector3(x, 0, BAND.z1 + 1.5), new Vector3(x, 0, (BAND.z0 + BAND.z1) / 2)], 'toBand')
        } else go(bot, [new Vector3(rnd(-40, 20), 0, rnd(-28, 36))], 'wander')
        break
      case 'wander':
        bot.state = 'idle'
        bot.timer = rnd(2, 6)
        break
      case 'toBand':
        bot.state = 'aim'
        bot.timer = rnd(8, 14)
        bot.aimTarget = null
        bot.gun.visible = true
        bot.animator?.setOverlay(POSES.aim)
        break
      case 'fetch': {
        const a = bot.slept
        if (!a || a.state !== 'asleep') return giveUp(bot)
        a.state = 'carried'
        a.carriedBy = bot.name
        a.carriedByPlayer = false
        a.clearDarts()
        bot.carried = a
        bot.slept = null
        bot.animator?.setOverlay(POSES.carry)
        const x = Math.max(-40, Math.min(40, bot.pos.x))
        go(bot, [new Vector3(x, 0, LANE.maxZ - 4), new Vector3(x, 0, BAND.z0 + 1), new Vector3(x * 0.5, 0, 0), PORTAL], 'carry')
        break
      }
      case 'carry': {
        const a = bot.carried
        bot.carried = null
        bot.animator?.setOverlay(null)
        if (a && a.state === 'carried') {
          events.captured(a, bot.name)
          animals.remove(a)
          bot.captures++
          bot.income += a.income
        }
        bot.state = 'idle'
        bot.timer = rnd(2, 5)
        break
      }
      case 'return':
        bot.state = 'idle'
        bot.timer = rnd(1, 4)
        break
    }
  }

  function giveUp(bot) {
    bot.slept = null
    bot.animator?.setOverlay(null)
    bot.gun.visible = false
    const x = Math.max(-40, Math.min(40, bot.pos.x))
    if (bot.pos.y < -1) go(bot, [new Vector3(x, 0, LANE.maxZ - 4), new Vector3(x, 0, BAND.z0 + 1), new Vector3(x, 0, -20)], 'return')
    else go(bot, [new Vector3(x, 0, -20)], 'return')
  }

  function aimUpdate(bot, dt) {
    bot.yaw = Math.PI
    bot.timer -= dt
    bot.cooldown -= dt
    const range = WEAPONS.blowpipe.range * STUD * 0.8
    if (!bot.aimTarget || bot.aimTarget.asleep || !animals.list.includes(bot.aimTarget)) {
      const cands = animals.list.filter((a) => !a.asleep && a.state !== 'leaving' && a.pos.distanceTo(bot.pos) < range)
      bot.aimTarget = cands[Math.floor(Math.random() * cands.length)] ?? null
    }
    const t = bot.aimTarget
    if (t) {
      bot.yaw = Math.atan2(t.pos.x - bot.pos.x, t.pos.z - bot.pos.z)
      if (bot.cooldown <= 0) {
        bot.cooldown = rnd(0.9, 1.6)
        const from = new Vector3(bot.pos.x + Math.sin(bot.yaw) * 0.6, bot.pos.y + 1.4, bot.pos.z + Math.cos(bot.yaw) * 0.6)
        const aim = t.center(new Vector3()).add(new Vector3(rnd(-1, 1), rnd(-0.5, 0.8), rnd(-1, 1)).multiplyScalar(Math.random() < 0.45 ? 1.6 : 0.2))
        const w = WEAPONS.blowpipe
        const dir = aim.sub(from)
        const dist = dir.length()
        const vel = dir.normalize().multiplyScalar(w.speed)
        vel.y += 0.5 * w.drop * (dist / w.speed)
        darts.fire(from, vel, 'blowpipe', 'basic', { name: bot.name, isPlayer: false, bot })
      }
    }
    if (bot.timer <= 0) giveUp(bot)
  }

  return {
    bots,
    // Called from the darts' hit hook.
    onHit(animal, slept, owner) {
      const bot = owner.bot
      if (!bot || !slept || bot.state !== 'aim') return
      bot.slept = animal
      bot.gun.visible = false
      bot.animator?.setOverlay(null)
      const x = Math.max(-40, Math.min(40, bot.pos.x))
      go(bot, [new Vector3(x, 0, BAND.z0 - 1), new Vector3(x, 0, LANE.maxZ - 4), animal.pos], 'fetch')
    },
    update(dt, ctx) {
      for (const bot of bots) {
        if (bot.state === 'aim') aimUpdate(bot, dt)
        else if (bot.path.length) {
          // A sleeping catch someone else grabbed: give up.
          if (bot.state === 'fetch' && (!bot.slept || bot.slept.state !== 'asleep')) {
            giveUp(bot)
            continue
          }
          const p = bot.path[0]
          if (bot.state === 'fetch' && bot.path.length === 1) p.copy(bot.slept.pos)
          const dx = p.x - bot.pos.x
          const dz = p.z - bot.pos.z
          const d = Math.hypot(dx, dz)
          const speed = bot.state === 'carry' ? 7.5 : bot.state === 'wander' ? 4.5 : 9
          if (d < 0.8) {
            bot.path.shift()
            if (!bot.path.length) think(bot)
          } else {
            const want = Math.atan2(dx, dz)
            const diff = Math.atan2(Math.sin(want - bot.yaw), Math.cos(want - bot.yaw))
            bot.yaw += diff * Math.min(1, dt * 8)
            bot.speed += (speed - bot.speed) * Math.min(1, dt * 6)
            const step = Math.min(d, bot.speed * dt)
            bot.pos.x += (dx / d) * step
            bot.pos.z += (dz / d) * step
          }
        } else {
          bot.speed += (0 - bot.speed) * Math.min(1, dt * 6)
          bot.timer -= dt
          if (bot.timer <= 0) think(bot)
        }
        // Ground.
        bot.groundT -= dt
        if (bot.groundT <= 0) {
          bot.groundT = 0.1
          bot.gy = groundY(bot.pos.x, bot.pos.z, bot.pos.y + 2, 30) ?? bot.gy
        }
        bot.pos.y += (bot.gy - bot.pos.y) * Math.min(1, dt * 14)
        bot.group.rotation.y = bot.yaw
        bot.animator?.update(dt, { grounded: true, speed: bot.state === 'aim' ? 0 : bot.speed, verticalVelocity: 0, turn: 0 })
        if (bot.carried) {
          const a = bot.carried
          if (a.state !== 'carried') {
            bot.carried = null
            bot.animator?.setOverlay(null)
            a.pos.set(bot.pos.x + 1, bot.pos.y, bot.pos.z)
            giveUp(bot)
          } else {
            a.pos.set(bot.pos.x, bot.pos.y + 2.05 + a.def.radius * 0.15, bot.pos.z)
            a.model.rotation.set(0, bot.yaw + Math.PI / 2, 0)
          }
        }
        bot.money += bot.income * dt
      }
    },
    // Leaderboard rows (player + bots + the server's saved players), refreshed every few seconds
    // by main.js. server: the backend's `leaderboard` message ({ boards: { money|steps|captures:
    // [{ name, value }] } }) or null.
    redrawBoards(playerName, server = null) {
      const me = { name: playerName, me: true, money: state.money, steps: state.steps, captures: state.captures }
      const all = [me, ...bots.map((b) => ({ name: b.name, money: b.money, steps: b.steps, captures: b.captures }))]
      const rows = (key, fmtv) => {
        const extra = (server?.boards?.[key] ?? []).filter((r) => r.name !== playerName).map((r) => ({ name: r.name, [key]: r.value }))
        return [...all, ...extra].sort((a, b) => b[key] - a[key]).slice(0, 10).map((r) => ({ name: r.name, me: r.me, value: fmtv(r[key]) }))
      }
      live.boards[0].redraw(rows('money', (v) => `$${fmt(v)}`))
      live.boards[1].redraw(rows('steps', (v) => `${fmt(v)} st`))
      live.boards[2].redraw(rows('captures', (v) => fmt(v)))
    },
  }
}
