// Player progress and the economy: one plain object. Where it is saved is net.js's call (the
// server for signed-in players, this browser's localStorage for guests / no server); this file
// only builds it (snapshot / hydrate). Money only: nothing in the game is bought with a premium
// currency. Other modules listen with on(event, fn):
//   'money' (money, delta) · 'darts' · 'weapon' · 'pen' · 'goal' · 'bp' · 'boost' · 'cosmetic' ·
//   'steps' · 'index' · 'world' · 'settings' · 'hydrate' (a whole new save was loaded) · 'offline' (n)
import {
  ANIMALS, BATTLE_PASS, BOOSTS, GOALS, INDEX_ANIMALS, MUTATIONS, OFFLINE, PEN, RARITIES, SAVE_KEY, SEASON, SKINS, START, START_WORLD,
  TREADMILL, TREAD_BOOST, DART_SHOP, DARTS, WEAPONS, WORLDS, COSMETICS, worldAnimals, seasonAnimals,
} from '../config.js'

// A full Dart Shop stock (x the Big Quiver's mult when owned).
const fullStock = (quiver = false) => Object.fromEntries(Object.entries(DARTS).map(([id, d]) => [id, d.stock * (quiver ? DART_SHOP.quiver.mult : 1)]))

const fresh = () => ({
  v: 3,
  money: START.money,
  earned: 0,
  captures: 0,
  steps: 0,
  playtime: 0,
  darts: { basic: START.darts.basic },
  dartType: 'basic',
  weapons: { blowpipe: true },
  weapon: 'blowpipe',
  pen: { level: 1, animals: [] }, // animals = ACTIVE (in the pen, earning)
  storage: [], // caught animals waiting in storage (no income)
  treadmill: { unlocked: false, level: 0 },
  discovered: {}, // species -> times caught
  mutCaught: {}, // species -> mutation ids caught with ('normal' = none)
  bestTier: -1,
  eventCaught: 0,
  boosts: { luck: 0, cash: 0, tread: 0 },
  giftAt: 0,
  bp: { xp: 0, claimed: [] },
  goal: 0,
  cosmetics: { trails: { none: true }, trail: 'none', auras: { none: true }, aura: 'none', skins: { classic: true }, skin: 'classic' },
  dartShop: { restockAt: 0, stock: fullStock(), quiver: false, freeAt: 0 },
  world: START_WORLD,
  worldsUnlocked: [START_WORLD],
  indexClaimed: [], // worlds whose Index reward was claimed
  mutClaimed: {}, // mutation -> milestone counts claimed
  seasonClaimed: [], // seasons whose Index reward was claimed
  settings: { music: true, ambience: true, effects: true, interface: true },
  playtimeLocal: { day: 0, seconds: 0, claimed: [] }, // Playtime Rewards when there is no server
  lastSeen: 0,
  nextId: 1,
})

export const state = fresh()
const listeners = new Map()
export function on(ev, fn) {
  if (!listeners.has(ev)) listeners.set(ev, new Set())
  listeners.get(ev).add(fn)
  return () => listeners.get(ev).delete(fn)
}
export function emit(ev, ...args) {
  for (const fn of listeners.get(ev) ?? []) fn(...args)
}

// --- Save shape ---------------------------------------------------------------------------------
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const validEntry = (a) => isObj(a) && ANIMALS[a.species] && Number.isFinite(a.income)

// The save (what net.js stores): everything in `state`.
export function snapshot() {
  state.lastSeen = Date.now()
  return JSON.parse(JSON.stringify(state))
}

