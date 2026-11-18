// The HUD: side buttons, wallet, hotbar, battle pass / gift / boosts / goal,
// the event banner, centre messages, and the aim-mode overlay (BACK, SCOPE,
// zoom, SHOOT, ammo, hints, distance, scope ring + crosshair). Reads state.js
// events; game code calls the exported setters.
import './hud.css'
import { BATTLE_PASS, DARTS, GOALS, WEAPONS } from '../config.js'
import { ICONS, WEAPON_ICON } from './icons.js'
import { boostLeft, boostPrice, bpLevel, fmt, fmtTime, goalProgress, incomePerSec, on, state } from '../game/state.js'
import * as bloxity from '../bloxity.js'

const root = document.createElement('div')
root.className = 'hud'
root.innerHTML = `
  <div class="side left">
    <button class="bigbtn shop ol" data-act="shop">${ICONS.cart}<span>SHOP</span></button>
    <button class="bigbtn index ol" data-act="index">${ICONS.book}<span>INDEX</span></button>
  </div>
  <div class="side right">
    <button class="bigbtn zoo ol" data-act="zoo">${ICONS.paw}<span>ZOO</span></button>
    <button class="bigbtn skin ol" data-act="skins">${ICONS.brush}<span>SKIN</span></button>
  </div>
  <div class="topright">
    <div class="tr-row">
      <div class="mini">
        <button class="iconbtn gear" data-act="settings" title="Settings">${ICONS.gear}</button>
      </div>
      <button class="bp ol" data-act="bp">BATTLE PASS · LVL <b class="bp-l">0</b><div class="bar"><i></i></div></button>
      <button class="ready ol" data-act="gift">READY!</button>
      <button class="iconbtn pt" data-act="playtime" title="Playtime Rewards">${ICONS.gift}<span class="dot ol hide">!</span></button>
    </div>
    <button class="boost ol" data-act="luck"><span>X2 LUCK</span><span class="ic">${ICONS.clover}<span class="price">$0</span></span></button>
    <button class="boost ol" data-act="cash"><span>X2 CASH/S</span><span class="ic">${ICONS.cash}<span class="price">$0</span></span></button>
    <div class="goal"><h4>GOAL</h4><p class="g-t"></p><div class="gbar"><i></i><b class="g-n ol"></b></div></div>
  </div>
  <div class="event hide"><div class="ev-ic">🐗</div><div class="ev-t ol"><div class="ev-n"></div><div class="ev-s"></div></div><div class="ev-time ol">0:00</div></div>
  <div class="wallet">
    <div class="row steps">${ICONS.shoe}<b class="ol st-n">0</b></div>
    <div class="row money">${ICONS.cash}<b class="ol m-n">0</b><i class="ol m-r">+0 $/s</i></div>
  </div>
  <div class="hotbar">
    <button class="slot s1" data-act="weapon"><span class="n">1</span><span class="x w-r"></span><span class="w-ic"></span><span class="nm w-n"></span></button>
    <button class="slot s2" data-act="dart"><span class="n">2</span><span class="x d-c"></span>${ICONS.dart}<span class="nm big d-n"></span></button>
  </div>
  <div class="aim">
    <div class="scope"><svg viewBox="-100 -100 200 200">
      <line x1="-100" y1="0" x2="100" y2="0" stroke="#0d0d0d" stroke-width="0.6"/>
      <line x1="0" y1="-100" x2="0" y2="100" stroke="#0d0d0d" stroke-width="0.6"/>
      ${[-64, -48, -32, -16, 16, 32, 48, 64].map((x) => `<line x1="${x}" y1="-${Math.abs(x) % 32 ? 1.6 : 2.6}" x2="${x}" y2="${Math.abs(x) % 32 ? 1.6 : 2.6}" stroke="#0d0d0d" stroke-width="0.6"/>`).join('')}
      ${[-64, -48, -32, -16, 16, 32, 48, 64].map((y) => `<line y1="${y}" x1="-${Math.abs(y) % 32 ? 1.6 : 2.6}" y2="${y}" x2="${Math.abs(y) % 32 ? 1.6 : 2.6}" stroke="#0d0d0d" stroke-width="0.6"/>`).join('')}
    </svg></div>
    <div class="crosshair"></div>
    <div class="dist ol">0 STUDS</div>
    <div class="hints ol">Right-click: scope<br>Alt: free mouse<br>E: darts<br>Q: weapons<br>X: stop aiming</div>
    <button class="back ol" data-act="back">BACK</button>
    <div class="aimbtns">
      <div class="ammo ol">x0</div>
      <button class="scopebtn ol" data-act="scope">SCOPE</button>
      <div class="zooms"><button class="zoombtn ol" data-act="zoomOut">−</button><button class="zoombtn plus ol" data-act="zoomIn">+</button></div>
      <button class="shoot ol" data-act="shoot" data-silent><span>SHOOT</span></button>
    </div>
  </div>
  <div class="announce ol"></div>
  <div class="toast"></div>
`
document.body.appendChild(root)
const $ = (s) => root.querySelector(s)
const el = {
  money: $('.m-n'),
  rate: $('.m-r'),
  moneyRow: $('.money'),
  steps: $('.st-n'),
  bpL: $('.bp-l'),
  bpBar: $('.bp .bar i'),
  ready: $('.ready'),
  ptDot: $('.pt .dot'),
  luck: $('[data-act="luck"]'),
  cash: $('[data-act="cash"]'),
  goal: $('.goal'),
  goalT: $('.g-t'),
  goalBar: $('.gbar i'),
  goalN: $('.g-n'),
  event: $('.event'),
  evIc: $('.ev-ic'),
  evN: $('.ev-n'),
  evS: $('.ev-s'),
  evTime: $('.ev-time'),
  wR: $('.w-r'),
  wIc: $('.w-ic'),
  wN: $('.w-n'),
  dC: $('.d-c'),
  dN: $('.d-n'),
  ammo: $('.ammo'),
  dist: $('.dist'),
  shoot: $('.shoot'),
  cross: $('.crosshair'),
  announce: $('.announce'),
  toast: $('.toast'),
  hints: $('.hints'),
}

