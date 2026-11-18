// The shop windows (panels.js hosts them): DARTS (classic + special darts, stock, restocks,
// Big Quiver), ARMORY (weapon carousel; a weapon unlocks its world), SKIN SHOP (the 15 shop
// skins), AURA SHOP (24 auras: shop / Index), TRAIL SHOP (speed trails). Every price is $
// (money): nothing is sold for a premium currency (workspace rule).
// panels.js calls body(id, view) / header(id) / footer(id) to draw, act(button, view) on a
// click (returns { open: panelId } to switch window), tick(root) once a second.
import './shops.css'
import { COSMETICS, COSMETIC_RARITY, DARTS, DART_SHOP, MUTATIONS, SKINS, WEAPONS, WORLDS } from '../config.js'
import { ICONS } from './icons.js'
import { weaponThumb } from './thumbs.js'
import {
  allStockPrice, auraOwned, auraProgress, bestWeaponRank, buyAllStock, buyAura, buyDartPack, buyDarts, buyQuiver, buySkin, buyTrail, buyWeapon, dartStock,
  equipAura, equipSkin, equipTrail, equipWeapon, fmt, fmtClock, freeRestock, freeRestockLeft, instantRestock, instantRestockPrice, packPrice,
  restockLeft, skinOwned, state, weaponRank, worldsOf,
} from '../game/state.js'
import { sfx } from '../audio/index.js'
import { toast } from './hud.js'

export const SHOP_PANELS = ['darts', 'armory', 'skinShop', 'auraShop', 'trailShop']
const can = (n) => state.money >= n
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const money = (n) => `${fmt(n)} $`
const pill = (text, color = '') => `<div class="sh-pill ol"${color ? ` style="--pc:${color}"` : ''}>${text}</div>`
const rarityTag = (r) => COSMETIC_RARITY[r] ?? COSMETIC_RARITY.common

// --- Icons ---------------------------------------------------------------------------------------------
let gid = 0
// An aura's picture: a flame (flames / storm, + a bolt for storm), stars (sparkles) or a ring (orbit).
export function auraIcon(id, dim = false) {
  const a = COSMETICS.auras[id]
  const [c1, c2] = a.colors
  const g = `ag${gid++}`
  const fill = a.rainbow
    ? `<linearGradient id="${g}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff4d4d"/><stop offset="0.35" stop-color="#ffd23f"/><stop offset="0.65" stop-color="#4dff6a"/><stop offset="1" stop-color="#7ad7ff"/></linearGradient>`
    : `<linearGradient id="${g}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${c2}"/><stop offset="1" stop-color="${c1}"/></linearGradient>`
  const glow = `<ellipse cx="50" cy="58" rx="34" ry="40" fill="${c1}" opacity="0.28"/>`
  let body
  if (a.style === 'flames' || a.style === 'storm') {
    body = `${glow}<path d="M50 6 C58 26 76 34 74 60 C73 80 62 94 50 94 C38 94 27 80 26 62 C25 46 36 40 38 26 C44 36 46 40 50 44 C50 30 48 18 50 6 Z" fill="url(#${g})" stroke="rgba(0,0,0,0.25)" stroke-width="2"/><path d="M50 50 C56 62 62 66 60 78 C58 88 42 88 40 78 C39 68 46 62 50 50 Z" fill="${c2}" opacity="0.85"/>`
    if (a.style === 'storm') body += `<path d="M64 18 L52 46 L62 46 L48 80 L72 40 L61 40 L70 18 Z" fill="#ffffff" stroke="${c1}" stroke-width="2"/>`
  } else if (a.style === 'sparkles') {
    const star = (x, y, r) => `<path d="M${x} ${y - r} L${x + r * 0.28} ${y - r * 0.28} L${x + r} ${y} L${x + r * 0.28} ${y + r * 0.28} L${x} ${y + r} L${x - r * 0.28} ${y + r * 0.28} L${x - r} ${y} L${x - r * 0.28} ${y - r * 0.28} Z" fill="url(#${g})"/>`
    body = `${glow}${star(50, 52, 30)}${star(24, 26, 12)}${star(78, 30, 10)}${star(76, 80, 12)}${star(24, 78, 8)}`
  } else {
    body = `${glow}<ellipse cx="50" cy="60" rx="38" ry="14" fill="none" stroke="url(#${g})" stroke-width="7"/><circle cx="20" cy="56" r="7" fill="${c1}"/><circle cx="80" cy="64" r="7" fill="${c2}"/><circle cx="50" cy="30" r="9" fill="url(#${g})"/>`
  }
  return `<svg class="${dim ? 'sil' : ''}" viewBox="0 0 100 100"><defs>${fill}</defs>${body}</svg>`
}
// A trail's picture: a winged boot in its colours.
export function trailIcon(id) {
  const t = COSMETICS.trails[id]
  const g = `tg${gid++}`
  const [c1, c2 = c1] = t.colors
  const grad = t.rainbow
    ? `<linearGradient id="${g}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff4d4d"/><stop offset="0.3" stop-color="#ffd23f"/><stop offset="0.6" stop-color="#4dff6a"/><stop offset="1" stop-color="#7a5aff"/></linearGradient>`
    : `<linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`
  const stars = t.stars ? '<circle cx="30" cy="40" r="2.5" fill="#fff"/><circle cx="44" cy="52" r="2" fill="#fff"/><circle cx="22" cy="58" r="1.8" fill="#fff"/>' : ''
  return `<svg viewBox="0 0 100 100"><defs>${grad}</defs><g stroke="#1b1b1b" stroke-width="3.5" stroke-linejoin="round">
    <path d="M14 30 C30 22 44 30 52 44 C40 40 30 44 20 54 C24 44 18 38 14 30 Z" fill="url(#${g})"/>
    <path d="M10 48 C26 42 40 50 48 62 C36 58 26 62 18 72 C20 62 14 56 10 48 Z" fill="url(#${g})"/>
    <path d="M50 26 L66 22 L74 58 L88 64 C94 66 92 78 86 78 L52 78 C48 78 46 74 47 70 Z" fill="${t.rainbow ? '#ffffff' : c1}"/>
    <path d="M47 70 L88 70" stroke-width="3"/></g>${stars}</svg>`
}
const dartIcon = (id) => {
  const d = DARTS[id]
  return `<div class="dt-tile" style="--tile:${d.tile}">${ICONS.dart.replace('#ff4d4d', d.color)}</div>`
}

