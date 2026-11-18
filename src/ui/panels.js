// Menu windows. One modal at a time. Two tabbed groups: SHOP (Darts / Armory / Boosts) and
// STYLE (Skins / Skin Shop / Auras / Trails); the shop windows themselves live in shops.js.
// Also: Animal Index (worlds / mutations / event), My Zoo (active + storage), Battle Pass,
// Free Gift, Playtime Rewards, Settings, Worlds (the portal).
// Every price is in $ (money): nothing is sold for a premium currency.
import './panels.css'
import './windows.css'
import {
  AD_REWARDS, ANIMALS, BATTLE_PASS, BOOSTS, DARTS, GAME_SETTINGS, GIFT, INDEX_ANIMALS, MUTATIONS, MUTATION_MILESTONES, PEN, PLAYTIME,
  RARITIES, SEASON, SKINS, WEAPONS, WORLDS, seasonAnimals, worldAnimals,
} from '../config.js'
import { ICONS } from './icons.js'
import { animalThumb, weaponThumb } from './thumbs.js'
import {
  activateAnimal, activeSlots, addMoney, boostLeft, boostPrice, bpLevel, bpReward, buyBoost, buySkin, caughtWith, claimMutation, claimSeason, claimWorld,
  emit, equipBest, equipSkin, fmt, fmtClock, fmtTime, incomePerSec, indexUnlocked, isDiscovered, mutationFound, penUpgradePrice, save, seasonFound,
  restockDarts, sellAllStorage, sellAnimal, sellPrice, skinOwned, skinProgress, state, storeAnimal, travel, upgradePen, worldFound, worldUnlocked,
} from '../game/state.js'
import * as playtime from '../game/playtime.js'
import * as ads from '../game/ads.js'
import { sfx } from '../audio/index.js'
import { toast } from './hud.js'
import * as shops from './shops.js'

const wrap = document.createElement('div')
wrap.className = 'pn-wrap hide'
document.body.appendChild(wrap)
wrap.addEventListener('pointerdown', (e) => {
  if (e.target === wrap) closePanel()
  e.stopPropagation()
})
wrap.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true })

let current = null // { id, tab, ... per-window view state }
const listeners = new Set()
export const onPanelChange = (fn) => listeners.add(fn)
export const isPanelOpen = () => !!current
export const currentPanel = () => current?.id ?? null

// size: '' | 'wide' | 'narrow'. tabs: [key, label, color?]. note: right side of the title bar.
// group: windows sharing a row of tabs (GROUPS) that switch between them. wallet: show $.
const PANELS = {
  darts: { title: 'DARTS', icon: ICONS.dart, accent: '#6a4ac0', size: 'wide', group: 'shop', wallet: true },
  armory: { title: 'ARMORY', icon: ICONS.rifle, accent: '#f2b33a', size: 'wide', group: 'shop', wallet: true },
  boosts: { title: 'BOOSTS', icon: ICONS.clover, accent: '#3fc24a', group: 'shop', wallet: true },
  skins: { title: 'SKIN', icon: ICONS.brush, accent: '#a35be8', size: 'wide', group: 'style' },
  skinShop: { title: 'SKIN SHOP', icon: ICONS.brush, accent: '#a35be8', size: 'wide', group: 'style', wallet: true },
  auraShop: { title: 'AURA SHOP', icon: ICONS.aura, accent: '#f2b33a', size: 'wide', group: 'style', wallet: true },
  trailShop: { title: 'TRAIL SHOP', icon: ICONS.trail, accent: '#4fb3ff', size: 'wide', group: 'style', wallet: true },
  index: { title: 'ANIMAL INDEX', icon: ICONS.book, accent: '#4fb3ff', size: 'wide', tabs: [['worlds', 'Worlds', '#f2b33a'], ['mutations', 'Mutations', '#a35be8'], ['event', 'Event', '#f07a2a']], bigTabs: true },
  zoo: { title: 'MY ZOO', icon: ICONS.paw, accent: '#3fc24a', size: 'wide', note: 'Only active pets earn money' },
  bp: { title: 'BATTLE PASS', icon: ICONS.star, accent: '#f2b33a' },
  gift: { title: 'FREE GIFT', icon: ICONS.gift, accent: '#2f86ff' },
  playtime: { title: 'PLAYTIME REWARDS', icon: ICONS.gift, accent: '#4fb3ff', size: 'wide' },
  settings: { title: 'SETTINGS', icon: ICONS.gear, accent: '#c9ced6', size: 'narrow' },
  worlds: { title: 'WORLDS', icon: ICONS.portal, accent: '#2f86ff' },
}

const GROUPS = {
  shop: [['darts', 'Darts'], ['armory', 'Armory'], ['boosts', 'Boosts']],
  style: [['skins', 'Skins'], ['skinShop', 'Skin Shop'], ['auraShop', 'Auras'], ['trailShop', 'Trails']],
}
// Old ids: 'shop' (+ tab) and 'skins' (+ 'trails' | 'auras').
const ALIAS = { 'shop:boosts': 'boosts', 'shop:weapons': 'armory', shop: 'darts', 'skins:trails': 'trailShop', 'skins:auras': 'auraShop' }

