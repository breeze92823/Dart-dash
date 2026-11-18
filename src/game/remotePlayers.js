// The other players in the room, drawn from the server's roster (net.players): their avatar (the
// Bloxity look they sent, else a coloured default), name tag, walking / running on their treadmill,
// carrying an animal overhead, aiming the blowpipe, emotes and chat bubbles. State is decoded in
// place by Colyseus, so each frame just reads it and eases toward the latest pose (~10 Hz).
import * as THREE from 'three'
import { Group, Vector3 } from 'three'
import { ANIMALS, POSES, TREADMILL, WEAPONS } from '../config.js'
import { addLabel } from '../fx/labels.js'
import { buildDefaultCharacter, loadBaseCharacter } from '../avatar/character.js'
import { applyProportions, attachEquippedAccessories, disposeKit, dressWithKit, updateKitLook } from '../avatar/loader.js'
import { composedSkinUrl } from '../avatar/cdn.js'
import { disposeAnimator, makeAnimator } from '../avatar/animator.js'
import { EmotePlayer } from '../avatar/emotes.js'
import { buildAnimal } from './animalModels.js'
import { buildWeapon } from './weapons.js'
import { createAuraFx } from './cosmetics.js'
import { attachChatBubble, chatBubbleText, loadEmotes, validOutfitKey } from '../bloxity.js'
import { net } from '../net.js'

const OUTFITS = [
  { suit: '#2f86ff', legs: '#26324a', hair: '#f2d06a' },
  { suit: '#e8392a', legs: '#2a2a30', hair: '#3a2416' },
  { suit: '#3fc24a', legs: '#4a3a2a', hair: '#1a1a1a' },
  { suit: '#a35be8', legs: '#2a2a40', hair: '#ff8a3a' },
  { suit: '#f2b33a', legs: '#3a2a1a', hair: '#7a4a22' },
  { suit: '#19b8b0', legs: '#233a3a', hair: '#e8e8e8' },
]
const TAU = Math.PI * 2
const EQUIP_KEYS = ['headId', 'torsoId', 'armLId', 'armRId', 'legLId', 'legRId', 'hatId', 'backId', 'hairId', 'maskId', 'neckId', 'chestId', 'waistId', 'handId', 'shoesId', 'faceId', 'pantsId', 'shirtId', 'skinId', 'characterId']
const PROP_KEYS = ['height', 'shoulderWidth', 'armLength', 'legOffsetX', 'torsoScaleX', 'neckHeight', 'headScale']

// The look sent to the others: equipped item IDS and proportions only, never URLs (the receiver
// builds those itself from the ids), plus Boxity's outfit key `k` (one string naming the whole look,
// which the character kit dresses the rig from).
export function packAvatar(equipped, proportions, key = '') {
  if (!equipped || typeof equipped !== 'object') return ''
  const e = {}
  for (const k of EQUIP_KEYS) if (equipped[k] != null && ['string', 'number'].includes(typeof equipped[k])) e[k] = equipped[k]
  const pr = {}
  for (const k of PROP_KEYS) if (Number.isFinite(proportions?.[k])) pr[k] = Math.round(proportions[k] * 1000) / 1000
  return JSON.stringify(validOutfitKey(key) ? { e, p: pr, k: key } : { e, p: pr })
}
function unpackAvatar(json) {
  try {
    const o = JSON.parse(json)
    if (!o || typeof o.e !== 'object') return null
    const e = {}
    for (const k of EQUIP_KEYS) if (['string', 'number'].includes(typeof o.e[k])) e[k] = String(o.e[k]).slice(0, 40)
    const p = {}
    for (const k of PROP_KEYS) if (Number.isFinite(o.p?.[k])) p[k] = o.p[k]
    return { equipped: e, proportions: p, key: validOutfitKey(o.k) ? o.k : '' }
  } catch {
    return null
  }
}

const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b))

