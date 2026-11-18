// The Bloxity (Legion) SDK facade. Every SDK call goes through here. Nothing
// here may throw when the SDK is missing: a blocked sdk.bloxity.io leaves the
// game fully playable on the default avatar and keyboard controls.
// Docs: https://docs.bloxity.io/#html5
import { GAME_SLUG, GAME_TITLE, SETTINGS, DEV_MODE, LEADERBOARDS, coerceSetting } from './config.js'

export function sdk() {
  if (DEV_MODE) return null
  return (typeof window !== 'undefined' && window.Legion && window.Legion.SDK) || null
}

// --- State --------------------------------------------------------------
export const settings = {}
for (const key of Object.keys(SETTINGS)) settings[key] = coerceSetting(key, SETTINGS[key].def)

// `user` is only written from onUserChanged (re-reading getUser()). `ready`
// flips once auth has settled so the signed-in avatar load isn't pre-empted.
export const authState = { ready: false, user: null, guest: null }

let latestEquipped = null
let latestProportions = null
const avatarListeners = new Set()
const proportionListeners = new Set()
const authListeners = new Set()
const settingListeners = new Set()
const respawnListeners = new Set()
const emoteListeners = new Set()
const breakListeners = new Set()
const chatListeners = new Set()
const unsubscribers = []

function emit(listeners, ...args) {
  for (const fn of listeners) {
    try {
      fn(...args)
    } catch (err) {
      console.warn('[bloxity] listener threw', err)
    }
  }
}

// Fires on any customizer change (may fire twice: optimistic, then confirmed;
// keep handlers idempotent). Each returns an unsubscribe.
export function onAvatarChanged(fn) {
  avatarListeners.add(fn)
  return () => avatarListeners.delete(fn)
}
export function onProportionsChanged(fn) {
  proportionListeners.add(fn)
  return () => proportionListeners.delete(fn)
}
export function subscribeAuth(fn) {
  authListeners.add(fn)
  fn(authState)
  return () => authListeners.delete(fn)
}
// fn(key, value) on every change of a SETTINGS key (already coerced).
export function onSetting(fn) {
  settingListeners.add(fn)
  return () => settingListeners.delete(fn)
}
// The portal's own pause-menu "Respawn" button.
export function onRespawnRequest(fn) {
  respawnListeners.add(fn)
  return () => respawnListeners.delete(fn)
}

// Emotes (Legion.SDK.player 'play_emote'): fn(emoteId) when the player picks one in the portal menu.
export function onEmote(fn) {
  emoteListeners.add(fn)
  return () => emoteListeners.delete(fn)
}
// Ad breaks: fn(true) when Bloxity starts one (pause the simulation, mute audio), fn(false) when it ends.
export function onAdBreak(fn) {
  breakListeners.add(fn)
  return () => breakListeners.delete(fn)
}
// Chat messages Bloxity's own chat feed carries: fn({ userId, username, text, isGif, at, isLocalPlayer }).
export function onChat(fn) {
  chatListeners.add(fn)
  return () => chatListeners.delete(fn)
}

// --- Auth ---------------------------------------------------------------
// The SDK fires onUserChanged immediately with a null user, then again once the
// portal handshake answers; a null user only settles auth after a grace period.
const GUEST_SETTLE_MS = 2500
let settleTimer = null

function settleAuth() {
  settleTimer = null
  if (authState.ready) return
  authState.ready = true
  emit(authListeners, authState)
}

function onUser() {
  const SDK = sdk()
  const user = SDK ? SDK.auth.getUser() : null
  latestEquipped = null // a different account's equip event must not linger
  latestProportions = null

  if (user || authState.ready) {
    if (settleTimer) clearTimeout(settleTimer)
    settleTimer = null
    authState.ready = true
  } else if (!settleTimer) {
    settleTimer = setTimeout(settleAuth, GUEST_SETTLE_MS)
  }
  authState.user = user
  try {
    authState.guest = user || typeof SDK.auth.getGuest !== 'function' ? null : SDK.auth.getGuest()
  } catch {
    authState.guest = null
  }
  emit(authListeners, authState)
}

// Name for the HUD badge.
export function displayName() {
  const u = authState.user
  if (u) return u.displayName || u.username || u.name || 'Player'
  const g = authState.guest
  if (g) return g.displayName || g.username || g.name || 'Guest'
  return sdk() ? 'Guest' : 'Offline'
}