// Replaces the progress with a saved one (browser save or the server's). Missing fields keep
// their fresh defaults, v1 saves are migrated, and offline income is offered through 'offline'.
export function hydrate(data) {
  const base = fresh()
  if (!isObj(data)) {
    Object.assign(state, base)
    emit('hydrate')
    return
  }
  Object.assign(state, base, data)
  for (const k of ['darts', 'pen', 'dartShop', 'boosts', 'bp', 'treadmill', 'settings', 'playtimeLocal']) state[k] = { ...base[k], ...(isObj(data[k]) ? data[k] : {}) }
  state.cosmetics = { ...base.cosmetics, ...(isObj(data.cosmetics) ? data.cosmetics : {}) }
  for (const k of ['trails', 'auras', 'skins']) state.cosmetics[k] = { ...base.cosmetics[k], ...(isObj(state.cosmetics[k]) ? state.cosmetics[k] : {}) }
  if (!SKINS[state.cosmetics.skin]) state.cosmetics.skin = 'classic'
  if (!COSMETICS.auras[state.cosmetics.aura]) state.cosmetics.aura = 'none'
  if (typeof data.music === 'boolean') state.settings.music = data.music // v1 field
  delete state.music
  state.pen.animals = (Array.isArray(state.pen.animals) ? state.pen.animals : []).filter(validEntry)
  state.storage = (Array.isArray(state.storage) ? state.storage : []).filter(validEntry)
  for (const k of ['discovered', 'mutCaught', 'mutClaimed']) if (!isObj(state[k])) state[k] = {}
  for (const k of ['indexClaimed', 'seasonClaimed', 'worldsUnlocked']) if (!Array.isArray(state[k])) state[k] = []
  if (!state.worldsUnlocked.includes(START_WORLD)) state.worldsUnlocked.unshift(START_WORLD)
  if (!WORLDS[state.world] || !worldUnlocked(state.world)) state.world = START_WORLD
  // v1: pen level L held PEN.oldCapacity[L-1] animals; slots are now baseSlots + level - 1.
  const ver = Number(data.v) || 1
  if (ver < 2) {
    const cap = PEN.oldCapacity[Math.min(Math.max(1, state.pen.level) - 1, PEN.oldCapacity.length - 1)]
    state.pen.level = Math.max(1, cap - PEN.baseSlots + 1)
    for (const a of state.pen.animals) addMut(a.species, a.mutation)
  }
  // v2 -> v3: the new dart, weapon and trail catalogs (old ids map to their closest new one).
  if (ver < 3) {
    const d = state.darts
    const old = { sleepy: 'reinforced', heavy: 'reinforced', golden: 'powerful' }
    const next = { basic: d.basic ?? 0 }
    for (const [from, to] of Object.entries(old)) if (d[from] > 0) next[to] = (next[to] ?? 0) + d[from]
    state.darts = next
    if (state.weapons.crossbow) state.weapons.rifle = true
    delete state.weapons.crossbow
    if (state.weapon === 'crossbow') state.weapon = 'rifle'
    const trailMap = { sparkle: 'white', leaf: 'white', rainbow: 'green', fire: 'green', money: 'blue' }
    const trails = { none: true }
    for (const [id, on] of Object.entries(state.cosmetics.trails)) if (on && trailMap[id]) trails[trailMap[id]] = true
    state.cosmetics.trails = trails
    state.cosmetics.trail = trailMap[state.cosmetics.trail] ?? 'none'
    state.dartShop = { ...base.dartShop }
  }
  state.v = 3
  for (const id of Object.keys(state.weapons)) if (!WEAPONS[id]) delete state.weapons[id]
  if (!state.weapons[state.weapon]) state.weapon = 'blowpipe'
  // "sleepy" darts handed out by the Free Gift / Battle Pass after the v3 catalog: keep them as reinforced.
  if (state.darts.sleepy > 0) state.darts.reinforced = (state.darts.reinforced ?? 0) + state.darts.sleepy
  for (const id of Object.keys(state.darts)) if (!DARTS[id] || !(state.darts[id] >= 0)) delete state.darts[id]
  if (!DARTS[state.dartType]) state.dartType = 'basic'
  if (!COSMETICS.trails[state.cosmetics.trail]) state.cosmetics.trail = 'none'
  state.dartShop.stock = { ...fullStock(state.dartShop.quiver), ...(isObj(state.dartShop.stock) ? state.dartShop.stock : {}) }
  state.pen.level = Math.min(Math.max(1, Math.floor(state.pen.level) || 1), PEN.maxSlots - PEN.baseSlots + 1)
  // Over the slots (e.g. a stale save): the extras go to storage.
  while (state.pen.animals.length > activeSlots()) state.storage.push(state.pen.animals.pop())
  for (const a of [...state.pen.animals, ...state.storage]) if (!(a.id < state.nextId)) state.nextId = (a.id | 0) + 1
  if (!state.giftAt) state.giftAt = Date.now() + 60_000
  if (!state.dartShop.restockAt) state.dartShop.restockAt = Date.now() + DART_SHOP.restock * 1000
  emit('hydrate')
  let offline = 0
  if (state.lastSeen) {
    const away = Math.min(OFFLINE.cap, Math.max(0, (Date.now() - state.lastSeen) / 1000))
    if (away > 60) offline = Math.floor(baseIncome() * away * OFFLINE.rate)
  }
  if (offline > 0) emit('offline', offline)
}