export function openPanel(id, tab = null) {
  id = ALIAS[`${id}:${tab}`] ?? ALIAS[id] ?? id
  const p = PANELS[id]
  if (!p) return
  const first = !current
  current = { id, tab: p.tabs?.[0][0] ?? null, world: state.world, sel: null, mut: 'shiny', skinIdx: null, confirm: null, view: {} }
  render()
  wrap.classList.remove('hide')
  if (first) sfx.windowOpen()
  for (const fn of listeners) fn(current)
}
export function closePanel() {
  if (!current) return
  current = null
  wrap.classList.add('hide')
  wrap.innerHTML = ''
  sfx.windowClose()
  for (const fn of listeners) fn(null)
}
export function refreshPanel() {
  if (current) render(true)
}

function render(keepScroll = false) {
  const p = PANELS[current.id]
  const oldBody = wrap.querySelector('.pn-body')
  const scroll = keepScroll && oldBody ? oldBody.scrollTop : 0
  const tabs = p.tabs
    ? `<div class="pn-tabs${p.bigTabs ? ' big' : ''}">${p.tabs.map(([k, n, c]) => `<button class="${k === current.tab ? 'on' : ''}" data-tab="${k}"${c ? ` style="--tc:${c}"` : ''}>${n}</button>`).join('')}</div>`
    : p.group
      ? `<div class="pn-tabs grp">${GROUPS[p.group].map(([k, n]) => `<button class="${k === current.id ? 'on' : ''}" data-panel="${k}">${n}</button>`).join('')}</div>`
      : ''
  const extra = p.wallet ? `<span class="sh-extra">${shops.header(current.id)}</span>` : ''
  wrap.innerHTML = `<div class="pn ${p.size ?? ''} pn-${current.id}" style="--accent:${p.accent}">
    <div class="pn-head ol">${p.icon}<span class="t">${p.title}</span>${extra}${p.note ? `<span class="note">${p.note}</span>` : ''}<button class="pn-close" data-a="close">${ICONS.close}</button></div>
    ${tabs}<div class="pn-body">${body()}</div>${footer()}</div>`
  if (keepScroll) wrap.querySelector('.pn').style.animation = 'none'
  wrap.querySelector('.pn-body').scrollTop = scroll
  wrap.querySelector('[data-a="close"]').addEventListener('click', closePanel)
  for (const b of wrap.querySelectorAll('[data-tab]')) b.addEventListener('click', () => {
    current.tab = b.dataset.tab
    current.sel = null
    render()
  })
  for (const b of wrap.querySelectorAll('[data-panel]')) b.addEventListener('click', () => {
    current = { ...current, id: b.dataset.panel, view: {}, sel: null }
    render()
    for (const fn of listeners) fn(current)
  })
  for (const b of wrap.querySelectorAll('[data-do]')) b.addEventListener('click', () => act(b))
}

const price = (n) => (n > 0 ? `$${fmt(n)}` : 'FREE')
const can = (n) => state.money >= n
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

function body() {
  switch (current.id) {
    case 'darts':
    case 'armory':
    case 'skinShop':
    case 'auraShop':
    case 'trailShop':
      return shops.body(current.id, current.view)
    case 'boosts': return shopBoosts()
    case 'index': return current.tab === 'mutations' ? indexMutations() : current.tab === 'event' ? indexEvent() : indexWorlds()
    case 'zoo': return zooBody()
    case 'skins': return skinCarousel()
    case 'bp': return bpBody()
    case 'gift': return giftBody()
    case 'playtime': return playtimeBody()
    case 'settings': return settingsBody()
    case 'worlds': return worldsBody()
  }
  return ''
}
function footer() {
  if (current.id === 'darts') return shops.footer('darts')
  if (current.id !== 'zoo') return ''
  const pay = state.storage.reduce((s, a) => s + sellPrice(a), 0)
  const confirm = current.confirm === 'sellAll'
  return `<div class="pn-foot"><button class="fbtn gold ol" data-do="equipBest">EQUIP BEST</button><button class="fbtn ${state.storage.length ? (confirm ? 'red' : 'grey') : 'grey off'} ol" data-do="sellAll">${confirm ? `CONFIRM: SELL FOR $${fmt(pay)}` : 'SELL ALL STORAGE'}</button></div>`
}

