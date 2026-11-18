// Inline SVG icons for the HUD and windows (chunky, outlined, toy-like).
const S = (vb, body) => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`
const O = 'stroke="#1b1b1b" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"'

export const ICONS = {
  cash: S('0 0 64 64', `<g ${O}><path d="M6 30 L34 18 L58 30 L30 44 Z" fill="#3fc24a"/><path d="M6 30 L6 40 L30 54 L30 44 Z" fill="#2a9a35"/><path d="M30 44 L30 54 L58 40 L58 30 Z" fill="#f2b33a"/><path d="M6 24 L34 12 L58 24 L30 38 Z" fill="#5ddc5a"/></g><circle cx="32" cy="25" r="5" fill="#2a9a35"/>`),
  shoe: S('0 0 64 64', `<g ${O}><path d="M8 36 C8 22 18 14 26 14 L34 26 L54 34 C60 36 60 46 54 46 L12 46 C9 46 8 42 8 36 Z" fill="#4fb3ff"/><path d="M8 40 L56 40" fill="none"/></g><g ${O}><circle cx="48" cy="50" r="10" fill="#3fc24a"/><path d="M48 44 V56 M42 50 H54" stroke="#fff" stroke-width="4"/></g>`),
  cart: S('0 0 64 64', `<g ${O}><path d="M6 12 H14 L20 40 H50 L56 20 H17" fill="#5ddc5a"/><circle cx="24" cy="50" r="5" fill="#fff"/><circle cx="46" cy="50" r="5" fill="#fff"/></g><path d="M22 26 H52 M24 33 H50" stroke="#1b1b1b" stroke-width="3"/>`),
  book: S('0 0 64 64', `<g ${O}><path d="M10 10 H46 C50 10 54 14 54 18 V56 H18 C14 56 10 52 10 48 Z" fill="#2f86ff"/><path d="M18 46 H54 V56 H18 C14 56 14 46 18 46 Z" fill="#fff"/></g><g fill="#ffd23f" stroke="#1b1b1b" stroke-width="2.5"><ellipse cx="33" cy="31" rx="7" ry="6"/><circle cx="24" cy="22" r="3.5"/><circle cx="30" cy="18" r="3.5"/><circle cx="37" cy="18" r="3.5"/><circle cx="43" cy="22" r="3.5"/></g>`),
  paw: S('0 0 64 64', `<g ${O}><rect x="12" y="20" width="40" height="34" rx="6" fill="#b06a2e"/><rect x="8" y="12" width="12" height="16" rx="4" fill="#9a5a24"/><rect x="26" y="8" width="12" height="16" rx="4" fill="#9a5a24"/><rect x="44" y="12" width="12" height="16" rx="4" fill="#9a5a24"/></g>`),
  brush: S('0 0 64 64', `<g ${O}><path d="M40 8 L56 24 L32 44 L22 34 Z" fill="#ffd23f"/><path d="M22 34 L32 44 C28 52 18 58 8 56 C10 46 14 38 22 34 Z" fill="#ff5fb8"/></g><g ${O}><circle cx="14" cy="16" r="6" fill="#4fd3ff"/><path d="M50 46 l3 6 6 3 -6 3 -3 6 -3 -6 -6 -3 6 -3 z" fill="#fff"/></g>`),
  clover: S('0 0 64 64', `<g ${O} fill="#3fc24a"><circle cx="22" cy="22" r="11"/><circle cx="42" cy="22" r="11"/><circle cx="22" cy="40" r="11"/><circle cx="42" cy="40" r="11"/><path d="M32 32 Q40 50 34 60" fill="none"/></g>`),
  gift: S('0 0 64 64', `<g ${O}><rect x="10" y="26" width="44" height="30" rx="3" fill="#2f86ff"/><rect x="6" y="18" width="52" height="12" rx="3" fill="#4fa3ff"/><rect x="28" y="18" width="8" height="38" fill="#ffd23f"/><path d="M32 18 C20 4 10 14 18 18 Z M32 18 C44 4 54 14 46 18 Z" fill="#ffd23f"/></g>`),
  gear: S('0 0 64 64', `<g ${O}><path fill="#c9ced6" d="M28 4 H36 L38 12 L44 14.5 L51 10 L56.5 15.5 L52 22.5 L54.5 28 L60 30 V36 L54.5 37.5 L52 43.5 L56.5 50.5 L51 56 L44 51.5 L38 54 L36 60 H28 L26 54 L20 51.5 L13 56 L7.5 50.5 L12 43.5 L9.5 37.5 L4 36 V28 L9.5 26.5 L12 20.5 L7.5 13.5 L13 8 L20 12.5 L26 10 Z"/><circle cx="32" cy="32" r="9" fill="#6b7380"/></g>`),
  shield: S('0 0 64 64', `<g ${O}><path d="M32 6 L54 14 V30 C54 44 44 54 32 58 C20 54 10 44 10 30 V14 Z" fill="#ffd23f"/></g>`),
  star: S('0 0 64 64', `<path ${O} fill="#ffd23f" d="M32 6 L39 24 L58 25 L43 37 L48 56 L32 45 L16 56 L21 37 L6 25 L25 24 Z"/>`),
  check: S('0 0 64 64', `<path d="M12 34 L26 48 L52 16" fill="none" stroke="#3fe04a" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`),
  close: S('0 0 64 64', `<path d="M16 16 L48 48 M48 16 L16 48" stroke="#fff" stroke-width="10" stroke-linecap="round"/>`),
  lock: S('0 0 64 64', `<g ${O}><rect x="14" y="28" width="36" height="28" rx="5" fill="#ffd23f"/><path d="M22 28 V20 C22 8 42 8 42 20 V28" fill="none"/></g>`),
  sound: S('0 0 64 64', `<g ${O}><path d="M8 24 H20 L34 12 V52 L20 40 H8 Z" fill="#fff"/><path d="M42 22 C48 28 48 36 42 42 M48 16 C58 26 58 38 48 48" fill="none" stroke="#fff"/></g>`),
  mute: S('0 0 64 64', `<g ${O}><path d="M8 24 H20 L34 12 V52 L20 40 H8 Z" fill="#fff"/><path d="M42 24 L56 40 M56 24 L42 40" stroke="#ff5a4a" stroke-width="5"/></g>`),
  music: S('0 0 64 64', `<g ${O}><path d="M24 46 V14 L50 8 V40" fill="none" stroke="#fff"/><ellipse cx="18" cy="46" rx="8" ry="6" fill="#fff"/><ellipse cx="44" cy="40" rx="8" ry="6" fill="#fff"/></g>`),
  dart: S('0 0 64 64', `<g ${O}><path d="M14 50 L36 28" stroke="#d9dde3" stroke-width="5"/><path d="M34 18 L46 30 L40 36 L28 24 Z" fill="#ff4d4d"/><path d="M42 22 L56 8 M44 26 L58 14 M40 18 L52 6" stroke="#fff" stroke-width="4"/></g>`),
  blowpipe: S('0 0 64 64', `<g ${O}><path d="M6 46 L52 14" stroke="#7fcf45" stroke-width="10"/><path d="M6 46 L52 14" stroke="#9be060" stroke-width="5"/></g><rect x="4" y="42" width="10" height="10" fill="#ffd02e" stroke="#1b1b1b" stroke-width="3" transform="rotate(-35 9 47)"/><path d="M20 36 l5 -3.5 M32 28 l5 -3.5 M44 20 l5 -3.5" stroke="#f3e6b8" stroke-width="5"/>`),
  pistol: S('0 0 64 64', `<g ${O}><rect x="8" y="20" width="34" height="14" rx="3" fill="#ff8a1f"/><rect x="40" y="22" width="18" height="9" fill="#f6f6f6"/><rect x="14" y="13" width="18" height="8" rx="3" fill="#7fe0f0"/><path d="M14 33 L20 33 L16 52 L8 52 Z" fill="#ffd02e"/></g>`),
  crossbow: S('0 0 64 64', `<g ${O}><path d="M10 54 L46 18" stroke="#9a5f2e" stroke-width="8"/><path d="M28 10 Q50 14 54 36" fill="none" stroke="#3a3f4a" stroke-width="6"/><path d="M28 10 L54 36" stroke="#e9e9e9" stroke-width="2"/></g>`),
  rifle: S('0 0 64 64', `<g ${O}><path d="M6 44 L58 18" stroke="#3f6e3a" stroke-width="8"/><rect x="26" y="20" width="18" height="7" fill="#1b1d22" transform="rotate(-27 35 23)"/><path d="M6 44 L16 52 L22 42" fill="#8a5a2e"/></g>`),
  house: S('0 0 100 92', `<path d="M50 4 L96 46 L84 46 L84 88 L16 88 L16 46 L4 46 Z" fill="#2f86ff" stroke="#fff" stroke-width="6" stroke-linejoin="round"/><rect x="40" y="56" width="20" height="32" rx="6" fill="#fff"/>`),
  portal: S('0 0 64 64', `<circle cx="32" cy="32" r="26" fill="#2f86ff" stroke="#9fe4ff" stroke-width="6"/><path d="M32 32 m-14 0 a14 14 0 1 1 14 14 a9 9 0 1 1 -9 -9" fill="none" stroke="#fff" stroke-width="4"/>`),
  trail: S('0 0 64 64', `<path d="M6 50 Q30 46 40 30 T58 10" fill="none" stroke="#ff7ad9" stroke-width="10" stroke-linecap="round"/><path d="M6 50 Q30 46 40 30 T58 10" fill="none" stroke="#fff6a8" stroke-width="4" stroke-linecap="round"/>`),
  aura: S('0 0 64 64', `<circle cx="32" cy="32" r="22" fill="none" stroke="#b77bff" stroke-width="6" stroke-dasharray="8 6"/><circle cx="32" cy="32" r="10" fill="#ffe36a" stroke="#1b1b1b" stroke-width="3"/>`),
}

export const WEAPON_ICON = {
  blowpipe: ICONS.blowpipe,
  pistol: ICONS.pistol,
  rifle: ICONS.rifle,
  carbine: ICONS.rifle.replace('#3f6e3a', '#3a5a8a'),
  sniper: ICONS.rifle.replace('#3f6e3a', '#e8b23a'),
  voidReaper: ICONS.rifle.replace('#3f6e3a', '#7a3ad0'),
}