// --- Carousel (Armory, Skin Shop, Aura Shop) ----------------------------------------------------------
// ids in order, view.idx the centred one; small(id) / big(id) draw the side and centre cards.
function carousel(ids, view, small, big) {
  view.idx = Math.max(0, Math.min(ids.length - 1, view.idx ?? 0))
  const i = view.idx
  const prev = i > 0 ? `<div class="sk-side">${small(ids[i - 1], i - 1)}</div><button class="sk-arrow ol" data-do="go" data-id="${i - 1}">‹</button>` : '<div class="sk-side"></div><span class="sk-arrow ghost"></span>'
  const next = i < ids.length - 1 ? `<button class="sk-arrow ol" data-do="go" data-id="${i + 1}">›</button><div class="sk-side">${small(ids[i + 1], i + 1)}</div>` : '<span class="sk-arrow ghost"></span><div class="sk-side"></div>'
  const dots = ids.map((_, k) => `<button class="${k === i ? 'on' : ''}" data-do="go" data-id="${k}" aria-label="${k + 1}"></button>`).join('')
  return `<div class="sk">${prev}<div class="sk-mid">${big(ids[i], i)}</div>${next}</div><div class="sk-dots">${dots}</div>`
}
// The shared card frame: "i / n", picture, name, then whatever `rest` holds.
const card = (i, n, pic, name, rest = '', { big = false, go = null, top = '' } = {}) => {
  const tag = big ? 'div' : 'button'
  return `<${tag} class="sk-card ${big ? 'big' : 'small'}"${go != null && !big ? ` data-do="go" data-id="${go}"` : ''}><div class="sk-i ol">${i + 1} / ${n}</div><div class="sk-pic">${top ? `<div class="sk-top ol">${top}</div>` : ''}${pic}</div><div class="sk-n ol">${esc(name)}</div>${rest}</${tag}>`
}
const rows = (pairs) => `<div class="sk-rows">${pairs.map(([k, v]) => `<span>${k}</span><b class="ol">${esc(String(v).toUpperCase())}</b>`).join('')}</div>`
const btn = (label, doAttr, cls = 'green', off = false) => `<button class="sk-btn ${cls} ol ${off ? 'off' : ''}" ${doAttr}>${label}</button>`