// --- Shop ------------------------------------------------------------------------------------------
function shopBoosts() {
  return `<div class="pn-grid">${Object.entries(BOOSTS)
    .map(([id, b]) => {
      const left = boostLeft(id)
      return `<div class="card"><div class="ic">${id === 'luck' ? ICONS.clover : ICONS.cash}</div><div class="nm">${b.name}</div><div class="ds">${b.seconds / 60} minutes${left > 0 ? `<br>Active: ${fmtTime(left)}` : ''}</div><button class="btn ${can(boostPrice(id)) ? '' : 'off'}" data-do="buyBoost" data-id="${id}">${price(boostPrice(id))}</button></div>`
    })
    .join('')}</div>${adCards()}<div class="pn-sub" style="padding:12px 0 0">Luck makes rare animals and mutations (Shiny, Golden, Diamond, Rainbow, Void) more likely. Stacks with Lucky Hour.</div>`
}
// "Watch an ad" rewards (Bloxity rewarded ads): shown only where ads are available.
function adCards() {
  if (!ads.adsOffered()) return ''
  const cards = ads
    .adList()
    .map((a) => {
      const wait = ads.adWait(a.id)
      return `<div class="card"><div class="ic">${a.boost ? (a.boost.id === 'luck' ? ICONS.clover : ICONS.cash) : ICONS.dart}</div><div class="nm">${a.name}</div><div class="ds">${a.desc}</div><button class="btn ${wait ? 'off' : ''}" data-do="watchAd" data-id="${a.id}">${wait ? `${fmtTime(wait)}` : 'WATCH AD'}</button></div>`
    })
    .join('')
  return `<div class="pn-sub" style="padding:14px 0 6px;font-weight:700">FREE: WATCH AN AD</div><div class="pn-grid">${cards}</div>`
}

// --- Animal Index -----------------------------------------------------------------------------------
const WORLD_ART = {
  meadow: { emoji: '🌳', sky: '#7fd4ff', ground: '#4cd33b' },
  marsh: { emoji: '🪷', sky: '#9fe0d8', ground: '#2f9a7a' },
  forest: { emoji: '🌲', sky: '#a8e0a0', ground: '#2f7a2a' },
  mountain: { emoji: '🏔️', sky: '#cfe4ff', ground: '#e8f2ff' },
  volcano: { emoji: '🌋', sky: '#ffb070', ground: '#5a2a1a' },
  halloween: { emoji: '🏚️', sky: '#5a2a8a', ground: '#2a1a3a' },
}
const WORLD_IDS = Object.keys(WORLDS)
function worldPic(id, name, nav = '') {
  const a = WORLD_ART[id]
  return `<div class="ix-pic" style="--sky:${a.sky};--gr:${a.ground}"><div class="ix-pn ol">${name.toUpperCase()}</div><div class="ix-em">${a.emoji}</div>${nav}</div>`
}
const thumb = (species, mutation, known) => `<img class="${known ? '' : 'sil'}" src="${animalThumb(species, mutation)}" alt="">`
// One animal card in a world / event grid (rarity colour, ??? until discovered).
function animalCard(id) {
  const d = ANIMALS[id]
  const known = isDiscovered(id)
  return `<button class="ix-card${current.sel === id ? ' sel' : ''}" style="--rc:${RARITIES[d.rarity].card}" data-do="ixSel" data-id="${id}"><span class="ix-n ol">${known ? esc(d.name) : '???'}</span>${thumb(id, null, known)}</button>`
}
// The right-hand detail panel: the selected animal + which mutations were caught (dots).
function detail(id) {
  const d = ANIMALS[id]
  const known = isDiscovered(id)
  const r = RARITIES[d.rarity]
  const dots = ['normal', ...Object.keys(MUTATIONS)]
    .map((m) => `<i class="${caughtWith(id, m === 'normal' ? null : m) ? 'on' : ''}" style="--mc:${m === 'normal' ? '#e8e8e8' : MUTATIONS[m].color}" title="${m === 'normal' ? 'Normal' : MUTATIONS[m].name}"></i>`)
    .join('')
  const inc = d.world ? `${fmt(d.income[0])}–${fmt(d.income[1])} $/s` : 'Event'
  return `<div class="ix-detail">${thumb(id, null, known)}<div class="ix-dn ol">${known ? esc(d.name) : '???'}</div><div class="ix-dr ol" style="color:${r.color}">${r.name}</div><div class="ix-di ol">${known ? inc : '???'}</div><div class="ix-dots">${dots}</div><div class="ix-dh">1 in ${fmt(d.odds)} · ${d.hp} hit${d.hp > 1 ? 's' : ''}${known ? ` · caught ${state.discovered[id]}` : ''}</div></div>`
}
function rewardBox(items, claimable, claimed, doAttr) {
  const btn = claimed ? `<button class="claim off ol">CLAIMED</button>` : `<button class="claim ${claimable ? '' : 'off'} ol" ${doAttr}>CLAIM!</button>`
  return `<div class="ix-rew"><div class="ix-rh ol">REWARDS:</div><div class="ix-ri">${items.join('')}</div>${btn}</div>`
}
const rewItem = (icon, text) => `<div class="ri">${icon}<b class="ol">${text}</b></div>`

