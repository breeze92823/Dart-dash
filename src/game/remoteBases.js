// The five other bases. Every slot's pen, treadmill and signs are built in the hub (world/hub.js);
// this fills the ones whose owner is in the room from the server's roster: the animals in the pen
// (wandering inside their fence), the treadmill running when its owner is on it, the console screen
// and signs (pen level, treadmill level, steps) and the marker over the pen (the owner's name, or
// FREE BASE when nobody has it). The local player's own base is game/base.js.
import { ANIMALS, BASES, TREADMILL } from '../config.js'
import { Animal } from './animals.js'
import { fmt } from './state.js'
import { animateMill, consoleView } from './treadmillFx.js'
import { baseMarkerHtml } from '../world/hub.js'
import { net } from '../net.js'

const clean = (s) => String(s ?? '').replace(/[<>&"]/g, '').slice(0, 16)

export function createRemoteBases({ scene, live, getMySlot, remotePlayers }) {
  // slot -> { key, animals: [{ key, animal }], owner }
  const slots = BASES.map(() => ({ sig: '', text: '', animals: [], owner: null }))

  function syncAnimals(slot, listText) {
    const s = slots[slot]
    if (s.text === listText) return
    s.text = listText
    const want = listText ? listText.split(',') : []
    // Keep animals that are still wanted (multiset match), drop the rest, add the new ones.
    const pool = [...s.animals]
    const keep = []
    const need = []
    for (const key of want) {
      const i = pool.findIndex((e) => e.key === key)
      if (i >= 0) keep.push(pool.splice(i, 1)[0])
      else need.push(key)
    }
    for (const e of pool) e.animal.dispose()
    for (const key of need) {
      const [species, mu] = key.split(':')
      if (!ANIMALS[species]) continue
      const a = new Animal(species, mu && mu !== '_' ? mu : null, { income: 1, mode: 'pen', bounds: BASES[slot] })
      const B = BASES[slot]
      a.pos.set(B.minX + 3 + Math.random() * (B.maxX - B.minX - 6), 0, B.minZ + 3 + Math.random() * (B.maxZ - B.minZ - 6))
      a.groundAt = 0
      a.pickTarget()
      scene.add(a.model)
      keep.push({ key, animal: a })
    }
    s.animals = keep
  }

  function drawSigns(slot, p) {
    const b = live.bases[slot]
    if (!p) {
      b.marker.html = baseMarkerHtml('FREE BASE', { free: true })
      b.upgradeSign.redraw(1, 'FREE', 'EMPTY BASE')
      b.treadmillSign.redraw('FREE', 'TREADMILL', '')
      b.stepLabel.visible = false
      return
    }
    const name = clean(p.username) || 'Player'
    b.marker.html = baseMarkerHtml(`${name}'s BASE`)
    b.upgradeSign.redraw(p.penLevel, `${slots[slot].animals.length} ANIMALS`, name.toUpperCase().slice(0, 12))
    if (p.tml < 0) b.treadmillSign.redraw('LOCKED', 'TREADMILL', '')
    else b.treadmillSign.redraw('TREADMILL', `LVL ${p.tml + 1}`, `${fmt(p.steps)} STEPS`)
    b.stepLabel.visible = p.tml >= 0
    if (p.tml >= 0) b.stepLabel.html = `+${fmt(TREADMILL.perStep[p.tml] ?? 1)}/STEP`
  }

  return {
    slots,
    // Per frame: ctx is main.js's { now, near }.
    update(dt, ctx) {
      const mine = getMySlot()
      const owners = new Map() // slot -> roster entry
      net.players((p, sid, me) => {
        if (!me && Number.isInteger(p.slot) && p.slot >= 0 && p.slot < BASES.length && p.slot !== mine) owners.set(p.slot, p)
      })
      for (let i = 0; i < BASES.length; i++) {
        const b = live.bases[i]
        const s = slots[i]
        if (i === mine) {
          // Not ours to fill; clear anything left from before a slot change.
          if (s.animals.length || s.owner) {
            syncAnimals(i, '')
            s.owner = null
            s.sig = ''
          }
          continue
        }
        const p = owners.get(i) ?? null
        if (p) syncAnimals(i, p.base)
        else if (s.animals.length) syncAnimals(i, '')
        const sig = p ? `${p.username}|${p.penLevel}|${p.tml}|${Math.floor(p.steps)}|${p.base.length}` : 'free'
        if (sig !== s.sig) {
          s.sig = sig
          drawSigns(i, p)
        }
        s.owner = p
        for (const e of s.animals) e.animal.update(dt, ctx)
        const runner = p?.tm ? remotePlayers.runnerOf(i) : null
        const stats = p ? { steps: p.steps, stepsText: fmt(p.steps), perStepText: fmt(TREADMILL.perStep[Math.max(0, p.tml)] ?? 1) } : { steps: 0, stepsText: '0', perStepText: '1' }
        animateMill(b, dt, { training: !!runner, runner, unlocked: !!p && p.tml >= 0, view: consoleView(stats), near: ctx.near })
      }
    },
    // The roster entry of whoever owns `slot` (not the local player), or null.
    ownerOf(slot) {
      return slots[slot]?.owner ?? null
    },
  }
}