// --- DARTS -----------------------------------------------------------------------------------------------
function dartCard(id) {
  const d = DARTS[id]
  const stock = dartStock(id)
  const owned = state.darts[id] ?? 0
  const eq = state.dartType === id
  const desc = d.mutation ? `Mutation ${MUTATIONS[d.mutation].name} x${MUTATIONS[d.mutation].mult} · ${d.sleep} s` : `Sleeps ${d.sleep} s${d.bonus ? ` · +${d.bonus} dmg` : ''}`
  const stockLine = stock > 0 ? `<div class="dt-stock ol">X${stock} IN STOCK</div>` : '<div class="dt-stock out ol">SOLD OUT</div>'
  const buy1 = `<button class="dt-b ${stock > 0 && can(d.price) ? 'green' : 'grey'} ol" data-do="buyDarts" data-id="${id}" data-n="1">+1 · ${money(d.price)}</button>`
  const buttons = d.kind === 'classic'
    ? `<div class="dt-row">${buy1}<button class="dt-b small ${stock >= 5 && can(d.price * 5) ? 'green' : 'grey'} ol" data-do="buyDarts" data-id="${id}" data-n="5">+5</button><button class="dt-b small gold ${stock > 0 && can(d.price) ? '' : 'off'} ol" data-do="buyDarts" data-id="${id}" data-n="all">ALL</button></div>`
    : `<div class="dt-col">${buy1}<button class="dt-b gold ${can(packPrice(id)) ? '' : 'off'} ol" data-do="buyPack" data-id="${id}">X${d.pack} · ${money(packPrice(id))}</button></div>`
  const use = owned > 0 ? (eq ? '<span class="dt-use on ol">EQUIPPED</span>' : `<button class="dt-use ol" data-do="useDart" data-id="${id}">USE</button>`) : ''
  return `<div class="dt-card${d.kind === 'special' ? ' special' : ''}${eq ? ' eq' : ''}">${dartIcon(id)}<div class="dt-n ol">${d.name.toUpperCase()}</div><div class="dt-d ol">${desc}</div>${stockLine}<div class="dt-own">Owned ${fmt(owned)} ${use}</div>${buttons}</div>`
}
function dartsBody() {
  const ids = Object.keys(DARTS)
  return `<div class="dt-h ol">CLASSIC DARTS</div><div class="dt-grid">${ids.filter((id) => DARTS[id].kind === 'classic').map(dartCard).join('')}</div>
    <div class="dt-h ol">SPECIAL DARTS</div><div class="dt-grid">${ids.filter((id) => DARTS[id].kind === 'special').map(dartCard).join('')}</div>`
}

// --- ARMORY -----------------------------------------------------------------------------------------------
const WEAPON_IDS = Object.keys(WEAPONS)
function weaponUnlocks(id) {
  const ws = worldsOf(id)
  return ws.length ? `UNLOCKS: ${ws.map((w) => WORLDS[w].name.toUpperCase()).join(' · ')}` : 'FAST FIRE · NO NEW WORLD'
}
// More than one rank above the best owned weapon: still a mystery (silhouette).
const hiddenWeapon = (id) => !state.weapons[id] && weaponRank(id) > bestWeaponRank() + 1
function weaponPic(id) {
  return `<img class="${hiddenWeapon(id) ? 'sil' : ''}" src="${weaponThumb(id, state.cosmetics.skin)}" alt="">`
}
function weaponAction(id) {
  const w = WEAPONS[id]
  if (state.weapons[id]) return state.weapon === id ? '<div class="sk-eq ol">EQUIPPED</div>' : btn('EQUIP', `data-do="equipWeapon" data-id="${id}"`, 'blue')
  return btn(money(w.price), `data-do="buyWeapon" data-id="${id}"`, can(w.price) ? 'green' : 'grey')
}
function armoryBody(view) {
  if (view.idx == null) view.idx = Math.max(0, WEAPON_IDS.indexOf(state.weapon))
  const n = WEAPON_IDS.length
  return carousel(
    WEAPON_IDS,
    view,
    (id, i) => card(i, n, weaponPic(id), WEAPONS[id].name, state.weapons[id] ? '<div class="sk-owned ol">OWNED</div>' : `<div class="sk-price ol">${money(WEAPONS[id].price)}</div>`, { go: i, top: `${WEAPONS[id].range} STUDS` }),
    (id, i) => {
      const w = WEAPONS[id]
      return card(i, n, weaponPic(id), w.name, `${rows([['Rank', `${w.range} studs`], ['Scope', w.scope], ['Spread', w.spread], ['Damage', `${w.damage} per dart`]])}${pill(weaponUnlocks(id))}${weaponAction(id)}`, { big: true, top: `${w.range} STUDS` })
    },
  )
}