// The worlds strip: every area in portal order; locked ones sit behind the green barrier.
function worldTabs(sel) {
  return `<div class="ix-worlds">${WORLD_IDS.map((id) => {
    const open = worldUnlocked(id)
    const a = WORLD_ART[id]
    return `<button class="ix-wt${id === sel ? ' on' : ''}${open ? '' : ' locked'}" style="--sky:${a.sky};--gr:${a.ground}" data-do="ixWorld" data-id="${id}"><span class="ix-we">${a.emoji}</span><b class="ol">${WORLDS[id].name.toUpperCase()}</b>${open ? '' : `<i class="ix-wl">${ICONS.lock}</i>`}</button>`
  }).join('')}</div>`
}
// The green barrier over a locked world: which gun opens it, with a way to the Armory.
function worldBarrier(id) {
  const gun = WORLDS[id].weapon
  const g = WEAPONS[gun]
  const prev = WORLD_IDS[WORLD_IDS.indexOf(id) - 1]
  return `<div class="ix-barrier"><div class="ixb-in">
    <div class="ixb-lock">${ICONS.lock}</div>
    <div class="ixb-t ol">BLOCKED!</div>
    <img class="ixb-gun" src="${weaponThumb(gun, state.cosmetics.skin)}" alt="">
    <div class="ixb-s ol">Buy the <em>${esc(g.name)}</em> to break the barrier${prev ? ` from ${WORLDS[prev].name}` : ''} and reach <em>${WORLDS[id].name}</em></div>
    <button class="ixb-btn ol ${can(g.price) ? '' : 'poor'}" data-do="toArmory" data-id="${gun}">ARMORY · ${price(g.price)}</button>
  </div></div>`
}

function indexWorlds() {
  const w = current.world
  const ids = worldAnimals(w)
  if (!ids.includes(current.sel)) current.sel = ids[0]
  const i = WORLD_IDS.indexOf(w)
  const nav = `${i > 0 ? `<button class="ix-nav l" data-do="ixWorld" data-id="${WORLD_IDS[i - 1]}">‹</button>` : ''}${i < WORLD_IDS.length - 1 ? `<button class="ix-nav r" data-do="ixWorld" data-id="${WORLD_IDS[i + 1]}">›</button>` : ''}`
  const found = worldFound(w)
  const rw = WORLDS[w].reward
  const open = worldUnlocked(w)
  return `${worldTabs(w)}<div class="ix${open ? '' : ' locked'}">
    ${worldPic(w, WORLDS[w].name, nav)}
    <div class="ix-mid"><div class="ix-grid">${ids.map(animalCard).join('')}</div>${progress(found, 6)}${open ? '' : worldBarrier(w)}</div>
    <div class="ix-side">${detail(current.sel)}${rewardBox([rewItem(ICONS.cash, `${fmt(rw.money)} $`), rewItem(ICONS.shoe, `+${fmt(rw.steps)}`)], found >= 6, state.indexClaimed.includes(w), `data-do="claimWorld" data-id="${w}"`)}</div>
  </div>${bottomBar(`UNLOCKED: ${indexUnlocked()}/${INDEX_ANIMALS.length} · AREAS ${WORLD_IDS.filter(worldUnlocked).length}/${WORLD_IDS.length}`)}`
}
const progress = (n, of) => `<div class="ix-prog"><i style="width:${(n / of) * 100}%"></i><b class="ol">${n}/${of}</b></div>`
const bottomBar = (text) => `<div class="ix-bottom">${ICONS.book}<b class="ol">${text}</b></div>`

function indexMutations() {
  const m = current.mut
  const M = MUTATIONS[m]
  const n = mutationFound(m)
  const sub = Object.entries(MUTATIONS).map(([id, x]) => `<button class="${id === m ? 'on' : ''}" style="--tc:${x.card}" data-do="ixMut" data-id="${id}">${x.name}</button>`).join('')
  const claimed = state.mutClaimed[m] ?? []
  const marks = MUTATION_MILESTONES.map((ms) => {
    const label = ms.aura ? `Aura ${M.name}` : ms.money ? `$${fmt(Math.max(ms.money, Math.round(incomePerSec() * ms.perIncome)))}` : `+${fmt(ms.steps)} Speed`
    const done = claimed.includes(ms.n)
    const ready = n >= ms.n && !done
    return `<div class="mu-ms" style="left:${(ms.n / INDEX_ANIMALS.length) * 100}%"><b class="ol">${ms.n}</b><span class="ol">${label}</span>${done ? '<em class="ol">✓</em>' : ready ? `<button class="mini-claim ol" data-do="claimMut" data-id="${m}" data-n="${ms.n}">CLAIM</button>` : ''}</div>`
  }).join('')
  const grid = INDEX_ANIMALS.map((id) => {
    const got = caughtWith(id, m)
    return `<div class="mu-card" style="--mc:${M.card}"><span class="ol">${got ? esc(ANIMALS[id].name) : '???'}</span>${thumb(id, got ? m : null, got)}</div>`
  }).join('')
  return `<div class="pn-tabs sub">${sub}</div><div class="mu-head"><div class="mu-bar"><i style="width:${(n / INDEX_ANIMALS.length) * 100}%;background:${M.color}"></i><b class="ol">${n} / ${INDEX_ANIMALS.length}</b></div><div class="mu-marks">${marks}</div></div><div class="mu-grid">${grid}</div>`
}

