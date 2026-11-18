---
canDie: true
hasScore: true
---

# Bloxity SDK metadata

- `canDie: true`: angry lane animals can knock the player out (`src/game/danger.js`). Boxity's death screen
  opens on the knock-out and the GET UP button waits for its countdown.
- `hasScore: true`: three leaderboards (`captures`, `steps`, `earned`), defined in `src/bloxity.js` and
  reported by the backend (`../Dart-dash-backend/src/bloxity.ts`).
- Gems purchases are not integrated on purpose: nothing in the game is sold for premium currency.
  Rewarded ads give free items instead (`src/game/ads.js`).
