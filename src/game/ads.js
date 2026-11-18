// Rewarded ads (Bloxity): "Watch an ad" for free darts, a x2 boost or a FREE shop item (config
// AD_REWARDS; money-priced items and boosts only, never Gems). The reward is granted only when the ad
// was completed AND, with a server connected, the server verified the reward token with Bloxity
// (net.claimAdReward). Without a server (dev, offline) a completed ad is enough.
import { AD_REWARDS, COSMETICS, SKINS } from '../config.js'
import * as bloxity from '../bloxity.js'
import { claimAdReward, net } from '../net.js'
import { addBoost, emit, save, shopItem, state, unlockShopItem } from './state.js'

const readyAt = {} // placement -> performance.now() when it can be watched again
let busy = false

const itemIds = (kind) => Object.keys(kind === 'skin' ? SKINS : kind === 'aura' ? COSMETICS.auras : COSMETICS.trails)

// Can `item` of this placement's kind be taken for an ad (a $ shop item, unowned, cheap enough)?
export function freeItemOk(id, item) {
  const r = AD_REWARDS[id]
  const it = r?.kind ? shopItem(r.kind, item) : null
  return !!it && !it.owned && it.price <= r.maxPrice
}
// The cheapest unowned item an item placement can still give ('' when the shop has none left).
export function nextFreeItem(id) {
  const r = AD_REWARDS[id]
  if (!r?.kind) return ''
  let best = ''
  let bestPrice = Infinity
  for (const item of itemIds(r.kind)) {
    if (!freeItemOk(id, item)) continue
    const p = shopItem(r.kind, item).price
    if (p < bestPrice) {
      best = item
      bestPrice = p
    }
  }
  return best
}

// Every placement the Boosts tab lists; item placements only while they have something left to give.
export const adList = () =>
  Object.entries(AD_REWARDS)
    .map(([id, r]) => ({ id, ...r, item: r.kind ? nextFreeItem(id) : '' }))
    .filter((a) => !a.kind || a.item)
export const adsOffered = () => bloxity.adsAvailable()
export const adWait = (id) => Math.max(0, Math.ceil(((readyAt[id] ?? 0) - performance.now()) / 1000))
export const adReady = (id) => adsOffered() && !busy && adWait(id) === 0

// Hands out the reward; returns the unlocked item's name for item placements.
function grant(id, item) {
  const r = AD_REWARDS[id]
  let name = ''
  if (r.darts) {
    for (const [type, n] of Object.entries(r.darts)) state.darts[type] = (state.darts[type] ?? 0) + n
    emit('darts')
  }
  if (r.boost) addBoost(r.boost.id, r.boost.seconds)
  if (r.kind) name = unlockShopItem(r.kind, item)
  save()
  return name
}

// Plays the ad for `id` (item placements: `item` = the shop item to unlock, default the cheapest left).
// Resolves { ok, item?, reason? } (reason: 'busy' | 'wait' | 'unavailable' | 'skipped' | 'verify' | 'owned').
export async function watchAd(id, item) {
  const r = AD_REWARDS[id]
  if (!r) return { ok: false, reason: 'unavailable' }
  if (busy) return { ok: false, reason: 'busy' }
  if (r.kind) {
    item = item || nextFreeItem(id)
    if (!freeItemOk(id, item)) return { ok: false, reason: 'owned' }
  }
  if (adWait(id) > 0) return { ok: false, reason: 'wait' }
  if (!adsOffered()) return { ok: false, reason: 'unavailable' }
  busy = true
  try {
    const res = await bloxity.showRewarded(id)
    if (res.status !== 'completed') return { ok: false, reason: res.status === 'skipped' ? 'skipped' : 'unavailable' }
    if (net.connected && net.hydrated) {
      const verdict = await claimAdReward(id, res.rewardToken)
      if (!verdict.ok) return { ok: false, reason: 'verify' }
    }
    readyAt[id] = performance.now() + r.cooldown * 1000
    // The item may have been bought while the ad ran: nothing to give then, the ad still counts.
    const name = grant(id, item)
    return { ok: true, item: name || undefined }
  } finally {
    busy = false
  }
}