// --- SKIN SHOP -----------------------------------------------------------------------------------------
export const SHOP_SKINS = Object.keys(SKINS).filter((id) => SKINS[id].unlock.type === 'shop')
function skinAction(id) {
  const s = SKINS[id]
  if (skinOwned(id)) return state.cosmetics.skin === id ? '<div class="sk-eq ol">EQUIPPED</div>' : btn('EQUIP', `data-do="equipSkin" data-id="${id}"`, 'blue')
  return btn(money(s.unlock.price), `data-do="buySkin" data-id="${id}"`, can(s.unlock.price) ? 'green' : 'grey')
}
function skinShopBody(view) {
  const n = SHOP_SKINS.length
  const pic = (id) => `<img src="${weaponThumb(state.weapon, id)}" alt="">`
  return carousel(
    SHOP_SKINS,
    view,
    (id, i) => card(i, n, pic(id), SKINS[id].name, skinOwned(id) ? '<div class="sk-owned ol">OWNED</div>' : `<div class="sk-price ol">${money(SKINS[id].unlock.price)}</div>`, { go: i }),
    (id, i) => {
      const s = SKINS[id]
      const r = rarityTag(s.rarity)
      return card(i, n, pic(id), s.name, `${rows([['Weapon', 'All your weapons'], ['Darts', s.dartName], ['Scope', s.scope.name]])}${pill(`${r.name.toUpperCase()} · SKIN SHOP`, r.card)}${skinAction(id)}`, { big: true })
    },
  )
}

// --- AURA SHOP -----------------------------------------------------------------------------------------
const AURA_IDS = Object.keys(COSMETICS.auras).filter((id) => id !== 'none')
const STYLE_NAME = { flames: 'Flames', storm: 'Flames + Lightning', sparkles: 'Sparkles', orbit: 'Orbit' }
function auraHow(id) {
  const a = COSMETICS.auras[id]
  if (a.get === 'mutation') return [`Index ${MUTATIONS[a.id].name}`, 'All']
  if (a.get === 'world') return [`${WORLDS[a.id].name} Index`, WORLDS[a.id].name]
  return ['Shop', 'All']
}
function auraAction(id) {
  const a = COSMETICS.auras[id]
  if (auraOwned(id)) return state.cosmetics.aura === id ? btn('UNEQUIP', 'data-do="equipAura" data-id="none"', 'grey') : btn('EQUIP', `data-do="equipAura" data-id="${id}"`, 'blue')
  if (a.get === 'shop') return btn(money(a.price), `data-do="buyAura" data-id="${id}"`, can(a.price) ? 'green' : 'grey')
  return ''
}
function auraPill(id) {
  const a = COSMETICS.auras[id]
  const [have, need] = auraProgress(id)
  if (a.get === 'mutation') return pill(`${have} / ${need} PETS ${MUTATIONS[a.id].name.toUpperCase()}`)
  if (a.get === 'world') return pill(have ? 'INDEX CLAIMED' : `CLAIM THE ${WORLDS[a.id].name.toUpperCase()} INDEX`)
  return pill(`PRICE: ${money(a.price)}`)
}
function auraShopBody(view) {
  if (view.idx == null) view.idx = Math.max(0, AURA_IDS.indexOf(state.cosmetics.aura))
  const n = AURA_IDS.length
  return carousel(
    AURA_IDS,
    view,
    (id, i) => card(i, n, auraIcon(id, !auraOwned(id) && COSMETICS.auras[id].get !== 'shop'), COSMETICS.auras[id].name, auraOwned(id) ? '<div class="sk-owned ol">OWNED</div>' : COSMETICS.auras[id].get === 'shop' ? `<div class="sk-price ol">${money(COSMETICS.auras[id].price)}</div>` : '', { go: i }),
    (id, i) => {
      const a = COSMETICS.auras[id]
      const [how, world] = auraHow(id)
      const eq = state.cosmetics.aura === id ? '<div class="sk-eq ol">EQUIPPED</div>' : ''
      return card(i, n, auraIcon(id, !auraOwned(id) && a.get !== 'shop'), a.name, `${rows([['Style', STYLE_NAME[a.style]], ['How to get', how], ['World', world]])}${auraPill(id)}${eq}${auraAction(id)}`, { big: true })
    },
  )
}