// The browser save (guests / no server; net.js decides). Returns the data or null.
export function readLocal() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
let lastLocal = ''
export function writeLocal() {
  try {
    const snap = JSON.stringify(snapshot())
    if (snap === lastLocal) return
    lastLocal = snap
    localStorage.setItem(SAVE_KEY, snap)
  } catch {
    // Storage full or blocked: progress lives for this session.
  }
}
// Set by net.js: saves wherever this player's progress lives.
let saver = writeLocal
export const setSaver = (fn) => (saver = fn)
export const save = () => saver()

export function resetSave() {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    // Ignore.
  }
  location.reload()
}

// --- Money ------------------------------------------------------------------------------------
export function addMoney(n, quiet = false) {
  if (!(n > 0)) return
  state.money += n
  state.earned += n
  emit('money', state.money, n, quiet)
  checkGoals()
}
export function spend(n) {
  if (!(n >= 0) || state.money < n) return false
  state.money -= n
  emit('money', state.money, -n)
  return true
}

const now = () => Date.now()
export const boostLeft = (id) => Math.max(0, ((state.boosts[id] ?? 0) - now()) / 1000)
// Lucky hour: the first 5 minutes of every real-time hour.
export function luckyHourLeft() {
  const d = new Date()
  const s = d.getMinutes() * 60 + d.getSeconds()
  return s < 300 ? 300 - s : 0
}
export const luckMult = () => (boostLeft('luck') > 0 ? 2 : 1) * (luckyHourLeft() > 0 ? 2 : 1)
export const cashMult = () => (boostLeft('cash') > 0 ? 2 : 1)

export const baseIncome = () => state.pen.animals.reduce((s, a) => s + a.income, 0)
export const incomePerSec = () => baseIncome() * cashMult()

export function boostPrice(id) {
  const b = BOOSTS[id]
  return Math.max(b.base, Math.round(baseIncome() * b.perIncome))
}
export function buyBoost(id) {
  if (!spend(boostPrice(id))) return false
  addBoost(id, BOOSTS[id].seconds)
  return true
}
export function addBoost(id, seconds) {
  state.boosts[id] = Math.max(now(), state.boosts[id] ?? 0) + seconds * 1000
  emit('boost', id)
}