export function createRemotePlayers({ scene }) {
  const remotes = new Map() // sessionId -> remote
  const byUid = new Map() // Bloxity user id -> remote (chat bubbles)
  let emotes = new Map()
  loadEmotes().then((list) => (emotes = new Map(list.map((e) => [e.id, e.clip]))))

  function make(sid, p) {
    const group = new Group()
    const r = {
      sid,
      group,
      body: null,
      animator: null,
      emote: null,
      gun: null,
      carried: null,
      carryKey: '',
      aimKey: '',
      avatarKey: '',
      gen: 0,
      pos: group.position,
      yaw: 0,
      speed: 0,
      last: new Vector3(),
      emoteSeq: p.emoteSeq,
      seen: false,
      tag: null,
      slot: p.slot,
      fx: createAuraFx(), // their equipped aura + trail particles (the roster's `aura` / `trail` ids)
    }
    r.emote = new EmotePlayer(() => r.animator?.rig?.bindings ?? [])
    setBody(r, buildDefaultCharacter(OUTFITS[Math.max(0, p.slot) % OUTFITS.length]))
    scene.add(group)
    r.tag = addLabel({ pos: () => new Vector3(r.pos.x, r.pos.y + 2.25, r.pos.z), size: 0.55, min: 0.2, max: 0.6, maxDist: 70, className: 'wl-name', html: '' })
    return r
  }

  function setBody(r, body) {
    if (r.body) {
      r.group.remove(r.body)
      disposeKit(r.body)
    }
    disposeAnimator(r.animator)
    r.body = body
    r.group.add(body)
    r.animator = makeAnimator(body)
    if (r.carryKey) r.animator?.setOverlay(POSES.carry)
    else if (r.aimKey) r.animator?.setOverlay(POSES.aim)
  }

  // Dresses the remote with the Bloxity look they sent (async; stale loads are dropped).
  async function dress(r, json) {
    const look = unpackAvatar(json)
    if (!look) return
    const mine = ++r.gen
    try {
      // Already kit-dressed: switch to the new key in place.
      if (look.key && (await updateKitLook(r.body, look.key))) return
      if (mine !== r.gen || !remotes.has(r.sid)) return
      const body = await loadBaseCharacter()
      if (mine !== r.gen || !remotes.has(r.sid)) return
      if (look.key && (await dressWithKit(body, look.key))) {
        if (mine !== r.gen || !remotes.has(r.sid)) return disposeKit(body)
        setBody(r, body)
        return
      }
      if (mine !== r.gen || !remotes.has(r.sid)) return
      await attachEquippedAccessories(body, look.equipped, { skinTextureUrl: composedSkinUrl(look.equipped) })
      if (mine !== r.gen || !remotes.has(r.sid)) return
      applyProportions(body, look.proportions)
      setBody(r, body)
    } catch (err) {
      console.warn('[remote] dressing failed', err)
    }
  }

  function setCarry(r, key) {
    if (key === r.carryKey) return
    r.carryKey = key
    if (r.carried) {
      r.group.remove(r.carried)
      r.carried = null
    }
    const [species, mu] = key ? key.split(':') : []
    if (species && ANIMALS[species]) {
      r.carried = buildAnimal(species, mu && mu !== '_' ? mu : null)
      r.carried.position.set(0, 2.05, 0)
      r.carried.rotation.y = Math.PI / 2
      r.group.add(r.carried)
      r.animator?.setOverlay(POSES.carry)
    } else if (!r.aimKey) r.animator?.setOverlay(null)
  }

  function setAim(r, on, weapon) {
    const key = on ? weapon || 'blowpipe' : ''
    if (key === r.aimKey) return
    r.aimKey = key
    if (r.gun) {
      r.group.remove(r.gun)
      r.gun = null
    }
    if (key) {
      r.gun = buildWeapon(WEAPONS[key] ? key : 'blowpipe')
      r.gun.position.set(-0.32, 1.25, 0.35)
      r.group.add(r.gun)
      if (!r.carryKey) r.animator?.setOverlay(POSES.aim)
    } else if (!r.carryKey) r.animator?.setOverlay(null)
  }

  function remove(r) {
    r.tag?.remove()
    disposeAnimator(r.animator)
    disposeKit(r.body)
    r.group.removeFromParent()
    r.gen++
    remotes.delete(r.sid)
    for (const [uid, x] of byUid) if (x === r) byUid.delete(uid)
  }

  // A chat message from Bloxity's feed: a bubble over the speaker (matched by the verified user id).
  function onChat(m) {
    if (!m || m.isLocalPlayer) return
    const r = byUid.get(m.userId)
    if (r) attachChatBubble(THREE, r.group, chatBubbleText(m), 2.6)
  }

  return {
    remotes,
    onChat,
    get count() {
      return remotes.size
    },
    // dt, and `hidden`: skip drawing (e.g. the local player is in another world).
    update(dt) {
      const live = new Set()
      net.players((p, sid, me) => {
        if (me) return
        live.add(sid)
        let r = remotes.get(sid)
        if (!r) {
          r = make(sid, p)
          remotes.set(sid, r)
        }
        r.slot = p.slot
        if (p.uid) byUid.set(p.uid, r)
        // Pose: snap the first time, then ease (the server relays ~10 Hz).
        if (!r.seen) {
          r.pos.set(p.x, p.y, p.z)
          r.yaw = p.yaw
          r.last.copy(r.pos)
          r.seen = true
        } else {
          const k = 1 - Math.exp(-12 * dt)
          r.pos.x += (p.x - r.pos.x) * k
          r.pos.y += (p.y - r.pos.y) * k
          r.pos.z += (p.z - r.pos.z) * k
          r.yaw += angleDiff(p.yaw, r.yaw) * k
        }
        r.group.rotation.y = r.yaw
        const moved = Math.hypot(r.pos.x - r.last.x, r.pos.z - r.last.z) / Math.max(dt, 1e-3)
        r.last.copy(r.pos)
        r.speed += (Math.min(moved, 16) - r.speed) * Math.min(1, dt * 8)
        const name = p.username || 'Player'
        if (r.tag.name !== name) {
          r.tag.name = name
          r.tag.html = name.replace(/[<>&"]/g, '')
        }
        if (p.avatar !== r.avatarKey) {
          r.avatarKey = p.avatar
          if (p.avatar) dress(r, p.avatar)
        }
        setCarry(r, p.carry)
        setAim(r, p.aim, p.weapon)

        // Emotes: a new sequence number plays the clip; moving stops it.
        if (p.emoteSeq !== r.emoteSeq) {
          r.emoteSeq = p.emoteSeq
          r.emote.play(p.emote, emotes.get(p.emote))
        }
        // On their treadmill (`tm`) they run in place even when standing still.
        const animSpeed = p.tm ? Math.max(r.speed, TREADMILL.runAnim) : r.speed
        if (animSpeed > 1.5 && r.emote.playing) r.emote.stop()

        r.animator?.update(dt, { grounded: true, speed: animSpeed > 0.4 ? animSpeed : 0, verticalVelocity: 0, turn: 0 })
        r.emote.update(dt)
        r.fx.update(dt, r.pos, { trail: p.trail, aura: p.aura, moving: r.speed > 1.5, visible: r.group.visible })
      })
      for (const r of [...remotes.values()]) if (!live.has(r.sid)) remove(r)
    },
    // Where a remote stands, for a treadmill's runner: { x, y, z, facing, speed } or null.
    runnerOf(slot) {
      for (const r of remotes.values()) if (r.slot === slot) return { x: r.pos.x, y: r.pos.y, z: r.pos.z, facing: r.yaw, speed: r.speed }
      return null
    },
    clear() {
      for (const r of [...remotes.values()]) remove(r)
    },
  }
}
