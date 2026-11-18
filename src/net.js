// Colyseus link to ../Dart-dash-backend (room "world").
// Signed-in players' progress lives on the server: on join it answers with `progress` (the saved
// doc -> state.hydrate), `noProgress` (new account, guest or no database: keep the current state
// and save it) or `serverError` (the save could not be read: never overwrite it). From then on
// state.snapshot() is sent as `saveProgress` whenever it changed, at most every NET.saveEvery s,
// and when the tab hides or closes.
// Guests (not signed in to Bloxity), dev sessions and everyone when no server is configured keep
// their progress in this browser instead (localStorage, SAVE_KEY); it is loaded at start.
// The server also runs the Playtime Rewards clock (`playtime` / `claimPlaytime`, kept in
// net.playtime; see game/playtime.js) and the leaderboards (`leaderboard`).
// Multiplayer: one room = ROOM_SIZE (6) players. The server hands every player a base `slot`
// (net.slot) and relays what the others need to draw them: pose (`sendPose`), their base's animals /
// treadmill / cosmetics (`sendBase`) and emotes (`sendEmote`), read back through net.players().
// Bloxity: the join carries the SDK token (the server verifies it), the room id is reported with
// updateRoom so friend invites land in it, and rewarded-ad claims are verified server-side.
// Never throws and never blocks play: without a server the game runs on the browser save.
import { Client } from '@colyseus/sdk'
import { DEV_MODE, NET, SERVER_URL } from './config.js'
import { emit, hydrate, readLocal, setSaver, snapshot, writeLocal } from './game/state.js'
import { authState, canResolveServer, getPfp, getToken, launchRoomId, locateRoom, onEnvironmentChanged, playerInRoom, playerJoined, resolveServerEndpoint, subscribeAuth, updateRoom } from './bloxity.js'

// playtime: { seconds, claimed, at (performance.now() when received) } from the server, or null.
export const net = {
  room: null,
  connected: false,
  hydrated: false,
  playtime: null,
  boards: null,
  sessionId: '',
  // This player's base slot (0..ROOM_SIZE-1) once the server has assigned it, else -1.
  get slot() {
    const p = this.me()
    return p && Number.isInteger(p.slot) ? p.slot : -1
  },
  // The room roster entry of this player / of a session, or undefined.
  me() {
    return this.room?.state?.players?.get?.(this.sessionId)
  },
  // fn(player, sessionId, isMe) for everyone in the room (state is decoded in place: just read it).
  players(fn) {
    try {
      this.room?.state?.players?.forEach?.((p, sid) => fn(p, sid, sid === this.sessionId))
    } catch {
      // The room is closing.
    }
  },
}

// --- Identity ---------------------------------------------------------------------
// Signed-in players use their Bloxity id; everyone else a per-browser guest id (never saved on
// the server). Dev mode (no SDK) plays as a per-browser dev id, so a local server with Mongo
// keeps its progress (the browser save is written too).
function storedId(key, make) {
  try {
    let id = localStorage.getItem(key)
    if (!id) localStorage.setItem(key, (id = make()))
    return id
  } catch {
    return make()
  }
}
const rand = () => Math.random().toString(36).slice(2, 8)
const GUEST = storedId('dart-dash.guest', () => `guest-${rand()}`)
const DEV = DEV_MODE ? storedId('dart-dash.dev', () => `dev-${rand()}`) : ''

function identity() {
  if (DEV) return { userId: DEV, username: `Dev ${DEV.slice(4)}` }
  const u = authState.user
  const id = u && (u._id || u.id || u.userId || u.uid)
  if (!id) return { userId: GUEST, username: authState.guest?.displayName || authState.guest?.username || 'Guest' }
  // The token is what the server trusts (it asks Bloxity who it belongs to); the id only picks the save slot locally.
  return { userId: String(id), username: String(u.displayName || u.username || u.name || 'Player'), token: getToken() }
}
const isGuestId = (id) => id.startsWith('guest-')
export const hasServer = () => !!(SERVER_URL || canResolveServer())
const keepsLocal = () => !hasServer() || DEV || isGuestId(identity().userId)

// --- Saving -----------------------------------------------------------------------
let lastSaved = ''
let savedAt = 0
let sentId = ''
let loadedId = ''

