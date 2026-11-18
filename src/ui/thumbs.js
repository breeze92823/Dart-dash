// Portraits of the 3D models for the windows (Index, Zoo, Shop): each model is
// rendered once in a small offscreen renderer and cached as a data URL.
import { AmbientLight, DirectionalLight, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer, Box3, Vector3, ACESFilmicToneMapping } from 'three'
import { buildAnimal } from '../game/animalModels.js'
import { buildWeapon } from '../game/weapons.js'

let r = null
let scene = null
let cam = null
const cache = new Map()

function setup() {
  if (r) return true
  try {
    r = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  } catch {
    return false
  }
  r.setSize(200, 170, false)
  r.setPixelRatio(1)
  r.outputColorSpace = SRGBColorSpace
  r.toneMapping = ACESFilmicToneMapping
  r.toneMappingExposure = 1.15
  scene = new Scene()
  scene.add(new AmbientLight('#ffffff', 1.4))
  const sun = new DirectionalLight('#ffffff', 2.4)
  sun.position.set(3, 5, 4)
  scene.add(sun)
  cam = new PerspectiveCamera(30, 200 / 170, 0.1, 100)
  return true
}

function shoot(obj, yaw = -0.6, pitch = 0.18, fit = 0.62) {
  if (!setup()) return ''
  obj.rotation.y = yaw
  scene.add(obj)
  obj.updateMatrixWorld(true)
  const box = new Box3().setFromObject(obj)
  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  const radius = Math.max(size.x, size.y, size.z) * fit
  const dist = radius / Math.tan((cam.fov * Math.PI) / 360)
  cam.position.set(center.x, center.y + dist * Math.sin(pitch), center.z + dist * Math.cos(pitch))
  cam.lookAt(center)
  r.render(scene, cam)
  const url = r.domElement.toDataURL('image/png')
  scene.remove(obj)
  return url
}

export function animalThumb(species, mutation = null) {
  const key = `a:${species}:${mutation ?? ''}`
  if (!cache.has(key)) cache.set(key, shoot(buildAnimal(species, mutation)))
  return cache.get(key)
}

export function weaponThumb(id, skin = 'classic') {
  const key = `w:${id}:${skin}`
  if (!cache.has(key)) cache.set(key, shoot(buildWeapon(id, skin), -1.45, 0.22, 0.4))
  return cache.get(key)
}