// --- TRAIL SHOP ----------------------------------------------------------------------------------------
function trailShopBody() {
  const ids = Object.keys(COSMETICS.trails).filter((id) => id !== 'none')
  return `<div class="tr-row">${ids.map((id) => {
    const t = COSMETICS.trails[id]
    const r = rarityTag(t.rarity)
    const owned = state.cosmetics.trails[id]
    const eq = state.cosmetics.trail === id
    const action = owned
      ? eq ? `<button class="tr-b grey ol" data-do="equipTrail" data-id="none">UNEQUIP</button>` : `<button class="tr-b blue ol" data-do="equipTrail" data-id="${id}">EQUIP</button>`
      : `<button class="tr-b ${can(t.price) ? 'green' : 'grey'} ol" data-do="buyTrail" data-id="${id}">${money(t.price)}</button>`
    return `<div class="tr-card r-${t.rarity}${eq ? ' eq' : ''}" style="--rc:${r.card}"><div class="tr-n ol">${t.name.toUpperCase()}</div><div class="tr-r ol" style="color:${r.color}">${r.name.toUpperCase()}</div><div class="tr-ic">${trailIcon(id)}</div><div class="tr-sp ol">X${t.speed} SPEED</div>${action}</div>`
  }).join('')}</div><div class="pn-sub" style="padding:10px 0 0;text-align:center">A trail multiplies the speed the treadmill gives you (one trail at a time).</div>`
}

// --- Hooks for panels.js -----------------------------------------------------------------------------------
export function body(id, view) {
  switch (id) {
    case 'darts': return dartsBody()
    case 'armory': return armoryBody(view)
    case 'skinShop': return skinShopBody(view)
    case 'auraShop': return auraShopBody(view)
    case 'trailShop': return trailShopBody()
  }
  return ''
}
// Extra title-bar items: the wallet, and for DARTS the restock timer + the Big Quiver.
export function header(id) {
  const wallet = `<span class="sh-wallet ol">${ICONS.cash}<b>${fmt(state.money)} $</b></span>`
  if (id !== 'darts') return wallet
  const q = state.dartShop.quiver
  return `<span class="sh-restock ol">NEXT RESTOCK IN <b>${fmtClock(restockLeft()).replace(/^00:/, '')}</b></span>${wallet}<button class="sh-quiver ol ${q ? 'owned' : can(DART_SHOP.quiver.price) ? '' : 'off'}" ${q ? '' : 'data-do="quiver"'}>${ICONS.dart.replace('#ff4d4d', '#5fc8ff')}<span>BIG QUIVER x${DART_SHOP.quiver.mult}<i>${q ? 'OWNED' : money(DART_SHOP.quiver.price)}</i></span></button>`
}
export function footer(id) {
  if (id !== 'darts') return ''
  const free = freeRestockLeft()
  const all = allStockPrice()
  return `<div class="pn-foot dt-foot"><button class="fbtn green ol ${free > 0 ? 'off' : ''}" data-do="freeRestock" data-free>${free > 0 ? `FREE RESTOCK ${fmtClock(free).replace(/^00:/, '')}` : 'FREE RESTOCK'}</button><button class="fbtn gold ol ${can(instantRestockPrice()) ? '' : 'off'}" data-do="instantRestock">INSTANT RESTOCK · ${money(instantRestockPrice())}</button><button class="fbtn green ol ${all > 0 && can(all) ? '' : 'off'}" data-do="allStock">${all > 0 ? `ALL STOCK · ${money(all)}` : 'ALL STOCK · SOLD OUT'}</button></div>`
}

