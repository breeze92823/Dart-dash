// HTML labels pinned to 3D points (billboards): shop titles, animal tags, sleep
// rings, "+30 $" pops, "!" alerts. Each frame every label is projected to the
// screen and scaled by distance (world-size text, like a sign), clamped so it
// stays readable far away and never covers the screen up close.
import { Vector3 } from 'three'
import './labels.css'

const layer = document.createElement('div')
layer.className = 'wl-layer'
document.body.appendChild(layer)

const labels = new Set()
const v = new Vector3()
let viewH = window.innerHeight
window.addEventListener('resize', () => (viewH = window.innerHeight))

// opts: { pos: Vector3 | () => Vector3, size: world height (m) of 100px of label,
//   min, max: scale clamp, maxDist: hidden beyond (m), className, html, offsetY (px) }
export function addLabel(opts) {
  const el = document.createElement('div')
  el.className = `wl ${opts.className ?? ''}`
  if (opts.html != null) el.innerHTML = opts.html
  el.style.display = 'none' // shown by updateLabels once it has a screen position
  layer.appendChild(el)
  const label = {
    el,
    pos: opts.pos,
    size: opts.size ?? 1,
    min: opts.min ?? 0.25,
    max: opts.max ?? 1.4,
    maxDist: opts.maxDist ?? 120,
    minDist: opts.minDist ?? 0,
    visible: true,
    shown: false,
    remove() {
      labels.delete(label)
      el.remove()
    },
    set html(h) {
      el.innerHTML = h
    },
  }
  labels.add(label)
  return label
}

// A label that floats up and fades out, then removes itself ("+30 $").
export function popLabel(pos, html, className = '', { rise = 1.6, life = 1.1, size = 1, max = 1.3, min = 0.25 } = {}) {
  const start = pos.clone()
  const p = start.clone()
  const l = addLabel({ pos: p, html, className: `wl-pop ${className}`, size, min, max, maxDist: 200 })
  l.life = life
  l.age = 0
  l.update = (dt) => {
    l.age += dt
    const t = l.age / l.life
    p.y = start.y + rise * (1 - (1 - t) * (1 - t))
    l.el.style.opacity = t < 0.7 ? '1' : String(1 - (t - 0.7) / 0.3)
    if (t >= 1) l.remove()
  }
  return l
}

export function updateLabels(camera, dt) {
  // Pixels per metre at distance 1: the projection's vertical scale.
  const k = viewH / (2 * Math.tan((camera.fov * Math.PI) / 360))
  for (const l of labels) {
    l.update?.(dt)
    if (!labels.has(l)) continue
    const p = typeof l.pos === 'function' ? l.pos() : l.pos
    if (!l.visible || !p) {
      if (l.shown) {
        l.el.style.display = 'none'
        l.shown = false
      }
      continue
    }
    const dist = camera.position.distanceTo(p)
    v.copy(p).project(camera)
    const onScreen = v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.3 && Math.abs(v.y) < 1.3
    if (!onScreen || dist > l.maxDist || dist < l.minDist) {
      if (l.shown) {
        l.el.style.display = 'none'
        l.shown = false
      }
      continue
    }
    if (!l.shown) {
      l.el.style.display = ''
      l.shown = true
    }
    const x = (v.x * 0.5 + 0.5) * window.innerWidth
    const y = (-v.y * 0.5 + 0.5) * viewH
    // 100 px of label = l.size m in the world.
    const s = Math.min(l.max, Math.max(l.min, (l.size * k) / (dist * 100)))
    l.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${s.toFixed(3)})`
    l.el.style.zIndex = String(10000 - Math.round(dist))
  }
}

export function setLabelsVisible(on) {
  layer.style.display = on ? '' : 'none'
}