function indexEvent() {
  const ids = seasonAnimals()
  if (!ids.includes(current.sel)) current.sel = ids[0]
  const found = seasonFound()
  const skin = SEASON.reward.skin
  const item = `<div class="ri wide"><img src="${weaponThumb(state.weapon, skin)}" alt=""><b class="ol">SKIN ${SKINS[skin].name.toUpperCase()}</b></div>`
  return `<div class="ix">
    ${worldPic(SEASON.id, SEASON.name)}
    <div class="ix-mid"><div class="ix-grid scroll">${ids.map(animalCard).join('')}</div>${progress(found, ids.length)}</div>
    <div class="ix-side">${detail(current.sel)}${rewardBox([item], found >= ids.length, state.seasonClaimed.includes(SEASON.id), 'data-do="claimSeason"')}</div>
  </div>${bottomBar(`${SEASON.name.toUpperCase()} EVENT: ${found}/${ids.length}`)}`
}

// --- My Zoo -----------------------------------------------------------------------------------------
function zooCard(a, active) {
  const d = ANIMALS[a.species]
  const r = RARITIES[d.rarity]
  const mut = a.mutation ? MUTATIONS[a.mutation] : null
  return `<div class="zoo-card${active ? ' act' : ''}" style="--rc:${r.card}"><img src="${animalThumb(a.species, a.mutation)}" alt=""><div class="zn ol"${mut ? ` style="color:${mut.color}"` : ''}>${mut ? mut.name + ' ' : ''}${esc(d.name)}</div><div class="zr ol">${r.name} · ${fmt(a.income)} $/s</div>
    ${active ? `<button class="zb blue ol" data-do="store" data-id="${a.id}">STORE</button>` : `<button class="zb green ol ${state.pen.animals.length < activeSlots() ? '' : 'off'}" data-do="activate" data-id="${a.id}">EQUIP</button>`}
    <button class="zb red ol" data-do="sell" data-id="${a.id}">SELL $${fmt(sellPrice(a))}</button></div>`
}
function zooBody() {
  const up = penUpgradePrice()
  const act = [...state.pen.animals].sort((a, b) => b.income - a.income)
  const sto = [...state.storage].sort((a, b) => b.income - a.income)
  return `<div class="zoo-top"><b class="ol">ACTIVE ${state.pen.animals.length} / ${activeSlots()}</b>${up != null ? `<button class="zoo-up ol ${can(up) ? '' : 'off'}" data-do="upgradePen">+1 ACTIVE · ${fmt(up)} $</button>` : '<span class="zoo-up off ol">MAX SLOTS</span>'}<b class="ol">STORAGE · ${state.storage.length}/${PEN.storage}</b><span class="zoo-rate ol">+${fmt(incomePerSec())} $/s</span></div>
    <div class="zoo-grid">${act.map((a) => zooCard(a, true)).join('') || '<div class="zoo-empty">No animals yet! Step on the yellow band, dart an animal in the lane, then carry it to your pen before it wakes up.</div>'}</div>
    ${sto.length ? `<div class="zoo-h ol">STORAGE</div><div class="zoo-grid">${sto.map((a) => zooCard(a, false)).join('')}</div>` : ''}`
}

// --- Skin carousel + trails / auras -------------------------------------------------------------
const SKIN_IDS = Object.keys(SKINS)
function lockText(id) {
  const u = SKINS[id].unlock
  const [have, need] = skinProgress(id)
  switch (u.type) {
    case 'shop': return 'LOCKED: SKIN SHOP'
    case 'season': return `LOCKED: ${SEASON.name.toUpperCase()} INDEX ${seasonFound()}/${seasonAnimals().length}`
    case 'captures': return `LOCKED: CATCH ${need} ANIMALS (${have}/${need})`
    case 'mutation': return `LOCKED: ${need} ${MUTATIONS[u.id].name.toUpperCase()} IN INDEX (${have}/${need})`
    case 'world': return `LOCKED: ${WORLDS[u.id].name.toUpperCase()} INDEX ${have}/6`
    case 'playtime': return `LOCKED: PLAY ${need} HOURS (${have}/${need})`
  }
  return 'LOCKED'
}
function skinCard(id, big) {
  const s = SKINS[id]
  const i = SKIN_IDS.indexOf(id)
  const owned = skinOwned(id)
  const img = `<img class="${owned ? '' : 'sil'}" src="${weaponThumb(state.weapon, id)}" alt="">`
  if (!big) return `<button class="sk-card small" data-do="skinGo" data-id="${i}"><div class="sk-i ol">${i + 1} / ${SKIN_IDS.length}</div><div class="sk-pic">${img}</div><div class="sk-n ol">${esc(s.name)}</div></button>`
  const eq = state.cosmetics.skin === id
  let btn
  if (owned) btn = eq ? `<div class="sk-eq ol">EQUIPPED</div>` : `<button class="sk-btn green ol" data-do="equipSkin" data-id="${id}">EQUIP</button>`
  else if (s.unlock.type === 'shop') btn = `<div class="sk-lock ol">${lockText(id)}</div><button class="sk-btn green ol" data-do="toSkinShop" data-id="${id}">GET IT · ${fmt(s.unlock.price)} $</button>`
  else btn = `<div class="sk-lock ol">${lockText(id)}</div>`
  return `<div class="sk-card big"><div class="sk-i ol">${i + 1} / ${SKIN_IDS.length}</div><div class="sk-pic">${img}</div><div class="sk-n ol">${esc(s.name)}</div>
    <div class="sk-rows"><span>Weapon</span><b class="ol">${id === 'classic' ? 'EQUIPPED WEAPON' : 'ALL YOUR WEAPONS'}</b><span>Darts</span><b class="ol">${esc(s.dartName.toUpperCase())}</b><span>Scope</span><b class="ol">${esc(s.scope.name.toUpperCase())}</b></div>
    ${id === 'classic' ? '<div class="sk-def ol">DEFAULT LOOK</div>' : ''}${btn}</div>`
}
function skinCarousel() {
  if (current.skinIdx == null) current.skinIdx = Math.max(0, SKIN_IDS.indexOf(state.cosmetics.skin))
  const i = current.skinIdx
  const prev = i > 0 ? `<div class="sk-side">${skinCard(SKIN_IDS[i - 1], false)}</div><button class="sk-arrow ol" data-do="skinGo" data-id="${i - 1}">‹</button>` : '<div class="sk-side"></div><span class="sk-arrow ghost"></span>'
  const next = i < SKIN_IDS.length - 1 ? `<button class="sk-arrow ol" data-do="skinGo" data-id="${i + 1}">›</button><div class="sk-side">${skinCard(SKIN_IDS[i + 1], false)}</div>` : '<span class="sk-arrow ghost"></span><div class="sk-side"></div>'
  const dots = SKIN_IDS.map((_, k) => `<button class="${k === i ? 'on' : ''}" data-do="skinGo" data-id="${k}" aria-label="Skin ${k + 1}"></button>`).join('')
  return `<div class="sk">${prev}<div class="sk-mid">${skinCard(SKIN_IDS[i], true)}</div>${next}</div><div class="sk-dots">${dots}</div>`
}