// --- Actions: buttons call handlers registered by main.js ---------------------------------------
const handlers = {}
export function onAction(name, fn) {
  handlers[name] = fn
}
root.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('[data-act]')
  if (!b) return
  e.preventDefault()
  e.stopPropagation()
  handlers[b.dataset.act]?.(b)
})
// Keep HUD clicks from reaching the canvas (no pointer-lock grabs through buttons).
root.addEventListener('click', (e) => e.stopPropagation())

// Bloxity's own toolbar + chat sit top-left: keep the side buttons below them.
// The right-hand buttons sit below the top-right stack whatever its height.
const topright = root.querySelector('.topright')
function layoutRight() {
  const r = topright.getBoundingClientRect()
  if (r.height) root.style.setProperty('--trb', `${Math.round(r.bottom)}px`)
}
new ResizeObserver(layoutRight).observe(topright)
window.addEventListener('resize', layoutRight)
bloxity.onReservedAreas((areas) => {
  const bottom = areas.reduce((m, a) => (a.left < window.innerWidth * 0.3 ? Math.max(m, a.top + a.height) : m), 0)
  root.style.setProperty('--rb', `${Math.round(bottom)}px`)
})

// --- State-driven parts ----------------------------------------------------------------------------
function renderMoney(delta) {
  el.money.textContent = fmt(state.money)
  el.rate.textContent = `+${fmt(incomePerSec())} $/s`
  if (delta > 0) {
    el.moneyRow.classList.remove('bump')
    void el.moneyRow.offsetWidth
    el.moneyRow.classList.add('bump')
  }
}
function renderHotbar() {
  const w = WEAPONS[state.weapon]
  el.wR.textContent = `${w.range} St`
  el.wIc.innerHTML = WEAPON_ICON[state.weapon]
  el.wN.textContent = w.name.split(' ').pop() // short: Blowpipe, Pistol, Rifle, Carbine, Sniper, Reaper
  const n = state.darts[state.dartType] ?? 0
  el.dC.textContent = `x${n}`
  el.dN.textContent = DARTS[state.dartType].name
  el.dN.style.color = state.dartType === 'basic' ? '#fff' : DARTS[state.dartType].color
  el.ammo.textContent = `x${n}`
  el.ammo.classList.toggle('out', n === 0)
}
function renderBp() {
  const L = bpLevel()
  el.bpL.textContent = L
  const into = state.bp.xp - L * BATTLE_PASS.xpPerLevel
  el.bpBar.style.width = L >= BATTLE_PASS.levels ? '100%' : `${(into / BATTLE_PASS.xpPerLevel) * 100}%`
}
function renderGoal() {
  const g = GOALS[state.goal]
  if (!g) {
    el.goalT.textContent = 'All goals complete!'
    el.goalBar.style.width = '100%'
    el.goalN.textContent = '★'
    return
  }
  const [p, n] = goalProgress(g)
  el.goalT.textContent = g.text
  el.goalBar.style.width = `${(p / n) * 100}%`
  el.goalN.textContent = n > 1 ? `${fmt(p)} / ${fmt(n)}` : `${p} / ${n}`
}
on('money', (m, d, quiet) => renderMoney(quiet ? 0 : d))
on('pen', () => renderMoney(0))
on('boost', () => renderMoney(0))
on('darts', renderHotbar)
on('weapon', renderHotbar)
on('bp', renderBp)
on('goal', renderGoal)
on('steps', (s) => (el.steps.textContent = fmt(s)))
on('goalDone', () => {
  el.goal.classList.remove('done')
  void el.goal.offsetWidth
  el.goal.classList.add('done')
})

