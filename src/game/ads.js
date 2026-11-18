// Rewarded ads (Bloxity): "Watch an ad" for free darts or a x2 boost (config AD_REWARDS; money and
// boosts only, never Gems). The reward is granted only when the ad was completed AND, with a server
// connected, the server verified the reward token with Bloxity (net.claimAdReward). Without a server
// (dev, offline) a completed ad is enough.
import { AD_REWARDS } from '../config.js'
import * as bloxity from '../bloxity.js'
import { claimAdReward, net } from '../net.js'
import { addBoost, emit, save, state } from './state.js'

const readyAt = {} // placement -> performance.now() when it can be watched again
let busy = false

export const adList = () => Object.entries(AD_REWARDS).map(([id, r]) => ({ id, ...r }))
export const adsOffered = () => bloxity.adsAvailable()
export const adWait = (id) => Math.max(0, Math.ceil(((readyAt[id] ?? 0) - performance.now()) / 1000))
export const adReady = (id) => adsOffered() && !busy && adWait(id) === 0

function grant(id) {
  const r = AD_REWARDS[id]
  if (r.darts) {
    for (const [type, n] of Object.entries(r.darts)) state.darts[type] = (state.darts[type] ?? 0) + n
    emit('darts')
  }
  if (r.boost) addBoost(r.boost.id, r.boost.seconds)
  save()
}

// Plays the ad for `id`; resolves { ok, reason? } (reason: 'busy' | 'wait' | 'unavailable' | 'skipped' | 'verify').
export async function watchAd(id) {
  const r = AD_REWARDS[id]
  if (!r) return { ok: false, reason: 'unavailable' }
  if (busy) return { ok: false, reason: 'busy' }
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
    grant(id)
    return { ok: true }
  } finally {
    busy = false
  }
}