// --- Battle pass / gift ------------------------------------------------------------------------------
function bpBody() {
  const L = bpLevel()
  const cards = []
  for (let i = 1; i <= BATTLE_PASS.levels; i++) {
    const r = bpReward(i)
    const claimed = state.bp.claimed.includes(i)
    const ready = L >= i && !claimed
    const label = r.type === 'money' ? `$${fmt(r.n)}` : `${r.n} ${DARTS[r.dart].name}`
    cards.push(`<div class="card ${L >= i ? '' : 'locked'}"><span class="tag">Lvl ${i}</span><div class="ic" style="height:60px">${r.type === 'money' ? ICONS.cash : ICONS.dart}</div><div class="ds">${label}</div>${claimed ? '<button class="btn off">CLAIMED</button>' : ready ? `<button class="btn" data-do="claimBp" data-id="${i}">CLAIM</button>` : '<button class="btn off">LOCKED</button>'}</div>`)
  }
  return `<div class="pn-sub" style="padding:0 0 10px">Level <b>${L}</b> · ${state.bp.xp % BATTLE_PASS.xpPerLevel} / ${BATTLE_PASS.xpPerLevel} XP. Earn XP by catching animals (rarer = more) and playing (+${BATTLE_PASS.playXp} every ${BATTLE_PASS.playEvery / 60} min). All rewards are free.</div><div class="bp-track">${cards.join('')}</div>`
}

export function giftValue() {
  return Math.max(GIFT.base, Math.round(incomePerSec() * GIFT.perIncome))
}
function giftBody() {
  const left = (state.giftAt - Date.now()) / 1000
  return `<div class="pn-big">${ICONS.gift}<div class="huge ol2">$${fmt(giftValue())}</div><div class="ds">+ ${GIFT.darts} ${DARTS[GIFT.dart].name} darts</div>${left <= 0 ? `<button class="btn" data-do="claimGift">CLAIM!</button>` : `<button class="btn off">${fmtTime(left)}</button>`}<div class="ds" style="margin-top:10px">A free gift every ${GIFT.every / 60} minutes.</div></div>`
}