// --- Zoo: active pen + storage ------------------------------------------------------------------
export const activeSlots = () => Math.min(PEN.maxSlots, PEN.baseSlots + state.pen.level - 1)
export const penCapacity = activeSlots
export const penUpgradePrice = () => (activeSlots() >= PEN.maxSlots ? null : PEN.slotPrice(state.pen.level))
export function upgradePen() {
  const price = penUpgradePrice()
  if (price == null || !spend(price)) return false
  state.pen.level++
  emit('pen')
  checkGoals()
  return true
}
const tierOf = (species) => RARITIES[ANIMALS[species].rarity].tier
function addMut(species, mutation) {
  const list = (state.mutCaught[species] ??= [])
  const id = mutation ?? 'normal'
  if (!list.includes(id)) {
    list.push(id)
    return true
  }
  return false
}
// A caught (or gifted) animal joins the zoo: active when a slot is free, else storage.
// info: { species, mutation, income, event }. Returns { entry, where: 'active' | 'storage' } or
// null when both are full. Counts as a capture unless `gift`.
export function addToPen(info, { gift = false } = {}) {
  const active = state.pen.animals.length < activeSlots()
  if (!active && state.storage.length >= PEN.storage) return null
  const entry = { id: state.nextId++, species: info.species, mutation: info.mutation ?? null, income: Math.max(1, Math.round(info.income)), at: now() }
  ;(active ? state.pen.animals : state.storage).push(entry)
  const firstOfKind = !state.discovered[info.species]
  state.discovered[info.species] = (state.discovered[info.species] ?? 0) + 1
  const newMut = addMut(info.species, entry.mutation)
  if (!gift) {
    state.captures++
    const tier = tierOf(info.species)
    state.bestTier = Math.max(state.bestTier, tier)
    if (info.event) state.eventCaught++
    addXp(BATTLE_PASS.captureXp[tier] ?? 10)
  }
  emit('pen')
  if (firstOfKind || newMut) emit('index')
  checkGoals()
  save()
  return { entry, where: active ? 'active' : 'storage' }
}
const removeFrom = (list, id) => {
  const i = list.findIndex((a) => a.id === id)
  return i < 0 ? null : list.splice(i, 1)[0]
}
export const sellPrice = (a) => Math.round(a.income * PEN.sellSeconds)
export function sellAnimal(id) {
  const a = removeFrom(state.pen.animals, id) ?? removeFrom(state.storage, id)
  if (!a) return 0
  const pay = sellPrice(a)
  addMoney(pay)
  emit('pen')
  return pay
}
// Active -> storage.
export function storeAnimal(id) {
  if (state.storage.length >= PEN.storage) return false
  const a = removeFrom(state.pen.animals, id)
  if (!a) return false
  state.storage.push(a)
  emit('pen')
  return true
}
// Storage -> active (needs a free slot).
export function activateAnimal(id) {
  if (state.pen.animals.length >= activeSlots()) return false
  const a = removeFrom(state.storage, id)
  if (!a) return false
  state.pen.animals.push(a)
  emit('pen')
  return true
}
// The best earners active, the rest stored. Returns true when something moved.
export function equipBest() {
  const all = [...state.pen.animals, ...state.storage].sort((a, b) => b.income - a.income)
  const n = Math.min(activeSlots(), all.length)
  const best = new Set(all.slice(0, n).map((a) => a.id))
  const before = state.pen.animals.map((a) => a.id).sort().join()
  state.pen.animals = all.filter((a) => best.has(a.id))
  state.storage = all.filter((a) => !best.has(a.id)).slice(0, PEN.storage)
  const changed = state.pen.animals.map((a) => a.id).sort().join() !== before
  emit('pen')
  return changed
}
export function sellAllStorage() {
  const pay = state.storage.reduce((s, a) => s + sellPrice(a), 0)
  if (!state.storage.length) return 0
  state.storage = []
  addMoney(pay)
  emit('pen')
  return pay
}