function send(type, payload) {
  try {
    net.room?.send(type, payload)
  } catch (err) {
    console.warn('[net] send failed', type, err)
  }
}
function serverSave() {
  if (!net.connected || !net.hydrated || isGuestId(sentId)) return
  const snap = JSON.stringify(snapshot())
  if (snap === lastSaved) return
  lastSaved = snap
  send('saveProgress', JSON.parse(snap))
}
// Saves where the current identity's progress lives (state.save() calls this).
export function saveNow() {
  savedAt = performance.now()
  if (hasServer() && !authState.ready && !DEV) return // who is playing decides where
  if (keepsLocal()) writeLocal()
  serverSave()
}

// --- Requests (Playtime Rewards) ----------------------------------------------------------
// One request of each kind in flight; resolves with the server's answer, or { ok: false, reason }
// ('offline' | 'busy' | 'timeout') without one.
const waiting = {}
function request(type, payload, answer) {
  return new Promise((resolve) => {
    if (!net.connected || !net.hydrated) return resolve({ ok: false, reason: 'offline' })
    if (waiting[answer]) return resolve({ ok: false, reason: 'busy' })
    const timer = setTimeout(() => {
      delete waiting[answer]
      resolve({ ok: false, reason: 'timeout' })
    }, NET.requestTimeout * 1000)
    waiting[answer] = (msg) => {
      clearTimeout(timer)
      delete waiting[answer]
      resolve(msg)
    }
    send(type, payload)
  })
}
// { ok, i, seconds, claimed } | { ok: false, i, reason: 'loading' | 'early' | 'claimed' | 'save' | ... }
export const claimPlaytimeOnServer = (i) => request('claimPlaytime', { i }, 'playtimeResult')
// A rewarded ad was watched: the server verifies the token with Bloxity. { ok, placement, reason? }
export const claimAdReward = (placement, token) => request('adReward', { placement, token }, 'adRewardResult')

// --- Presence (what the others draw) -------------------------------------------------------
// Pose ~10x/s: { x, y, z, yaw, speed, tm (on the treadmill), aim, carry ('species:mutation' | '') }.
let lastPose = ''
export function sendPose(pose) {
  if (!net.connected) return
  const key = JSON.stringify(pose)
  if (key === lastPose) return
  lastPose = key
  send('pose', pose)
}
// The base: { animals: [{ species, mutation }], level, tml, steps, trail, aura, weapon, world }, only when it changed.
let lastBase = ''
export function sendBase(base) {
  if (!net.connected) return
  const key = JSON.stringify(base)
  if (key === lastBase) return
  lastBase = key
  send('base', base)
}
// The look from the Bloxity customizer (opaque JSON the others dress the avatar with).
let lastAvatar = ''
export function sendAvatar(json) {
  if (!net.connected || typeof json !== 'string' || json === lastAvatar || json.length > 3000) return
  lastAvatar = json
  send('setAvatar', { avatar: json })
}
export const sendEmote = (id) => net.connected && send('emote', { id })
function setPlaytime(msg) {
  if (typeof msg?.seconds !== 'number' || !Array.isArray(msg?.claimed)) return
  net.playtime = { seconds: msg.seconds, claimed: msg.claimed.filter(Number.isInteger), at: performance.now() }
  emit('playtime')
}

// --- Connection -------------------------------------------------------------------
function attach(room) {
  net.room = room
  net.connected = true
  net.sessionId = room.sessionId
  lastPose = lastBase = lastAvatar = ''
  // Friends' invites land in this room; the portal lists who is in it.
  updateRoom(room.roomId)
  playerJoined(identity().username)
  setTimeout(() => net.players((p, sid, me) => !me && playerInRoom(p.username)), 1500)
  emit('room', room)
  room.onMessage('progress', (doc) => {
    net.hydrated = true
    lastSaved = ''
    // A reconnect under the same identity: this tab is newer than the save, so push it instead.
    if (loadedId === sentId || !doc) return saveNow()
    loadedId = sentId
    hydrate(doc)
    saveNow()
  })
  room.onMessage('noProgress', () => {
    net.hydrated = true
    loadedId = sentId
    lastSaved = ''
    saveNow()
  })
  room.onMessage('serverError', () => {
    net.hydrated = false
    console.warn('[net] the server could not read the saved progress; saving is off for this session')
  })
  room.onMessage('playtime', setPlaytime)
  room.onMessage('adRewardResult', (r) => waiting.adRewardResult?.(r))
  room.onMessage('*', () => {}) // the server's other messages (spins, daily: not used by this game)
  room.onMessage('playtimeResult', (r) => {
    setPlaytime(r)
    waiting.playtimeResult?.(r)
  })
  room.onMessage('leaderboard', (data) => {
    net.boards = data
    emit('leaderboard', data)
  })
  room.onLeave(() => {
    if (net.room !== room) return
    net.room = null
    net.connected = false
    net.hydrated = false
    net.playtime = null
    net.sessionId = ''
    updateRoom('')
    emit('room', null)
    emit('playtime')
    setTimeout(connect, NET.retry * 1000)
  })
}

