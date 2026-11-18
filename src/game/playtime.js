// Playtime Rewards: PLAYTIME[i] unlocks after PLAYTIME[i].at seconds of play today (UTC day).
// With a server the server owns the clock and the claimed list (net.playtime; it answers
// claimPlaytime), so a reload or a second tab can't reset or repeat them. Without one (no
// server configured) this browser counts: state.playtimeLocal, ticked by tick() once a second.
// The reward itself is granted here, only once the claim is accepted.
import { ANIMALS, DARTS, PLAYTIME } from '../config.js'
import { addBoost, addMoney, addSteps, addToPen, emit, fmt, incomePerSec, save, state } from './state.js'
import { claimPlaytimeOnServer, hasServer, net } from '../net.js'
import { rollIncome } from './animals.js'

const utcDay = () => Math.floor(Date.now() / 86400000)

// 'server' (connected), 'local' (no server configured) or 'offline' (server not reached yet).
export const mode = () => (net.playtime ? 'server' : hasServer() ? 'offline' : 'local')

function local() {
  const p = state.playtimeLocal
  if (p.day !== utcDay()) {
    p.day = utcDay()
    p.seconds = 0
    p.claimed = []
  }
  return p
}
export function seconds() {
  if (net.playtime) return net.playtime.seconds + (performance.now() - net.playtime.at) / 1000
  return mode() === 'local' ? local().seconds : 0
}
export const claimed = () => (net.playtime ? net.playtime.claimed : mode() === 'local' ? local().claimed : [])
export const isClaimed = (i) => claimed().includes(i)
export const isReady = (i) => mode() !== 'offline' && !isClaimed(i) && seconds() >= PLAYTIME[i].at
export const anyReady = () => PLAYTIME.some((_, i) => isReady(i))

// Once a second (main.js): the browser clock when there is no server.
export function tick() {
  if (mode() === 'local' && !document.hidden) local().seconds += 1
}

// The tile's top label, e.g. "X30 BASIC", "+32K $", "FOX".
export function label(r) {
  switch (r.kind) {
    case 'darts': return `X${r.n} ${DARTS[r.dart].name.toUpperCase()}`
    case 'money': return `+${fmt(moneyOf(r))} $`
    case 'steps': return `+${fmt(r.n)} SPEED`
    case 'treadmill': return `TREADMILL X2 · ${Math.round(r.seconds / 60)} MIN`
    case 'animal': return ANIMALS[r.species].name.toUpperCase()
  }
  return ''
}
export const moneyOf = (r) => Math.max(r.base, Math.round(incomePerSec() * r.perIncome))

// Grants reward i. Returns a toast line.
function grant(i) {
  const r = PLAYTIME[i]
  switch (r.kind) {
    case 'darts':
      state.darts[r.dart] = (state.darts[r.dart] ?? 0) + r.n
      emit('darts')
      return `+${r.n} ${DARTS[r.dart].name} darts!`
    case 'money': {
      const n = moneyOf(r)
      addMoney(n)
      return `+$${fmt(n)}!`
    }
    case 'steps':
      addSteps(r.n)
      return `+${fmt(r.n)} speed!`
    case 'treadmill':
      addBoost('tread', r.seconds)
      return `Treadmill x2 for ${Math.round(r.seconds / 60)} minutes!`
    case 'animal': {
      const added = addToPen({ species: r.species, mutation: r.mutation, income: rollIncome(r.species, r.mutation) }, { gift: true })
      if (!added) {
        // Zoo full: pay its sell value instead so the reward is never lost.
        const n = Math.round(rollIncome(r.species, r.mutation) * 90)
        addMoney(n)
        return `Zoo full: +$${fmt(n)} instead`
      }
      return `${ANIMALS[r.species].name} joined your zoo${added.where === 'storage' ? ' (storage)' : ''}!`
    }
  }
  return ''
}

// Claims reward i: { ok, text } | { ok: false, reason }.
export async function claim(i) {
  if (!isReady(i)) return { ok: false, reason: isClaimed(i) ? 'claimed' : 'early' }
  if (mode() === 'local') {
    local().claimed.push(i)
  } else {
    const r = await claimPlaytimeOnServer(i)
    if (!r.ok) return { ok: false, reason: r.reason }
  }
  const text = grant(i)
  emit('playtime')
  save()
  return { ok: true, text }
}