// --- Weapons + worlds ------------------------------------------------------------------------------
// A world opens with its weapon (WORLDS[w].weapon) or any stronger one (later in WEAPONS).
const WEAPON_IDS = Object.keys(WEAPONS)
export const weaponRank = (id) => WEAPON_IDS.indexOf(id)
export const bestWeaponRank = () => Math.max(0, ...Object.keys(state.weapons).filter((id) => state.weapons[id]).map(weaponRank))
export const worldUnlocked = (id) => state.worldsUnlocked.includes(id) || (WORLDS[id] && bestWeaponRank() >= weaponRank(WORLDS[id].weapon))
// Worlds a weapon is the key to.
export const worldsOf = (weapon) => Object.keys(WORLDS).filter((w) => WORLDS[w].weapon === weapon)
// Buys and equips a weapon. Returns the worlds it newly opens, or null when it can't be bought.
export function buyWeapon(id) {
  const w = WEAPONS[id]
  if (!w || state.weapons[id]) return null
  const before = Object.keys(WORLDS).filter(worldUnlocked)
  if (!spend(w.price)) return null
  state.weapons[id] = true
  state.weapon = id
  const opened = Object.keys(WORLDS).filter((x) => worldUnlocked(x) && !before.includes(x))
  for (const x of opened) if (!state.worldsUnlocked.includes(x)) state.worldsUnlocked.push(x)
  emit('weapon')
  emit('goal')
  if (opened.length) emit('worlds')
  return opened
}
export function equipWeapon(id) {
  if (!state.weapons[id]) return false
  state.weapon = id
  emit('weapon')
  return true
}
// The portal: go to an open area's gate in the lane (main.js moves the player on 'travel').
export function travel(id) {
  if (!worldUnlocked(id)) return false
  emit('travel', id)
  return true
}
// The player walked into a lane area: it becomes their current world (Index tab, presence).
export function enterArea(id) {
  if (!WORLDS[id] || state.world === id) return false
  state.world = id
  emit('world')
  return true
}

// --- Dart Shop ------------------------------------------------------------------------------------
export const dartStock = (id) => state.dartShop.stock[id] ?? 0
export const restockLeft = () => Math.max(0, (state.dartShop.restockAt - now()) / 1000)
export const freeRestockLeft = () => Math.max(0, ((state.dartShop.freeAt ?? 0) - now()) / 1000)
export const instantRestockPrice = () => Math.max(DART_SHOP.instant.base, Math.round(incomePerSec() * DART_SHOP.instant.perIncome))
export const packPrice = (id) => DARTS[id].price * DART_SHOP.packMult
export const allStockPrice = () => Object.keys(DARTS).reduce((s, id) => s + dartStock(id) * DARTS[id].price, 0)
// A fresh stock now; the timer starts over.
export function restockDarts() {
  state.dartShop.stock = fullStock(state.dartShop.quiver)
  state.dartShop.restockAt = now() + DART_SHOP.restock * 1000
  emit('darts')
}
function addDarts(id, n) {
  state.darts[id] = (state.darts[id] ?? 0) + n
  if ((state.darts[state.dartType] ?? 0) === 0) state.dartType = id
  emit('darts')
}
// Buys up to n darts of a type from the stock ('all' = as many as stock and money allow).
// Returns how many were bought.
export function buyDarts(id, n) {
  const d = DARTS[id]
  if (!d) return 0
  const want = n === 'all' ? Infinity : n
  const k = Math.min(want, dartStock(id), Math.floor(state.money / d.price))
  if (!(k > 0) || !spend(k * d.price)) return 0
  state.dartShop.stock[id] -= k
  addDarts(id, k)
  return k
}
// A special dart's x10 pack: outside the stock, at DART_SHOP.packMult x the price.
export function buyDartPack(id) {
  const d = DARTS[id]
  if (!d?.pack || !spend(packPrice(id))) return 0
  addDarts(id, d.pack)
  return d.pack
}
// Everything in stock at once (all or nothing).
export function buyAllStock() {
  const price = allStockPrice()
  if (!(price > 0) || !spend(price)) return false
  for (const id of Object.keys(DARTS)) {
    const k = dartStock(id)
    if (k > 0) addDarts(id, k)
  }
  state.dartShop.stock = Object.fromEntries(Object.keys(DARTS).map((id) => [id, 0]))
  emit('darts')
  return true
}
export function instantRestock() {
  if (!spend(instantRestockPrice())) return false
  restockDarts()
  return true
}
export function freeRestock() {
  if (freeRestockLeft() > 0) return false
  state.dartShop.freeAt = now() + DART_SHOP.freeEvery * 1000
  restockDarts()
  return true
}
// Big Quiver: every stock x2 from now on (the current one too).
export function buyQuiver() {
  if (state.dartShop.quiver || !spend(DART_SHOP.quiver.price)) return false
  state.dartShop.quiver = true
  for (const id of Object.keys(DARTS)) state.dartShop.stock[id] = dartStock(id) * DART_SHOP.quiver.mult
  emit('darts')
  return true
}