export function refreshHud() {
  renderMoney(0)
  renderHotbar()
  renderBp()
  renderGoal()
  el.steps.textContent = fmt(state.steps)
}

// Per-second refresh of timers (gift, boosts, income).
export function tickHud() {
  const giftIn = (state.giftAt - Date.now()) / 1000
  if (giftIn <= 0) {
    el.ready.textContent = 'READY!'
    el.ready.classList.remove('wait')
  } else {
    el.ready.textContent = fmtTime(giftIn)
    el.ready.classList.add('wait')
  }
  for (const [id, b] of [['luck', el.luck], ['cash', el.cash]]) {
    const left = boostLeft(id)
    b.classList.toggle('active', left > 0)
    b.querySelector('.price').textContent = left > 0 ? fmtTime(left) : `$${fmt(boostPrice(id))}`
  }
  el.rate.textContent = `+${fmt(incomePerSec())} $/s`
}

// --- Aim mode -------------------------------------------------------------------------------------
export function setAiming(on) {
  root.classList.toggle('aiming', on)
  document.body.classList.toggle('aiming', on)
}
export function setScoped(on) {
  root.classList.toggle('scoped', on)
  el.shoot.classList.toggle('hot', on)
}
export function setHints(scoped) {
  el.hints.innerHTML = `${scoped ? 'Right-click: leave scope' : 'Right-click: scope'}<br>Alt: free mouse<br>E: darts<br>Q: weapons<br>X: stop aiming`
}
export function setDistance(studs) {
  el.dist.textContent = studs == null ? '— STUDS' : `${Math.round(studs)} STUDS`
}
export function setCooldown(k) {
  el.shoot.classList.toggle('cool', k > 0)
}
export function setLockOn(on) {
  el.cross.classList.toggle('lock', on)
}
export function setCarrying(on) {
  root.classList.toggle('carrying', on)
}

// --- Event banner ----------------------------------------------------------------------------------
export function setEvent(ev) {
  if (!ev) {
    el.event.classList.add('hide')
    return
  }
  el.event.classList.remove('hide')
  el.evIc.textContent = ev.icon
  el.evN.textContent = ev.title
  el.evN.style.color = ev.color
  el.evS.textContent = ev.status
  el.evTime.textContent = ev.time
}

// --- Messages ----------------------------------------------------------------------------------------
let annTimer = 0
export function announce(text, color = '#ffe14a', seconds = 3) {
  el.announce.textContent = text
  el.announce.style.color = color
  el.announce.classList.remove('show')
  void el.announce.offsetWidth
  el.announce.classList.add('show')
  clearTimeout(annTimer)
  annTimer = setTimeout(() => el.announce.classList.remove('show'), seconds * 1000)
}
export function toast(text, { error = false, seconds = 2.6, check = false } = {}) {
  const d = document.createElement('div')
  d.className = `ol${error ? ' err' : ''}`
  d.innerHTML = `${check ? `<span style="color:#3fe04a">✓</span> ` : ''}${text}`
  el.toast.appendChild(d)
  while (el.toast.children.length > 3) el.toast.firstChild.remove()
  setTimeout(() => d.remove(), seconds * 1000)
}
export function banner(text, seconds = 4) {
  const b = document.createElement('div')
  b.className = 'banner ol'
  b.textContent = text
  root.appendChild(b)
  setTimeout(() => b.remove(), seconds * 1000)
}
// "NEW SPECIES!" card (left of centre): the first capture of a species.
// o: { img (data URL), name, rarity, color (rarity), nameColor? }
let newSpTimer = 0
export function newSpecies(o) {
  root.querySelector('.newsp')?.remove()
  const d = document.createElement('div')
  d.className = 'newsp'
  d.innerHTML = `<div class="ns-h ol">NEW SPECIES!</div><div class="ns-pic">${o.img ? `<img src="${o.img}" alt="">` : ''}<i>✦</i><i>✦</i><i>✦</i></div><div class="ns-n ol"${o.nameColor ? ` style="color:${o.nameColor}"` : ''}></div><div class="ns-r ol" style="color:${o.color}"></div>`
  d.querySelector('.ns-n').textContent = o.name
  d.querySelector('.ns-r').textContent = o.rarity
  root.appendChild(d)
  clearTimeout(newSpTimer)
  newSpTimer = setTimeout(() => {
    d.classList.add('out')
    setTimeout(() => d.remove(), 400)
  }, 3800)
}
// The "!" on the Playtime Rewards gift: a reward is ready to claim.
export function setPlaytimeReady(on) {
  el.ptDot.classList.toggle('hide', !on)
}
// Settings > Interface off: only the settings gear (and the aim overlay) stay on screen.
export function setInterface(on) {
  root.classList.toggle('noui', !on)
  document.body.classList.toggle('noui', !on)
}
// The scope ring takes the equipped weapon skin's tint (SKINS[skin].scope.tint).
export function setScopeTint(color) {
  root.style.setProperty('--scope-ring', color)
}
export const hudRoot = root