function deny(b, msg) {
  sfx.deny()
  b.closest('.dt-card, .sk-card, .tr-card, .pn-foot, .pn-head')?.classList.add('shake')
  if (msg) toast(msg, { error: true })
  return true
}
// Returns true when handled (panels.js re-renders), or { open } to switch window.
export function act(b, view) {
  const id = b.dataset.id
  switch (b.dataset.do) {
    case 'go':
      view.idx = Number(id)
      return true
    case 'buyDarts': {
      const n = b.dataset.n === 'all' ? 'all' : Number(b.dataset.n)
      if (dartStock(id) <= 0) return deny(b, 'Sold out until the next restock')
      const k = buyDarts(id, n)
      if (!k) return deny(b, 'Not enough money')
      sfx.purchase()
      toast(`+${k} ${DARTS[id].name} dart${k > 1 ? 's' : ''}`)
      return true
    }
    case 'buyPack':
      if (!buyDartPack(id)) return deny(b, 'Not enough money')
      sfx.purchase()
      toast(`+${DARTS[id].pack} ${DARTS[id].name} darts`)
      return true
    case 'useDart':
      state.dartType = id
      sfx.equip()
      return true
    case 'quiver':
      if (!buyQuiver()) return deny(b, 'Not enough money')
      sfx.gift()
      toast(`Big Quiver! Every dart stock x${DART_SHOP.quiver.mult}`, { check: true })
      return true
    case 'freeRestock':
      if (!freeRestock()) return deny(b, 'The free restock is not ready yet')
      sfx.gift()
      toast('The Dart Shop restocked!', { check: true })
      return true
    case 'instantRestock':
      if (!instantRestock()) return deny(b, 'Not enough money')
      sfx.purchase()
      toast('The Dart Shop restocked!', { check: true })
      return true
    case 'allStock':
      if (!(allStockPrice() > 0)) return deny(b, 'Everything is sold out')
      if (!buyAllStock()) return deny(b, 'Not enough money')
      sfx.purchase()
      toast('Bought the whole stock!', { check: true })
      return true
    case 'buyWeapon': {
      const opened = buyWeapon(id)
      if (!opened) return deny(b, 'Not enough money')
      sfx.purchase()
      toast(opened.length ? `${WEAPONS[id].name}! ${opened.map((w) => WORLDS[w].name).join(' & ')} unlocked at the portal` : `${WEAPONS[id].name} equipped!`, { check: true, seconds: 4 })
      return true
    }
    case 'equipWeapon':
      equipWeapon(id)
      sfx.equip()
      return true
    case 'buySkin':
      if (!buySkin(id)) return deny(b, 'Not enough money')
      sfx.purchase()
      toast(`${SKINS[id].name} unlocked and equipped!`, { check: true })
      return true
    case 'equipSkin':
      if (!equipSkin(id)) return deny(b)
      sfx.equip()
      return true
    case 'buyAura':
      if (!buyAura(id)) return deny(b, 'Not enough money')
      sfx.purchase()
      toast(`${COSMETICS.auras[id].name} equipped!`, { check: true })
      return true
    case 'equipAura':
      if (id === 'none') {
        state.cosmetics.aura = 'none'
        sfx.equip()
        return true
      }
      if (!equipAura(id)) return deny(b)
      sfx.equip()
      return true
    case 'buyTrail':
      if (!buyTrail(id)) return deny(b, 'Not enough money')
      sfx.purchase()
      toast(`${COSMETICS.trails[id].name}: x${COSMETICS.trails[id].speed} speed!`, { check: true })
      return true
    case 'equipTrail':
      equipTrail(id)
      sfx.equip()
      return true
  }
  return false
}

// Once a second while a shop is open: the restock / free-restock timers and the wallet.
export function tick(root, id) {
  const w = root.querySelector('.sh-wallet b')
  if (w) w.textContent = `${fmt(state.money)} $`
  if (id !== 'darts') return
  const r = root.querySelector('.sh-restock b')
  if (r) r.textContent = fmtClock(restockLeft()).replace(/^00:/, '')
  const f = root.querySelector('[data-free]')
  if (f) {
    const left = freeRestockLeft()
    f.textContent = left > 0 ? `FREE RESTOCK ${fmtClock(left).replace(/^00:/, '')}` : 'FREE RESTOCK'
    f.classList.toggle('off', left > 0)
  }
}