// --- Trails + auras --------------------------------------------------------------------------------
export function buyTrail(id) {
  const t = COSMETICS.trails[id]
  if (!t || state.cosmetics.trails[id] || !spend(t.price)) return false
  state.cosmetics.trails[id] = true
  state.cosmetics.trail = id
  emit('cosmetic')
  emit('steps', state.steps)
  return true
}
export function equipTrail(id) {
  if (!state.cosmetics.trails[id]) return false
  state.cosmetics.trail = id
  emit('cosmetic')
  emit('steps', state.steps)
  return true
}
// [have, need] toward an earned aura (shop auras: [owned, 1]).
export function auraProgress(id) {
  const a = COSMETICS.auras[id]
  if (a.get === 'mutation') return [mutationFound(a.id), INDEX_ANIMALS.length]
  if (a.get === 'world') return [state.indexClaimed.includes(a.id) ? 1 : 0, 1]
  return [state.cosmetics.auras[id] ? 1 : 0, 1]
}
export function auraOwned(id) {
  if (state.cosmetics.auras[id]) return true
  const a = COSMETICS.auras[id]
  if (a && a.get !== 'shop') {
    const [have, need] = auraProgress(id)
    if (have >= need) return (state.cosmetics.auras[id] = true)
  }
  return false
}
export function buyAura(id) {
  const a = COSMETICS.auras[id]
  if (!a || a.get !== 'shop' || state.cosmetics.auras[id] || !spend(a.price)) return false
  state.cosmetics.auras[id] = true
  state.cosmetics.aura = id
  emit('cosmetic')
  return true
}
export function equipAura(id) {
  if (!auraOwned(id)) return false
  state.cosmetics.aura = id
  emit('cosmetic')
  return true
}

// --- Index --------------------------------------------------------------------------------------
export const isDiscovered = (species) => (state.discovered[species] ?? 0) > 0
export const caughtWith = (species, mutation) => (state.mutCaught[species] ?? []).includes(mutation ?? 'normal')
export const worldFound = (world) => worldAnimals(world).filter(isDiscovered).length
export const indexUnlocked = () => INDEX_ANIMALS.filter(isDiscovered).length
export const mutationFound = (m) => INDEX_ANIMALS.filter((s) => caughtWith(s, m)).length
export const seasonFound = () => seasonAnimals().filter(isDiscovered).length

