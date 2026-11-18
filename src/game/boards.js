// Hub leaderboards: you, the other players in the room, the server's saved players and Bloxity's
// global top lists, refreshed every few seconds by main.js.
import { fmt, state } from './state.js'

export function createBoards({ live }) {
  return {
    // server: the backend's `leaderboard` message ({ boards: { money|steps|captures:
    // [{ name, value }] } }) or null.
    // room: the other players in the room ({ name, money, steps, captures }); global: Bloxity's top
    // lists { steps: [{ name, value }], captures: [...] }. One row per name (its best value).
    redrawBoards(playerName, server = null, room = [], global = {}) {
      const me = { name: playerName, me: true, money: state.money, steps: state.steps, captures: state.captures }
      const all = [me, ...room]
      const rows = (key, fmtv) => {
        const extra = [...(server?.boards?.[key] ?? []), ...(global[key] ?? [])].map((r) => ({ name: r.name, [key]: r.value }))
        const best = new Map()
        for (const r of [...all, ...extra]) {
          const v = Number(r[key]) || 0
          const prev = best.get(r.name)
          if (!prev || (!prev.me && v > prev.v)) best.set(r.name, { name: r.name, me: r.me || prev?.me, v: r.me ? v : Math.max(v, prev?.v ?? 0) })
        }
        return [...best.values()].sort((a, b) => b.v - a.v).slice(0, 10).map((r) => ({ name: r.name, me: r.me, value: fmtv(r.v) }))
      }
      live.boards[0].redraw(rows('money', (v) => `$${fmt(v)}`))
      live.boards[1].redraw(rows('steps', (v) => `${fmt(v)} st`))
      live.boards[2].redraw(rows('captures', (v) => fmt(v)))
    },
  }
}
