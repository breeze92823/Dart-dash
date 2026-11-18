// The green barrier across the far (north) end of the lane: a glowing force field between two
// pylons, solid to the player and to darts, with a big sign naming the next area and the gun
// that opens it (main.js calls `show` whenever the world or the owned weapons change).
import { DoubleSide, Mesh, PlaneGeometry, ShaderMaterial } from 'three'
import { BARRIER, LANE } from '../config.js'
import { solidBox } from '../propkit.js'
import { block, mat, signText } from './kit.js'
import { textBoard } from './props.js'

const FIELD = {
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform float time; uniform vec2 size; varying vec2 vUv;
    void main(){
      vec2 p = vUv * size;
      float stripe = smoothstep(0.35, 0.5, abs(fract((p.x + p.y) / 6.0 - time * 0.35) - 0.5));
      float scan = smoothstep(0.92, 1.0, fract(vUv.y * 3.0 - time * 0.4));
      float edge = pow(1.0 - vUv.y, 6.0) * 0.7 + smoothstep(0.93, 1.0, vUv.y) * 0.9;
      float shimmer = 0.5 + 0.5 * sin(p.x * 0.7 + time * 2.0) * sin(p.y * 0.9 - time * 1.3);
      vec3 col = mix(vec3(0.1, 0.62, 0.18), vec3(0.8, 1.0, 0.62), stripe * 0.6 + scan * 0.5 + edge * 0.6);
      float a = 0.3 + stripe * 0.14 + scan * 0.16 + edge * 0.35 + shimmer * 0.05;
      gl_FragColor = vec4(col, clamp(a, 0.0, 0.85));
    }`,
}

// Padlock drawn on the sign canvas (fonts may lack an emoji).
function lock(ctx, x, y, s, color) {
  ctx.lineWidth = s * 0.16
  ctx.strokeStyle = '#1a1a1a'
  ctx.beginPath()
  ctx.arc(x, y - s * 0.15, s * 0.32, Math.PI, 0)
  ctx.lineTo(x + s * 0.32, y + s * 0.1)
  ctx.moveTo(x - s * 0.32, y + s * 0.1)
  ctx.lineTo(x - s * 0.32, y - s * 0.15)
  ctx.stroke()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(x - s * 0.5, y, s, s * 0.78, s * 0.12)
  ctx.fill()
  ctx.lineWidth = s * 0.08
  ctx.stroke()
  ctx.fillStyle = '#1a1a1a'
  ctx.beginPath()
  ctx.arc(x, y + s * 0.34, s * 0.09, 0, Math.PI * 2)
  ctx.fill()
}

// info: { area, locked, gun, price, img (an Image of the gun or null), final }
function drawSign(ctx, w, h, info = null) {
  ctx.fillStyle = '#123a1c'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = info?.locked === false ? '#2f86ff' : '#3fc24a'
  ctx.fillRect(0, 0, w, h * 0.24)
  ctx.strokeStyle = '#8dff6a'
  ctx.lineWidth = 12
  ctx.strokeRect(6, 6, w - 12, h - 12)
  if (!info) return
  const top = h * 0.12
  if (info.final) {
    signText(ctx, 'FINAL AREA', w / 2, top, { size: 70, width: 12 })
    signText(ctx, 'YOU REACHED THE END OF THE WILDS!', w / 2, h * 0.58, { size: 62, color: '#ffe36a', width: 12, maxWidth: w - 80 })
    return
  }
  if (!info.locked) {
    signText(ctx, `NEXT AREA: ${info.area}`, w / 2, top, { size: 70, width: 12 })
    signText(ctx, `${info.area} IS OPEN!`, w / 2, h * 0.5, { size: 92, color: '#8dff6a', width: 14, maxWidth: w - 80 })
    signText(ctx, 'TRAVEL THERE THROUGH THE PORTAL', w / 2, h * 0.78, { size: 54, width: 10, maxWidth: w - 80 })
    return
  }
  lock(ctx, w * 0.07, top - 34, 56, '#ffd23f')
  lock(ctx, w * 0.93, top - 34, 56, '#ffd23f')
  signText(ctx, `NEXT AREA: ${info.area}`, w / 2, top, { size: 70, width: 12 })
  const textX = info.img ? w * 0.6 : w / 2
  const textW = info.img ? w * 0.62 : w - 80
  if (info.img) {
    const iw = w * 0.3
    const ih = iw * (info.img.height / info.img.width || 0.6)
    ctx.drawImage(info.img, w * 0.05, h * 0.62 - ih / 2, iw, ih)
  }
  signText(ctx, 'BUY THE', textX, h * 0.38, { size: 50, width: 10 })
  signText(ctx, info.gun, textX, h * 0.56, { size: 84, color: '#ffe36a', width: 14, maxWidth: textW })
  signText(ctx, `TO REACH ${info.area} · $${info.price} AT THE ARMORY`, textX, h * 0.8, { size: 44, width: 9, maxWidth: textW })
}

export function buildBarrier(scene) {
  const W = LANE.maxX - LANE.minX
  const H = BARRIER.height
  const z = BARRIER.z
  const field = new ShaderMaterial({
    ...FIELD,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: { time: { value: 0 }, size: { value: [W, H] } },
  })
  const wall = new Mesh(new PlaneGeometry(W, H), field)
  wall.position.set((LANE.minX + LANE.maxX) / 2, LANE.y + H / 2, z)
  wall.renderOrder = 2
  scene.add(wall)
  // Pylons at the ends and every so often, with a glowing rail along the top and bottom.
  const glow = mat('#7dff6a', { emissive: '#3fff4a', ei: 0.35, studs: false })
  const post = mat('#2b6b34', { rough: 0.6 })
  for (let i = 0; i <= 4; i++) {
    const x = LANE.minX + (W * i) / 4
    block(scene, 1.6, H + 1, 1.6, post, x, LANE.y + (H + 1) / 2, z)
    block(scene, 2.2, 1, 2.2, glow, x, LANE.y + H + 1.3, z)
  }
  block(scene, W, 0.5, 0.5, glow, (LANE.minX + LANE.maxX) / 2, LANE.y + H, z)
  block(scene, W, 0.4, 0.8, glow, (LANE.minX + LANE.maxX) / 2, LANE.y + 0.2, z, { shadow: false })
  // Solid to the player, animals' runs and darts.
  solidBox(W / 2, H / 2 + 4, 0.6, (LANE.minX + LANE.maxX) / 2, LANE.y + H / 2 + 4, z)

  const S = BARRIER.sign
  const sign = textBoard(scene, 0, LANE.y + S.y, z + 1.4, 0, S.w, S.h, 420, drawSign, { frame: '#3fc24a', depth: 0.6, posts: 0 })
  for (const sx of [-S.w * 0.38, S.w * 0.38]) block(sign.group, 0.8, S.y, 0.8, '#2b6b34', sx, -S.y / 2, -0.2)

  let last = null
  const redraw = () => sign.redraw(last)
  document.fonts?.load?.('64px "Luckiest Guy"').then(redraw, () => null)
  return {
    wall,
    show(info) {
      last = info
      redraw()
      // The gun picture arrives as a data URL; redraw once it has decoded.
      if (info?.imgSrc && !info.img) {
        const img = new Image()
        img.onload = () => {
          if (last === info) {
            info.img = img
            redraw()
          }
        }
        img.src = info.imgSrc
      }
    },
    update(elapsed) {
      field.uniforms.time.value = elapsed
    },
  }
}