// World reward: claimable once all six are discovered.
export function claimWorld(world) {
  const w = WORLDS[world]
  if (!w || state.indexClaimed.includes(world) || worldFound(world) < 6) return null
  state.indexClaimed.push(world)
  addMoney(w.reward.money)
  addSteps(w.reward.steps)
  // The world's aura comes with it.
  const aura = Object.keys(COSMETICS.auras).find((id) => COSMETICS.auras[id].get === 'world' && COSMETICS.auras[id].id === world)
  if (aura) state.cosmetics.auras[aura] = true
  emit('cosmetic')
  emit('index')
  return { ...w.reward, aura }
}
export function claimMutation(m, milestone) {
  const claimed = (state.mutClaimed[m] ??= [])
  if (!MUTATIONS[m] || claimed.includes(milestone.n) || mutationFound(m) < milestone.n) return null
  claimed.push(milestone.n)
  const out = {}
  if (milestone.money) addMoney((out.money = Math.max(milestone.money, Math.round(incomePerSec() * milestone.perIncome))))
  if (milestone.steps) addSteps((out.steps = milestone.steps))
  if (milestone.aura) {
    state.cosmetics.auras[m] = true
    state.cosmetics.aura = m
    out.aura = m
    emit('cosmetic')
  }
  emit('index')
  return out
}
export function claimSeason() {
  if (state.seasonClaimed.includes(SEASON.id) || seasonFound() < seasonAnimals().length) return null
  state.seasonClaimed.push(SEASON.id)
  state.cosmetics.skins[SEASON.reward.skin] = true
  emit('cosmetic')
  emit('index')
  return SEASON.reward
}

// --- Weapon skins -------------------------------------------------------------------------------
// [have, need] toward a skin's unlock (shop skins: [0, 1] until bought).
export function skinProgress(id) {
  const u = SKINS[id].unlock
  switch (u.type) {
    case 'default': return [1, 1]
    case 'shop': return [state.cosmetics.skins[id] ? 1 : 0, 1]
    case 'season': return [state.seasonClaimed.includes(u.id) ? 1 : 0, 1]
    case 'captures': return [Math.min(state.captures, u.n), u.n]
    case 'mutation': return [Math.min(mutationFound(u.id), u.n), u.n]
    case 'world': return [worldFound(u.id), 6]
    case 'playtime': return [Math.min(Math.floor(state.playtime / 3600), u.h), u.h]
  }
  return [0, 1]
}
export function skinOwned(id) {
  if (state.cosmetics.skins[id]) return true
  const [have, need] = skinProgress(id)
  if (SKINS[id].unlock.type !== 'shop' && have >= need) {
    state.cosmetics.skins[id] = true // earned: it stays
    return true
  }
  return false
}
export function buySkin(id) {
  const u = SKINS[id]?.unlock
  if (u?.type !== 'shop' || state.cosmetics.skins[id] || !spend(u.price)) return false
  state.cosmetics.skins[id] = true
  state.cosmetics.skin = id
  emit('cosmetic')
  return true
}
// --- Free shop items (rewarded ads, game/ads.js) -------------------------------------------------------
// The $-priced shop item `id` of `kind` ('skin' | 'aura' | 'trail'): { name, price, owned }, or null when it
// isn't sold for $ (earned skins / auras, 'none', unknown ids).
export function shopItem(kind, id) {
  if (kind === 'skin') {
    const s = SKINS[id]
    return s?.unlock.type === 'shop' ? { name: s.name, price: s.unlock.price, owned: !!state.cosmetics.skins[id] } : null
  }
  if (kind === 'aura') {
    const a = COSMETICS.auras[id]
    return a?.get === 'shop' && a.price > 0 ? { name: a.name, price: a.price, owned: !!state.cosmetics.auras[id] } : null
  }
  if (kind === 'trail') {
    const t = COSMETICS.trails[id]
    return t && t.price > 0 ? { name: t.name, price: t.price, owned: !!state.cosmetics.trails[id] } : null
  }
  return null
}
// Gives a shop item for free and equips it (what buying does, minus the price). Returns its name or ''.
export function unlockShopItem(kind, id) {
  const it = shopItem(kind, id)
  if (!it || it.owned) return ''
  if (kind === 'skin') state.cosmetics.skins[id] = true
  if (kind === 'aura') state.cosmetics.auras[id] = true
  if (kind === 'trail') state.cosmetics.trails[id] = true
  state.cosmetics[kind] = id
  emit('cosmetic')
  if (kind === 'trail') emit('steps', state.steps)
  return it.name
}
export function equipSkin(id) {
  if (!skinOwned(id)) return false
  state.cosmetics.skin = id
  emit('cosmetic')
  return true
}

