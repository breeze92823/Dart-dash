// Leaderboards, in the game and on Bloxity.
//  - Bloxity: the boards (config LEADERBOARDS) are defined at SDK init (bloxity.js); this submits the
//    player's scores from the browser every SUBMIT_EVERY s when they changed (and when the tab
//    hides), so guests rank too. The backend also reports signed-in players' scores server-side.
//  - The hub's three boards (boards.redrawBoards) list: you, the other players in your room (live, from
//    the roster), the server's top saved players and Bloxity's global top lists (Top speed <- 'steps',
//    Most captures <- 'captures'; refreshed every TOP_EVERY s).
import { LEADERBOARDS } from '../config.js'
import * as bloxity from '../bloxity.js'
import { net } from '../net.js'
import { state } from './state.js'

const SUBMIT_EVERY = 20
const TOP_EVERY = 60
const sent = {}
let submitTimer = 5
let topTimer = 3
export const globalTop = { steps: [], captures: [] }

function submitAll() {
  for (const b of LEADERBOARDS) {
    const score = Math.floor(state[b.stat] ?? 0)
    if (score <= 0 || sent[b.id] === score) continue
    sent[b.id] = score
    bloxity.submitScore(b.id, score).then((r) => {
      if (r === null) delete sent[b.id] // not taken (no Bloxity player yet): retry next time
    })
  }
}

async function refreshTop() {
  const [steps, captures] = await Promise.all([bloxity.topScores('steps'), bloxity.topScores('captures')])
  globalTop.steps = steps
  globalTop.captures = captures
}

// Once a second from main.js.
export function tickLeaderboards() {
  if (!bloxity.sdk()) return
  if ((submitTimer -= 1) <= 0) {
    submitTimer = SUBMIT_EVERY
    submitAll()
  }
  if ((topTimer -= 1) <= 0) {
    topTimer = TOP_EVERY
    refreshTop()
  }
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => document.hidden && bloxity.sdk() && submitAll())

// The other players of the room as leaderboard rows { name, money, steps, captures }.
export function roomRows() {
  const out = []
  net.players((p, sid, me) => {
    if (!me) out.push({ name: p.username || 'Player', money: p.money || 0, steps: p.steps || 0, captures: p.captures || 0, room: true })
  })
  return out
}