// The ?roomId= the page opened with (a friend's invite / the game page's Join button) is tried once
// first: the room it names, if it still has a seat; anything else falls back to the matchmaker.
let launchTried = false
async function joinRoom(options) {
  if (SERVER_URL) return new Client(SERVER_URL).joinOrCreate('world', options)
  if (!launchTried) {
    launchTried = true
    try {
      const where = await locateRoom(launchRoomId())
      if (where) return await new Client(where.endpoint).joinById(where.roomId, options)
    } catch (err) {
      console.info('[net] the invited room could not be joined; matchmaking instead', err?.message ?? err)
    }
  }
  // A new Client per resolve: every endpoint is pinned to one pod. A cold start can take ~45 s, so
  // the matchmaker is retried with backoff for up to NET.joinWindow seconds.
  const deadline = performance.now() + NET.joinWindow * 1000
  let wait = 1500
  for (;;) {
    try {
      const { endpoint } = await resolveServerEndpoint(/^(guest|dev)-/.test(options.userId) ? undefined : options.userId)
      return await new Client(endpoint).joinOrCreate('world', options)
    } catch (err) {
      if (performance.now() + wait > deadline) throw err
      await new Promise((r) => setTimeout(r, wait))
      wait = Math.min(wait * 2, 8000)
    }
  }
}

let connecting = false
let retryIn = NET.retry
async function connect() {
  if (!hasServer() || connecting || net.connected) return
  connecting = true
  try {
    const id = identity()
    sentId = id.userId
    const room = await joinRoom({ ...id, pfp: getPfp(), pose: joinPose?.(), avatar: joinAvatar?.() })
    retryIn = NET.retry
    attach(room)
  } catch (err) {
    console.info(`[net] could not reach the server (retrying in ${retryIn}s); playing on the browser save`, err?.message ?? err)
    setTimeout(connect, retryIn * 1000)
    retryIn = Math.min(retryIn * 2, NET.retryMax)
  } finally {
    connecting = false
  }
}

// main.js supplies where the player stands / what they wear so the others draw them the moment they join.
let joinPose = null
let joinAvatar = null
export function setJoinPresence(pose, avatar) {
  joinPose = pose
  joinAvatar = avatar
}

// Boot: the browser save first (a guest plays on it; a signed-in player until the server
// answers), then the server once Bloxity auth has settled.
export function initNet() {
  setSaver(saveNow)
  const local = readLocal()
  if (local) hydrate(local)
  else hydrate(null)
  window.addEventListener('pagehide', saveNow)
  document.addEventListener('visibilitychange', () => document.hidden && saveNow())
  setInterval(() => {
    if (!document.hidden && performance.now() - savedAt >= NET.saveEvery * 1000) saveNow()
  }, 1000)
  if (!hasServer()) return console.info('[net] no server configured; progress is kept in this browser')
  subscribeAuth((s) => {
    if (!s.ready && !DEV) return
    if (!net.connected) return void connect()
    const id = identity()
    if (id.userId === sentId) return send('identify', { username: id.username, pfp: getPfp(), token: id.token })
    // Save under the OLD identity before switching (auth has already moved on).
    if (isGuestId(sentId)) writeLocal()
    else serverSave()
    net.hydrated = false
    // Signed out: back to this browser's guest save (the account's progress stays on the server).
    if (isGuestId(id.userId)) hydrate(readLocal())
    sentId = id.userId
    send('identify', { ...id, pfp: getPfp() })
  })
  // Prod <-> stage switched at runtime: leave and let the retry loop resolve the new endpoint.
  onEnvironmentChanged(() => {
    launchTried = true
    try {
      net.room?.leave()
    } catch {
      // Already gone.
    }
  })
}