// --- Treadmill ---------------------------------------------------------------------------------
export function unlockTreadmill() {
  if (state.treadmill.unlocked) {
    const price = TREADMILL.upgrade[state.treadmill.level]
    if (price == null || !spend(price)) return false
    state.treadmill.level++
  } else {
    if (!spend(TREADMILL.unlock)) return false
    state.treadmill.unlocked = true
  }
  emit('treadmill')
  checkGoals()
  return true
}
// Steps per treadmill step: the treadmill level x Treadmill x2 x the equipped trail's speed.
export const trailSpeed = () => COSMETICS.trails[state.cosmetics.trail]?.speed ?? 1
export const stepsPerStep = () => (TREADMILL.perStep[state.treadmill.level] ?? 1) * (boostLeft('tread') > 0 ? TREAD_BOOST.mult : 1) * trailSpeed()
export const speedBonus = () => Math.min(TREADMILL.maxBonus, Math.floor(state.steps / TREADMILL.stepsPer) * TREADMILL.speedPer)
export function addSteps(n) {
  state.steps += n
  emit('steps', state.steps)
}

// --- Battle pass (free track only) ----------------------------------------------------------------
export const bpLevel = () => Math.min(BATTLE_PASS.levels, Math.floor(state.bp.xp / BATTLE_PASS.xpPerLevel))
export function addXp(n) {
  const before = bpLevel()
  state.bp.xp += n
  emit('bp', bpLevel() > before)
}
// Reward for reaching level L (1-based): money that grows with the level, darts on some.
export function bpReward(L) {
  if (L % 5 === 0) return { type: 'darts', dart: L >= 15 ? 'powerful' : 'reinforced', n: L >= 15 ? 5 : 10 }
  return { type: 'money', n: Math.round(250 * Math.pow(1.6, L - 1)) }
}

// --- Goals -----------------------------------------------------------------------------------------
export function goalProgress(g = GOALS[state.goal]) {
  if (!g) return [0, 0]
  switch (g.type) {
    case 'captures': return [Math.min(state.captures, g.n), g.n]
    case 'treadmill': return [state.treadmill.unlocked ? 1 : 0, 1]
    case 'earned': return [Math.min(state.earned, g.n), g.n]
    case 'tier': return [state.bestTier >= g.n ? 1 : 0, 1]
    case 'pen': return [Math.min(state.pen.level, g.n), g.n]
    case 'weapon': return [Object.keys(state.weapons).length > 1 ? 1 : 0, 1]
    case 'event': return [Math.min(state.eventCaught, g.n), g.n]
    default: return [0, 1]
  }
}
let checking = false
export function checkGoals() {
  if (checking) return
  checking = true
  let g = GOALS[state.goal]
  while (g) {
    const [p, n] = goalProgress(g)
    if (p < n) break
    state.goal++
    emit('goalDone', g)
    state.money += g.reward
    state.earned += g.reward
    emit('money', state.money, g.reward)
    g = GOALS[state.goal]
  }
  emit('goal')
  checking = false
}

export function rarityOf(species) {
  return RARITIES[ANIMALS[species].rarity]
}

// --- Number formatting: 950, 1.2K, 3.4M, 1.5B ... --------------------------------------------------
const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx']
export function fmt(n) {
  n = Math.floor(n)
  if (Math.abs(n) < 1000) return String(n)
  let u = 0
  let v = n
  while (Math.abs(v) >= 1000 && u < UNITS.length - 1) {
    v /= 1000
    u++
  }
  return `${v >= 100 ? Math.floor(v) : Math.floor(v * 10) / 10}${UNITS[u]}`
}
export function fmtTime(s) {
  s = Math.max(0, Math.ceil(s))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}
export const fmtClock = (s) => {
  s = Math.max(0, Math.ceil(s))
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':')
}
