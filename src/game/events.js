// Timed events: every EVENTS.every seconds a special animal (a Legendary
// Boar, a Rainbow Heron, ...) appears in the lane with a light beam. A banner
// tracks it ("Free to catch" / "Put to sleep by X" / "Carried by X") and the
// wooden sign counts down to the next one. It leaves if nobody takes it in time.
import { Vector3 } from 'three'
import { ANIMALS, AREA_IDS, EVENTS, LANE, LANE_AREAS, MUTATIONS, RARITIES, SEASON, WORLDS, seasonAnimals, worldAnimals } from '../config.js'
import { fmtTime, luckyHourLeft, worldUnlocked } from './state.js'
import { displayName, rollIncome } from './animals.js'
import * as hud from '../ui/hud.js'
import { sfx } from '../audio/index.js'

const ICON = { boar: '🐗', heron: '🪶', fox: '🦊', deer: '🦌', cow: '🐄', chicken: '🐔', rabbit: '🐰', pig: '🐷', goat: '🐐', sheep: '🐑', turkey: '🦃' }

// The area the next event happens in: one of the player's open areas, picked when the previous
// event ends (so the sign can name what is coming).
const pickArea = () => {
  const open = AREA_IDS.filter(worldUnlocked)
  return open[Math.floor(Math.random() * open.length)] ?? 'meadow'
}

// An EVENTS.list entry -> { species, mutation, area, world }: that area's (or the season's)
// animal of that rarity.
function resolve(e, world) {
  const rarity = e.season ?? e.pick
  const ids = e.season ? seasonAnimals() : worldAnimals(world)
  const species = ids.find((id) => ANIMALS[id].rarity === rarity) ?? ids[ids.length - 1]
  return { species, mutation: e.mutation, world, area: e.season ? `${SEASON.name} · ${WORLDS[world].name}` : WORLDS[world].name }
}

export function createEvents({ animals, live }) {
  let nextIn = EVENTS.first
  let index = 0
  let current = null // { animal, left, def, title }
  let signTimer = 0
  let nextArea = pickArea()

  function start() {
    const e = resolve(EVENTS.list[index++ % EVENTS.list.length], worldUnlocked(nextArea) ? nextArea : pickArea())
    const income = rollIncome(e.species, e.mutation, e.world)
    const a = animals.spawn(e.species, e.mutation, { event: true, income, area: e.world })
    // The far half of its area, so it is a trip.
    const A = LANE_AREAS[e.world]
    if (ANIMALS[e.species].zone !== 'marsh') a.pos.set((Math.random() - 0.5) * 60, LANE.y, A.spawn.minZ + 4 + Math.random() * (A.spawn.maxZ - A.spawn.minZ) * 0.4)
    const r = RARITIES[ANIMALS[e.species].rarity]
    const title = `${ANIMALS[e.species].name} ${e.mutation ? MUTATIONS[e.mutation].name + ' ' : ''}${r.name} · ${e.area}`.toUpperCase()
    current = { animal: a, left: EVENTS.lasts, title, color: r.color, icon: ICON[ANIMALS[e.species].model] ?? '⭐' }
    hud.announce(`A ${displayName(e.species, e.mutation).toUpperCase()} ${ANIMALS[e.species].name.toUpperCase()} APPEARED!`, r.color, 4)
    sfx.fanfare()
  }

  function end(msg) {
    if (msg) hud.toast(msg)
    current = null
    nextIn = EVENTS.every
    nextArea = pickArea()
    hud.setEvent(null)
  }

  return {
    get current() {
      return current
    },
    // The event animal was put in a pen by someone.
    captured(animal, by) {
      if (!current || current.animal !== animal) return false
      hud.announce(`${by.toUpperCase()} CAPTURED THE ${current.title.split(' · ')[0]}!`, current.color, 4)
      sfx.fanfare()
      end()
      return true
    },
    update(dt) {
      if (!current) {
        nextIn -= dt
        if (nextIn <= 0) start()
      } else {
        const a = current.animal
        if (!animals.list.includes(a)) return end() // captured elsewhere / removed
        if (a.state !== 'carried' && a.state !== 'asleep') current.left -= dt
        if (current.left <= 0 && a.state !== 'carried' && a.state !== 'asleep' && a.state !== 'leaving') {
          a.state = 'leaving'
          a.target.set(a.pos.x, LANE.y, a.area.minZ + 2)
          hud.announce(`THE ${current.title.split(' · ')[0]} RAN AWAY!`, current.color, 4)
          end()
          return
        }
        const status = a.state === 'carried' ? `Carried by ${a.carriedBy}` : a.state === 'asleep' ? `Put to sleep by ${a.sleptBy}` : 'Free to catch'
        const time = a.asleep ? `${Math.ceil(a.sleepLeft)}s` : fmtTime(current.left)
        hud.setEvent({ icon: current.icon, title: current.title, color: current.color, status, time })
      }
      // Wooden sign + events board, twice a second.
      signTimer -= dt
      if (signTimer <= 0) {
        signTimer = 0.5
        if (current) live.nextEvent.redraw(current.title.split(' · ')[0], fmtTime(current.left), 'Catch it in the lane!')
        else live.nextEvent.redraw('Next Event', fmtTime(nextIn), `${ANIMALS[resolve(EVENTS.list[index % EVENTS.list.length], nextArea).species].name} · ${WORLDS[nextArea].name}`)
        const lucky = luckyHourLeft()
        if (lucky > 0) live.events.redraw('LUCKY HOUR!', 'x2 Luck active', fmtTime(lucky))
        else {
          const d = new Date()
          const toNext = 3600 - (d.getMinutes() * 60 + d.getSeconds())
          live.events.redraw('LUCKY HOUR', 'x2 Luck every hour', `in ${fmtTime(toNext)}`)
        }
      }
    },
  }
}

export const _v = new Vector3()