// --- Playtime Rewards --------------------------------------------------------------------------------
const POTION = `<svg viewBox="0 0 64 64"><g stroke="#1b1b1b" stroke-width="4" stroke-linejoin="round"><rect x="24" y="6" width="16" height="10" rx="2" fill="#c98a4a"/><path d="M26 16 V24 L12 44 C8 52 14 58 22 58 H42 C50 58 56 52 52 44 L38 24 V16 Z" fill="#7fe0ff"/><path d="M34 30 L26 44 H32 L28 54 L40 38 H34 L38 30 Z" fill="#ffe14a"/></g></svg>`
function ptIcon(r) {
  switch (r.kind) {
    case 'darts': return ICONS.dart.replace('#ff4d4d', DARTS[r.dart].color)
    case 'money': return ICONS.cash
    case 'steps': return ICONS.shoe
    case 'treadmill': return POTION
    case 'animal': return `<img src="${animalThumb(r.species, r.mutation)}" alt="">`
  }
  return ''
}
function ptButton(i) {
  if (playtime.isClaimed(i)) return `<button class="pt-btn grey ol" data-pt="${i}">CLAIMED</button>`
  if (playtime.mode() === 'offline') return `<button class="pt-btn grey ol" data-pt="${i}">CONNECTING…</button>`
  if (playtime.isReady(i)) return `<button class="pt-btn green ol" data-pt="${i}" data-do="claimPt" data-id="${i}">CLAIM</button>`
  return `<button class="pt-btn red ol" data-pt="${i}">${fmtClock(PLAYTIME[i].at - playtime.seconds())}</button>`
}
let ptKey = ''
const ptState = () => PLAYTIME.map((_, i) => (playtime.isClaimed(i) ? 'c' : playtime.isReady(i) ? 'r' : playtime.mode() === 'offline' ? 'o' : 'w')).join('')
function playtimeBody() {
  ptKey = ptState()
  return `<div class="pt-grid">${PLAYTIME.map((r, i) => {
    const sub = r.kind === 'animal' ? `<div class="pt-s ol" style="color:${RARITIES[ANIMALS[r.species].rarity].color}">${RARITIES[ANIMALS[r.species].rarity].name.toUpperCase()} · <span style="color:${MUTATIONS[r.mutation]?.color ?? '#fff'}">${MUTATIONS[r.mutation]?.name.toUpperCase() ?? ''}</span></div>` : ''
    return `<div class="pt-tile ${r.bg}"><div class="pt-t ol">${playtime.label(r)}</div>${sub}<div class="pt-ic">${ptIcon(r)}</div>${ptButton(i)}</div>`
  }).join('')}</div><div class="pn-sub pt-note">Play to unlock rewards. They reset every day (UTC).${playtime.mode() === 'offline' ? ' Connecting to the server…' : ''}</div>`
}
function tickPlaytime() {
  if (current?.id !== 'playtime') return
  if (ptState() !== ptKey) return render(true)
  for (const b of wrap.querySelectorAll('.pt-btn.red')) {
    const i = Number(b.dataset.pt)
    b.textContent = fmtClock(PLAYTIME[i].at - playtime.seconds())
  }
}

// --- Settings -------------------------------------------------------------------------------------------
function settingsBody() {
  return `<div class="set">${Object.entries(GAME_SETTINGS)
    .map(([k, name]) => `<button class="set-btn ${state.settings[k] ? 'on' : 'off'} ol" data-do="setting" data-id="${k}">${name.toUpperCase()}: ${state.settings[k] ? 'ON' : 'OFF'}</button>`)
    .join('')}</div>`
}

// --- Worlds (the portal) ---------------------------------------------------------------------------------
function worldsBody() {
  return WORLD_IDS.map((id) => {
    const w = WORLDS[id]
    const a = WORLD_ART[id]
    const open = worldUnlocked(id)
    const btn = open ? `<button class="btn" data-do="travel" data-id="${id}">TRAVEL</button>` : `<button class="btn alt" data-do="toArmory" data-id="${w.weapon}">NEEDS ${WEAPONS[w.weapon].name.toUpperCase()}</button>`
    return `<div class="pn-row wr ${open ? '' : 'locked'}"><div class="wr-pic" style="--sky:${a.sky};--gr:${a.ground}">${a.emoji}</div><div class="grow"><div class="nm">${w.name}</div><div class="ds">Animals worth x${fmt(w.mult)} · Index ${worldFound(id)}/6</div></div>${btn}</div>`
  }).join('') + `<div class="pn-sub" style="padding:6px 0 0">Every area lies along the lane, Meadow first and Volcano at the cliff, each with its own six animals. Its barrier opens with a weapon from the ARMORY, which also reaches that far. TRAVEL takes you to an area's gate. Halloween animals roam every area during the event.</div>`
}

// --- Actions ----------------------------------------------------------------------------------------
function deny(b, msg) {
  sfx.deny()
  b.closest('.card, .pn-row, .zoo-card, .sk-card, .pt-tile, .ix-rew')?.classList.add('shake')
  if (msg) toast(msg, { error: true })
}