// The player's Bloxity profile picture (user, else the guest's derived one) as an absolute
// http(s) URL, '' when there is none. Relative paths resolve against the CDN (staticUrl).
export function getPfp() {
  const raw = authState.user?.pfp || authState.guest?.pfp
  if (typeof raw !== 'string' || !raw) return ''
  try {
    let base = 'https://static.bloxity.io'
    try {
      base = sdk()?.environment?.()?.staticUrl || base
    } catch {
      // Older SDK builds have no environment().
    }
    const url = new URL(raw, base)
    return /^https?:$/.test(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

// --- Init ---------------------------------------------------------------
let initialised = false

export function init() {
  if (initialised) return
  initialised = true

  const SDK = sdk()
  if (!SDK) {
    if (DEV_MODE) console.info('[bloxity] VITE_DEV_MODE=true: skipping SDK/CDN, running on the default avatar')
    else console.info('[bloxity] SDK not loaded: running offline on the default avatar')
    authState.ready = true
    emit(authListeners, authState)
    return
  }

  try {
    const onLocalhost = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
    SDK.init(onLocalhost ? { gameSlug: GAME_SLUG, portalUrl: 'https://bloxity.io' } : { gameSlug: GAME_SLUG })
    SDK.game.loadingStep(`Loading ${GAME_TITLE}`)

    for (const key of Object.keys(SETTINGS)) {
      const off = SDK.settings.listen(key, (raw) => {
        const next = coerceSetting(key, raw)
        if (settings[key] === next) return
        settings[key] = next
        emit(settingListeners, key, next)
      })
      if (typeof off === 'function') unsubscribers.push(off)
    }
    SDK.settings.triggerAll?.()

    unsubscribers.push(SDK.auth.onUserChanged(onUser))

    if (typeof SDK.avatar?.onAvatarChanged === 'function') {
      unsubscribers.push(
        SDK.avatar.onAvatarChanged((equipped) => {
          // The event payload wins over getEquipped(), which can lag the event.
          if (equipped && typeof equipped === 'object') latestEquipped = equipped
          emit(avatarListeners)
        }),
      )
    }
    if (typeof SDK.avatar?.onProportionsChanged === 'function') {
      unsubscribers.push(
        SDK.avatar.onProportionsChanged((proportions) => {
          if (proportions && typeof proportions === 'object') latestProportions = proportions
          emit(proportionListeners)
        }),
      )
    }

    unsubscribers.push(
      SDK.player.onEvent((event, data) => {
        if (event === 'respawn_request') emit(respawnListeners)
        else if (event === 'play_emote' && typeof data === 'string') emit(emoteListeners, data)
      }),
    )
    initFeatures(SDK)

    SDK.game.loadingStep('Building the island')
  } catch (err) {
    console.warn('[bloxity] init failed; running without the SDK', err)
    authState.ready = true
    emit(authListeners, authState)
  }
}

export function loadingStep(text) {
  try {
    sdk()?.game.loadingStep(text)
  } catch {
    // Non-fatal.
  }
}

let announcedFirstFrame = false

// Call once the scene has rendered: tells the portal loading is done.
export function notifyFirstFrame() {
  if (announcedFirstFrame) return
  announcedFirstFrame = true
  const SDK = sdk()
  if (!SDK) return
  try {
    SDK.game.loadingEnd()
    SDK.game.gameplayStart()
  } catch {
    // Non-fatal.
  }
}

export function teardown() {
  for (const off of unsubscribers.splice(0)) {
    try {
      off()
    } catch {
      // Tearing down anyway.
    }
  }
  try {
    sdk()?.game.gameplayEnd()
  } catch {
    // Non-fatal.
  }
}

// --- Avatar accessors (null when the SDK is unavailable or the call throws) ---
export function getEquippedAvatar() {
  if (latestEquipped) return latestEquipped
  try {
    return sdk()?.avatar.getEquipped() ?? null
  } catch {
    return null
  }
}

// { height, shoulderWidth, armLength, legOffsetX, torsoScaleX, neckHeight,
// headScale }, normalised around 1.0; loader.js applyProportions() consumes it.
export function getProportions() {
  try {
    const current = sdk()?.avatar.getProportions()
    return latestProportions ? { ...current, ...latestProportions } : current ?? null
  } catch {
    return latestProportions
  }
}

// Skin texture URL with the worn face, shirt and pants already drawn on.
export function getSkinTextureUrl() {
  try {
    const url = sdk()?.avatar?.getSkinTextureUrl?.()
    return typeof url === 'string' && url ? url : null
  } catch {
    return null
  }
}

export const canCustomize = () => typeof sdk()?.avatar?.toggleCustomizer === 'function'

// Opens / closes the portal's avatar editor; edits come back through onAvatarChanged.
export function toggleCustomizer() {
  try {
    sdk()?.avatar.toggleCustomizer()
  } catch {
    // Ignore.
  }
}

// --- Game server ------------------------------------------------------
// Bloxity hosting has no fixed socket URL: the matchmaker picks a pod with room (or wakes one) and
// the SDK returns its endpoint (the dev channel reaches the dev backend, prod the prod one). Each
// endpoint is pinned to one pod, so net.js builds a new Client per resolve.
export function canResolveServer() {
  try {
    return typeof sdk()?.net?.resolveEndpoint === 'function'
  } catch {
    return false
  }
}
// { endpoint, relayRoomId }: relayRoomId is the matchmaker relay pinning the pod (the endpoint is
// {playUrl}/v1/ws/<relayRoomId>). Rejects (net.js retries with backoff) when the matchmaker can't answer.
export async function resolveServerEndpoint(userId) {
  const { endpoint, roomId, cold } = await sdk().net.resolveEndpoint(GAME_SLUG, userId ? { userId } : undefined)
  if (cold) console.info('[net] waking up a server...')
  return { endpoint, relayRoomId: roomId }
}

// The ?roomId= the page was opened with: the game page's Open Rooms Join button (a bare Colyseus
// room id) or a friend invite (what updateRoom() reported: "<relayRoomId>~<colyseusRoomId>").
export function launchRoomId() {
  try {
    return new URLSearchParams(location.search).get('roomId') || ''
  } catch {
    return ''
  }
}

// Where a launch room lives: { endpoint, roomId, relayRoomId }, or null when it is gone, full or
// can't be found. A bare id needs the matchmaker's cross-pod directory (a plain joinById through
// any relay would usually land on another pod); a relay~room id is joined through its relay.
export async function locateRoom(id) {
  const playUrl = (() => {
    try {
      return sdk()?.environment?.()?.playUrl
    } catch {
      return '' // Older SDK builds have no environment().
    }
  })()
  if (!playUrl || !id) return null
  const base = playUrl.replace(/\/$/, '')
  const [relay, roomId] = id.includes('~') ? id.split('~', 2) : ['', id]
  if (relay) return { endpoint: `${base.replace(/^http/i, 'ws')}/v1/ws/${encodeURIComponent(relay)}`, roomId, relayRoomId: relay }
  const res = await fetch(`${base}/v1/dir/${encodeURIComponent(GAME_SLUG)}/list`)
  const rooms = res.ok ? (await res.json())?.rooms ?? [] : []
  const r = rooms.find((r) => r.colyseusRoomId === roomId && !r.locked && r.players < r.maxPlayers)
  return r ? { endpoint: r.joinUrl, roomId: r.colyseusRoomId, relayRoomId: r.relayRoomId } : null
}

// Reports the room this player is in ('' = not in a joinable room), so the portal's friend invites
// land in it.
export function updateRoom(roomId) {
  try {
    sdk()?.game?.updateRoom?.(roomId)
  } catch {
    // Ignore.
  }
}

// --- Portal -----------------------------------------------------------
export function showMenu() {
  try {
    sdk()?.portal.showMenu(true)
  } catch {
    // Ignore.
  }
}

// Where Boxity draws its own controls over the game: the toolbar in the top-left corner and
// the chat feed under it, as [{ id, left, top, width, height }] in CSS px. fn runs now and on
// every change (resize, toolbar change). Without the SDK (dev mode, blocked CDN) it gets the
// default footprint the SDK itself assumes until the portal reports, so the HUD is laid out
// the same everywhere. Returns an unsubscribe.
export function onReservedAreas(fn) {
  try {
    const off = sdk()?.ui?.onReservedAreasChange?.((areas) => fn(Array.isArray(areas) ? areas : []))
    if (typeof off === 'function') return off
  } catch {
    // Fall back to the estimate below.
  }
  const update = () => fn(estimatedReservedAreas(window.innerWidth, window.innerHeight))
  window.addEventListener('resize', update)
  update()
  return () => window.removeEventListener('resize', update)
}

// The SDK's estimate (legion-sdk ui.estimatedAreas): an 8 px margin round one row of buttons,
// the whole width on narrow phones, and the chat feed under it.
function estimatedReservedAreas(w, h) {
  const compact = w < 640 || h <= 500
  const toolbarHeight = 16 + (w < 640 ? 32 : w < 768 ? 40 : 44)
  const chatWidth = compact ? Math.min(w * 0.7, 260) : Math.min(w * 0.8, 360)
  return [
    { id: 'toolbar', left: 0, top: 0, width: Math.min(w, w < 480 ? w : 330), height: toolbarHeight },
    { id: 'chat', left: 0, top: toolbarHeight, width: Math.round(chatWidth + 8), height: compact ? 140 : 180 },
  ]
}

export function requestFullscreen(on) {
  try {
    const SDK = sdk()
    if (!SDK) return
    if (on) SDK.portal.requestFullscreen()
    else SDK.portal.exitFullscreen()
  } catch {
    // Ignore.
  }
}

// --- Features: emotes, ads, leaderboards, chat, party -----------------------------------------------
// Each is optional: an older SDK build or a blocked CDN just leaves the feature off.
function initFeatures(SDK) {
  const guard = (what, fn) => {
    try {
      fn()
    } catch (err) {
      console.warn(`[bloxity] ${what} unavailable`, err)
    }
  }
  guard('emotes', () => SDK.game.registerFeature?.('emotes'))
  guard('invites', () => SDK.game.registerFeature?.('play_with_friends'))
  // Ad breaks can start at any moment: the game pauses and mutes until it ends.
  guard('ad breaks', () => {
    const a = SDK.ads
    if (!a) return
    for (const off of [a.onBreakStart?.(() => emit(breakListeners, true)), a.onBreakEnd?.(() => emit(breakListeners, false))]) {
      if (typeof off === 'function') unsubscribers.push(off)
    }
    // Banner screens: the shop / menu panels get a side slot, gameplay stays clear.
    a.declareScreens?.({
      panel: { slots: [{ position: 'middle-right', sizes: ['300x250', '160x600'] }] },
      results: {},
      gameplay: {},
    })
  })
  // Leaderboards (the portal's trophy button): the boards, defined once; the backend reports the scores.
  guard('leaderboards', () => SDK.leaderboard?.define?.(LEADERBOARDS.map(({ id, label, order, mode, format, reset }) => ({ id, label, order, mode, format, reset }))))
  // Bloxity draws the chat UI; the game only puts the bubbles over the speakers' heads.
  guard('chat', () => {
    const off = SDK.chat?.onMessage?.((m) => emit(chatListeners, m))
    if (typeof off === 'function') unsubscribers.push(off)
  })
  // Party play: Bloxity-hosted servers using the matchmaker (maxClients) get it automatically.
  guard('party', () => SDK.party?.enable?.({ maxPartySize: 6 }))
}

// The JWT the game server verifies with Bloxity (POST /v1/auth/game-token/verify); '' when signed out.
export function getToken() {
  try {
    return sdk()?.auth?.getToken?.() || ''
  } catch {
    return ''
  }
}

// --- Rewarded ads -------------------------------------------------------------------------------
export function adsAvailable() {
  try {
    return !!sdk()?.ads?.isAvailable?.()
  } catch {
    return false
  }
}
// Plays a rewarded ad: { status: 'completed' | 'skipped' | 'error' | 'disabled', rewardToken? }. Never throws.
export async function showRewarded(placement) {
  try {
    const r = await sdk().ads.showRewarded(placement)
    return r && typeof r === 'object' ? r : { status: 'error' }
  } catch {
    return { status: 'error' }
  }
}
// Screen banners: 'menu' | 'lobby' | 'results' | 'panel' | 'gameplay'; hideAdScreen when it closes.
export function adScreen(type) {
  try {
    sdk()?.ads?.screen?.(type)
  } catch {
    // Ignore.
  }
}
export function hideAdScreen() {
  try {
    sdk()?.ads?.hideScreen?.()
  } catch {
    // Ignore.
  }
}

// --- Leaderboards ---------------------------------------------------------------------------------
export function openLeaderboard(board = LEADERBOARDS[0].id) {
  try {
    return !!sdk()?.leaderboard?.open?.(board)
  } catch {
    return false
  }
}
export const canOpenLeaderboard = () => typeof sdk()?.leaderboard?.open === 'function'
// Submits a final score (mode 'best' boards: resending the same or a lower score is harmless).
// Guests rank too (Bloxity carries their scores over when they sign in). Null without the SDK.
export async function submitScore(board, score) {
  try {
    return (await sdk()?.leaderboard?.submit?.(board, score)) ?? null
  } catch {
    return null
  }
}
// The board's top rows as [{ name, value, me }] ([] without the SDK / on failure).
export async function topScores(board, limit = 10) {
  try {
    const res = await sdk()?.leaderboard?.getTop?.(board, { period: 'all', limit })
    const rows = Array.isArray(res?.rows) ? res.rows : []
    const meId = authState.user?._id
    return rows
      .map((r) => ({
        name: String(r.displayName || r.username || r.name || r.user?.displayName || r.user?.username || 'Player').slice(0, 24),
        value: Number(r.score ?? r.value) || 0,
        me: !!meId && (r.userId === meId || r.userId === `legion_${meId}` || r.user?._id === meId),
      }))
      .filter((r) => r.value > 0)
  } catch {
    return []
  }
}

// --- Chat bubbles -----------------------------------------------------------------------------------
// Bubble text for a chat message (short, 'sent a GIF' for GIFs) and the SDK's own bubble over `root`.
export function chatBubbleText(m) {
  try {
    return sdk()?.chat?.bubbleText?.(m) ?? (m?.isGif ? 'sent a GIF' : String(m?.text ?? '').slice(0, 80))
  } catch {
    return ''
  }
}
export function attachChatBubble(THREE, root, text, height) {
  try {
    sdk()?.chat?.attachBubble?.(THREE, root, text, { height })
  } catch {
    // Ignore.
  }
}

// --- Emotes ---------------------------------------------------------------------------------------
// [{ id, name, price, free, icon, clip: { len, loop, tracks } }] from the avatar API, cached; [] without it.
let emotesPromise = null
export function loadEmotes() {
  emotesPromise ||= (async () => {
    try {
      const api = sdk()?.environment?.()?.apiUrl || 'https://api.bloxity.io'
      const res = await fetch(`${api}/v1/avatar/emotes`)
      const list = res.ok ? await res.json() : []
      return Array.isArray(list) ? list : []
    } catch {
      return []
    }
  })()
  return emotesPromise
}

// --- Invites / social -----------------------------------------------------------------------------
// A link that opens this game in the room the player is in (null without the SDK).
export function inviteLink(roomId) {
  try {
    return sdk()?.social?.getInviteFriendsLink?.({ gameSlug: GAME_SLUG, roomId: roomId || undefined }) || null
  } catch {
    return null
  }
}
// The game seats a player in the room: friends can find them and the portal lists the others.
export function playerJoined(username) {
  try {
    sdk()?.game?.playerJoined?.(username)
  } catch {
    // Ignore.
  }
}
export function playerInRoom(username) {
  try {
    sdk()?.game?.playerInRoom?.(username)
  } catch {
    // Ignore.
  }
}
// Own-server party launch (null = solo). With the Bloxity matchmaker this is automatic.
export async function partyLaunch() {
  try {
    return (await sdk()?.party?.getLaunch?.()) ?? null
  } catch {
    return null
  }
}
export function partyJoined(roomId) {
  try {
    sdk()?.party?.joined?.(roomId)
  } catch {
    // Ignore.
  }
}
export function partyFailed(reason) {
  try {
    sdk()?.party?.failed?.(reason)
  } catch {
    // Ignore.
  }
}
// Switching environment at runtime (prod / stage): fn(env) so net.js can reconnect.
export function onEnvironmentChanged(fn) {
  try {
    const off = sdk()?.onEnvironmentChanged?.(fn)
    if (typeof off === 'function') return off
  } catch {
    // Ignore.
  }
  return () => {}
}