async function act(b) {
  const id = b.dataset.id
  const what = b.dataset.do
  if (what !== 'sellAll') current.confirm = null
  if (shops.SHOP_PANELS.includes(current.id) && shops.act(b, current.view)) {
    save()
    return refreshPanel()
  }
  switch (what) {
    case 'toSkinShop':
      openPanel('skinShop')
      current.view.idx = shops.SHOP_SKINS.indexOf(id)
      return refreshPanel()
    case 'toArmory':
      openPanel('armory')
      current.view.idx = Object.keys(WEAPONS).indexOf(id)
      return refreshPanel()
    case 'buyBoost':
      if (!buyBoost(id)) return deny(b, 'Not enough money')
      sfx.purchase()
      break
    case 'watchAd': {
      const r = await ads.watchAd(id)
      if (r.ok) {
        sfx.purchase()
        toast(`${AD_REWARDS[id].name} unlocked!`, { check: true })
      } else if (r.reason === 'skipped') toast('Watch the whole ad to get the reward', { error: true })
      else if (r.reason === 'verify') toast('The reward could not be verified, try again', { error: true })
      else if (r.reason !== 'busy') toast('No ad available right now, try again later', { error: true })
      break
    }
    // Index
    case 'ixSel':
      current.sel = id
      break
    case 'ixWorld':
      current.world = id
      current.sel = null
      break
    case 'ixMut':
      current.mut = id
      break
    case 'claimWorld': {
      const r = claimWorld(id)
      if (!r) return deny(b, worldFound(id) < 6 ? 'Discover all 6 animals first' : null)
      sfx.gift()
      toast(`${WORLDS[id].name} Index complete! +$${fmt(r.money)} and +${fmt(r.steps)} speed`, { check: true, seconds: 4 })
      break
    }
    case 'claimMut': {
      const ms = MUTATION_MILESTONES.find((x) => x.n === Number(b.dataset.n))
      const r = ms && claimMutation(id, ms)
      if (!r) return deny(b)
      sfx.gift()
      toast(r.aura ? `Aura ${MUTATIONS[id].name} unlocked and equipped!` : r.money ? `+$${fmt(r.money)}!` : `+${fmt(r.steps)} speed!`, { check: true, seconds: 4 })
      break
    }
    case 'claimSeason': {
      const r = claimSeason()
      if (!r) return deny(b, 'Catch every event animal first')
      sfx.gift()
      toast(`Skin ${SKINS[r.skin].name} unlocked! Equip it in SKIN`, { check: true, seconds: 4 })
      break
    }
    // Zoo
    case 'sell': {
      const pay = sellAnimal(Number(id))
      if (pay) {
        sfx.purchase()
        toast(`Sold for $${fmt(pay)}`)
      }
      break
    }
    case 'store':
      if (!storeAnimal(Number(id))) return deny(b, 'Storage is full')
      sfx.equip()
      break
    case 'activate':
      if (!activateAnimal(Number(id))) return deny(b, 'No free active slot: store one or buy +1 ACTIVE')
      sfx.equip()
      break
    case 'equipBest':
      if (equipBest()) sfx.equip()
      else toast('Your best animals are already active')
      break
    case 'sellAll': {
      if (!state.storage.length) return deny(b, 'Storage is empty')
      if (current.confirm !== 'sellAll') {
        current.confirm = 'sellAll'
        break
      }
      current.confirm = null
      const pay = sellAllStorage()
      sfx.purchase()
      toast(`Sold your storage for $${fmt(pay)}`)
      break
    }
    case 'upgradePen':
      if (!upgradePen()) return deny(b, 'Not enough money')
      sfx.purchase()
      break
    // Skins
    case 'skinGo':
      current.skinIdx = Math.max(0, Math.min(SKIN_IDS.length - 1, Number(id)))
      break
    case 'equipSkin':
      if (!equipSkin(id)) return deny(b)
      sfx.equip()
      break
    case 'buySkin':
      if (!buySkin(id)) return deny(b, 'Not enough money')
      sfx.purchase()
      toast(`${SKINS[id].name} unlocked!`, { check: true })
      break
    case 'claimBp': {
      const L = Number(id)
      if (state.bp.claimed.includes(L) || bpLevel() < L) return
      state.bp.claimed.push(L)
      const r = bpReward(L)
      if (r.type === 'money') addMoney(r.n)
      else {
        state.darts[r.dart] = (state.darts[r.dart] ?? 0) + r.n
        emit('darts')
      }
      sfx.gift()
      emit('bp')
      break
    }
    case 'claimGift': {
      if (state.giftAt > Date.now()) return
      const v = giftValue()
      state.giftAt = Date.now() + GIFT.every * 1000
      state.darts[GIFT.dart] = (state.darts[GIFT.dart] ?? 0) + GIFT.darts
      addMoney(v)
      emit('darts')
      sfx.gift()
      toast(`+$${fmt(v)} and ${GIFT.darts} ${DARTS[GIFT.dart].name} darts!`)
      break
    }
    case 'claimPt': {
      b.classList.add('off')
      b.removeAttribute('data-do')
      const r = await playtime.claim(Number(id))
      if (!r.ok) {
        deny(b, r.reason === 'offline' || r.reason === 'timeout' ? 'Could not reach the server, try again' : r.reason === 'claimed' ? 'Already claimed' : 'Not ready yet')
        break
      }
      sfx.gift()
      toast(r.text, { check: true, seconds: 3.5 })
      break
    }
    // Settings
    case 'setting':
      state.settings[id] = !state.settings[id]
      emit('settings')
      break
    // Worlds
    case 'travel':
      travel(id)
      sfx.portal?.()
      break
  }
  save()
  if (current) refreshPanel()
}

// Once a second: dart shop restock, shop timers, gift and playtime timers.
export function tickShop() {
  if (Date.now() >= state.dartShop.restockAt) {
    restockDarts()
    toast('The Dart Shop restocked!')
    if (current?.id === 'darts') refreshPanel()
  }
  if (current && PANELS[current.id].wallet) shops.tick(wrap, current.id)
  if (current?.id === 'gift') refreshPanel()
  tickPlaytime()
}
