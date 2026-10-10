// buildPuppy.js — Anabelle as a plush-style 3D puppy, built from soft rounded shapes.
// Returns { root, update(state, t, dt) }. `update` poses her for a mood and moves her a little every frame.
//
// Moods: 'idle', 'reading', 'studying', 'cheer'

import * as THREE from 'three'

const C = {
  fur: '#f19b22',
  cream: '#fff1d6',
  ear: '#8c4a21',
  earInner: '#b87444',
  nose: '#3a1d0e',
  eye: '#24120a',
  blush: '#ff9fa8',
  collar: '#7c88ee',
  tag: '#f2c14e',
  book: '#4a50c8',
  page: '#fffaf0',
  line: '#9aa0d8',
  tongue: '#f0788a',
  mouth: '#6b2230',
  glasses: '#3a43b0',
}

// A matte "plush" material. `fuzz` adds a soft glowing edge so the surface looks furry.
function plush(color, { fuzz = 0, rim = '#ffe2b0', roughness = 0.9, ...rest } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...rest })
  if (fuzz > 0) {
    const c = new THREE.Color(rim)
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         float fuzzEdge = pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), 2.3);
         totalEmissiveRadiance += vec3(${c.r.toFixed(3)}, ${c.g.toFixed(3)}, ${c.b.toFixed(3)}) * fuzzEdge * ${fuzz.toFixed(2)};`
      )
    }
  }
  return m
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// A soft heart / star picture for the floating sparkles
function symbolTexture(kind) {
  const canvas = document.createElement('canvas')
  canvas.width = 96
  canvas.height = 96
  const ctx = canvas.getContext('2d')
  ctx.translate(48, 50)
  if (kind === 'heart') {
    ctx.fillStyle = '#ff6f8e'
    ctx.beginPath()
    ctx.moveTo(0, 26)
    ctx.bezierCurveTo(-46, -6, -24, -40, 0, -16)
    ctx.bezierCurveTo(24, -40, 46, -6, 0, 26)
    ctx.fill()
  } else {
    ctx.fillStyle = '#ffd84a'
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2
      const r = i % 2 === 0 ? 34 : 9
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// Tiny random specks used as a bump map, so the plush surface looks fuzzy instead of smooth
function furBumpTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 5200; i++) {
    const shade = 60 + Math.floor(Math.random() * 140)
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`
    ctx.beginPath()
    ctx.arc(Math.random() * size, Math.random() * size, 0.8 + Math.random() * 1.8, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(5, 4)
  return tex
}

function shadowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62)
  g.addColorStop(0, 'rgba(0,0,0,.55)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(canvas)
}

export function buildPuppy() {
  const root = new THREE.Group()
  const unit = new THREE.SphereGeometry(1, 48, 32)

  const grain = furBumpTexture()
  const furMat = plush(C.fur, { fuzz: 0.42, bumpMap: grain, bumpScale: 1.6 })
  const creamMat = plush(C.cream, { fuzz: 0.3, rim: '#ffffff', bumpMap: grain, bumpScale: 1.2 })
  const earMat = plush(C.ear, { fuzz: 0.4, rim: '#e0a070', bumpMap: grain, bumpScale: 1.6 })
  const earInnerMat = plush(C.earInner, { roughness: 0.95 })
  const noseMat = new THREE.MeshStandardMaterial({ color: C.nose, roughness: 0.3, metalness: 0.1 })
  const eyeMat = new THREE.MeshStandardMaterial({ color: C.eye, roughness: 0.12, metalness: 0.2 })
  const shineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' })
  const pinkMat = plush(C.blush, { roughness: 0.95 })
  const collarMat = plush(C.collar, { roughness: 0.7 })
  const tagMat = new THREE.MeshStandardMaterial({ color: C.tag, roughness: 0.35, metalness: 0.5 })
  const dark = new THREE.MeshStandardMaterial({ color: C.nose, roughness: 0.6 })

  const ball = (mat, rx, ry, rz, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(unit, mat)
    m.scale.set(rx, ry, rz)
    m.position.set(x, y, z)
    return m
  }

  // ── ground shadow ──
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 2.2),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false })
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.set(0, -1.3, 0.2)
  root.add(shadow)

  const pup = new THREE.Group()   // everything that jumps and squashes
  root.add(pup)

  // ── body, belly, legs ──
  const body = ball(furMat, 1.0, 1.15, 0.92, 0, -0.05, 0)
  const belly = ball(creamMat, 0.66, 0.86, 0.42, 0, -0.14, 0.62)
  pup.add(body, belly)
  for (const s of [-1, 1]) {
    pup.add(ball(furMat, 0.55, 0.52, 0.6, s * 0.8, -0.62, 0.05))
    pup.add(ball(creamMat, 0.3, 0.17, 0.46, s * 0.84, -1.12, 0.5))
  }

  // ── arms (shoulder pivots so they can raise) ──
  function makeArm(side) {
    const pivot = new THREE.Group()
    pivot.position.set(side * 0.66, 0.62, 0.6)
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.55, 8, 16), furMat)
    limb.position.y = -0.45
    const paw = ball(creamMat, 0.29, 0.26, 0.3, 0, -0.9, 0.04)
    const pad = ball(pinkMat, 0.13, 0.1, 0.05, 0, -0.04, 0.26)
    const toes = [-0.13, 0, 0.13].map((dx, i) => ball(pinkMat, 0.045, 0.045, 0.04, dx, 0.09 + (i === 1 ? 0.04 : 0), 0.27))
    paw.add(pad, ...toes)
    pivot.add(limb, paw)
    return pivot
  }
  const armL = makeArm(-1)
  const armR = makeArm(1)
  pup.add(armL, armR)

  // ── tail ──
  const tail = new THREE.Group()
  tail.position.set(0.55, -0.7, -0.72)
  const tailBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.7, 8, 16), furMat)
  tailBody.position.y = 0.5
  const tailTip = ball(creamMat, 0.25, 0.25, 0.25, 0, 1.02, 0)
  tail.add(tailBody, tailTip)
  pup.add(tail)

  // ── collar ──
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.1, 14, 40), collarMat)
  collar.rotation.x = Math.PI / 2 + 0.18
  collar.position.set(0, 0.72, 0.12)
  const tag = ball(tagMat, 0.13, 0.13, 0.05, 0, 0.6, 0.86)
  pup.add(collar, tag)

  // ── head ──
  const head = new THREE.Group()
  head.position.set(0, 1.05, 0.15)
  pup.add(head)

  head.add(ball(furMat, 1.1, 0.98, 1.02, 0, 0.55, 0))                  // skull
  head.add(ball(creamMat, 0.52, 0.4, 0.45, 0, 0.22, 0.88))             // muzzle
  // white blaze: a thin vertical strip of a slightly larger sphere, so it follows the curve of her head
  const blaze = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, Math.PI / 2 - 0.2, 0.4, 0.38, 0.72), creamMat)
  blaze.scale.set(1.115, 0.992, 1.034)
  blaze.position.set(0, 0.55, 0)
  head.add(blaze)
  head.add(ball(noseMat, 0.16, 0.115, 0.1, 0, 0.38, 1.28))             // nose
  head.add(ball(shineMat, 0.045, 0.025, 0.02, -0.04, 0.42, 1.36))      // nose shine
  for (const s of [-1, 1]) {
    head.add(ball(creamMat, 0.12, 0.075, 0.03, s * 0.44, 1.0, 0.82))    // eyebrow spots
    const blush = new THREE.Mesh(
      new THREE.CircleGeometry(0.21, 28),
      new THREE.MeshBasicMaterial({ color: C.blush, transparent: true, opacity: 0.5, depthWrite: false })
    )
    blush.position.set(s * 0.76, 0.27, 0.69)
    blush.rotation.y = s * 0.85
    head.add(blush)
  }

  // eyes (glossy beads with two highlights) that can blink and look around
  const eyes = []
  for (const s of [-1, 1]) {
    const eye = new THREE.Group()
    eye.position.set(s * 0.44, 0.72, 0.9)
    eye.add(ball(eyeMat, 0.2, 0.225, 0.14))
    eye.add(ball(shineMat, 0.075, 0.075, 0.05, 0.07, 0.08, 0.1))
    eye.add(ball(shineMat, 0.036, 0.036, 0.03, -0.06, -0.08, 0.1))
    head.add(eye)
    eyes.push(eye)
  }

  // mouth: a gentle smile, or open with a tongue when she is happy
  const smile = new THREE.Group()
  for (const s of [-1, 1]) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.027, 8, 20, Math.PI), dark)
    arc.rotation.z = Math.PI
    arc.position.set(s * 0.12, 0.15, 1.31)
    smile.add(arc)
  }
  head.add(smile)
  const openMouth = new THREE.Group()
  openMouth.position.set(0, 0.16, 1.3)
  const mouthBowl = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: C.mouth, roughness: 0.6, side: THREE.DoubleSide }))
  mouthBowl.scale.set(0.27, 0.3, 0.12)
  openMouth.add(mouthBowl, ball(new THREE.MeshStandardMaterial({ color: C.tongue, roughness: 0.5 }), 0.15, 0.1, 0.07, 0, -0.17, 0.05))
  head.add(openMouth)

  // floppy ears that swing from the top of the head
  function makeEar(side) {
    const pivot = new THREE.Group()
    pivot.position.set(side * 1.0, 1.0, -0.08)
    pivot.add(ball(earMat, 0.36, 0.8, 0.23, side * 0.14, -0.64, 0))
    pivot.add(ball(earInnerMat, 0.2, 0.5, 0.12, side * 0.16, -0.62, 0.12))
    return pivot
  }
  const earL = makeEar(-1)
  const earR = makeEar(1)
  head.add(earL, earR)

  // glasses (studying)
  const glasses = new THREE.Group()
  for (const s of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.04, 12, 36), new THREE.MeshStandardMaterial({ color: C.glasses, roughness: 0.35, metalness: 0.2 }))
    ring.position.set(s * 0.44, 0.72, 1.0)
    glasses.add(ring)
  }
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), new THREE.MeshStandardMaterial({ color: C.glasses }))
  bridge.rotation.z = Math.PI / 2
  bridge.position.set(0, 0.74, 1.0)
  glasses.add(bridge)
  head.add(glasses)

  // ── a book held at her chest ──
  const book = new THREE.Group()
  book.position.set(0, -0.2, 1.0)
  book.rotation.x = -0.22
  const cover = new THREE.Mesh(new THREE.BoxGeometry(1.62, 1.1, 0.1), new THREE.MeshStandardMaterial({ color: C.book, roughness: 0.6 }))
  book.add(cover)
  for (const s of [-1, 1]) {
    const page = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.96, 0.05), new THREE.MeshStandardMaterial({ color: C.page, roughness: 0.9 }))
    page.position.set(s * 0.39, 0, 0.07)
    page.rotation.y = -s * 0.1
    book.add(page)
    for (let i = 0; i < 4; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.01), new THREE.MeshBasicMaterial({ color: C.line }))
      line.position.set(s * 0.4, 0.28 - i * 0.18, 0.105)
      book.add(line)
    }
  }
  pup.add(book)

  // ── floating hearts and stars when she is happy ──
  const fx = new THREE.Group()
  const heartTex = symbolTexture('heart')
  const starTex = symbolTexture('star')
  const sprites = Array.from({ length: 9 }, (_, i) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: i % 3 === 0 ? heartTex : starTex, transparent: true, depthWrite: false }))
    sprite.userData.phase = i / 9
    sprite.userData.angle = (i / 9) * Math.PI * 2
    fx.add(sprite)
    return sprite
  })
  root.add(fx)

  // ── animation state ──
  const cur = { armsUp: 0, book: 0, glasses: 0, happy: 0 }
  const look = { x: 0, y: 0 }

  function update({ mood = 'idle', pointer = { x: 0, y: 0 }, poke = 0 }, t, dt) {
    const k = 1 - Math.exp(-dt * 8)
    const cheer = mood === 'cheer'
    const excited = cheer || poke > 0
    const reading = mood === 'reading' || mood === 'studying'
    const ease = (key, target) => { cur[key] += (target - cur[key]) * k }
    ease('armsUp', cheer ? 1 : 0)
    ease('book', reading ? 1 : 0)
    ease('glasses', mood === 'studying' ? 1 : 0)
    ease('happy', excited ? 1 : 0)
    look.x += (pointer.x - look.x) * k * 0.6
    look.y += (pointer.y - look.y) * k * 0.6

    // jumping (cheering or when poked) with a little squash and stretch
    const hop = cheer ? Math.abs(Math.sin(t * 5.2)) : poke > 0 ? Math.abs(Math.sin(t * 9)) * Math.min(1, poke) * 0.6 : 0
    pup.position.y = hop * 0.42
    const squash = 1 - hop
    pup.scale.set(1 + 0.05 * squash, 1 - 0.06 * squash, 1 + 0.05 * squash)
    shadow.scale.setScalar(1 - hop * 0.35)
    shadow.material.opacity = 1 - hop * 0.4

    // breathing
    body.scale.y = 1.15 * (1 + 0.018 * Math.sin(t * 1.7))
    belly.scale.y = 0.86 * (1 + 0.02 * Math.sin(t * 1.7))

    // head: tilts, follows the pointer, nods when reading
    head.rotation.y = look.x * 0.36 + Math.sin(t * 0.7) * 0.06
    head.rotation.x = -look.y * 0.2 + cur.book * 0.2 + Math.sin(t * 0.9) * 0.03
    head.rotation.z = Math.sin(t * 0.9) * 0.05 - look.x * 0.04 + (excited ? Math.sin(t * 6) * 0.06 : 0)

    // eyes: look around, blink, squint with joy
    const phase = t % 4.7
    const blink = phase > 4.55 ? Math.sin(((phase - 4.55) / 0.15) * Math.PI) : 0
    for (const eye of eyes) {
      eye.scale.y = (1 - blink * 0.93) * (1 - cur.happy * 0.72)
      eye.position.y = 0.72 - cur.happy * 0.04 + look.y * -0.02
      eye.children.forEach(c => { c.position.x += 0 })
    }
    eyes[0].position.x = -0.44 + look.x * 0.035
    eyes[1].position.x = 0.44 + look.x * 0.035

    // mouth
    smile.scale.setScalar(Math.max(0.001, 1 - cur.happy))
    openMouth.scale.setScalar(Math.max(0.001, cur.happy))

    // ears flap
    const flap = excited ? Math.sin(t * 11) * 0.2 : 0
    earL.rotation.z = -(0.4 + 0.07 * Math.sin(t * 1.3) + 0.08 * Math.sin(t * 2.1 + 1) + flap)
    earR.rotation.z = 0.4 + 0.07 * Math.sin(t * 1.3 + 0.8) + 0.08 * Math.sin(t * 2.3) + flap
    earL.rotation.x = Math.sin(t * 1.1) * 0.05
    earR.rotation.x = Math.sin(t * 1.1 + 1) * 0.05

    // tail wag (gentle, then fast when happy)
    const wagAmount = excited ? 0.6 : 0.22 + 0.2 * (0.5 + 0.5 * Math.sin(t * 0.45))
    tail.rotation.z = -0.8 + Math.sin(t * (excited ? 17 : 5.5)) * wagAmount
    tail.rotation.x = -0.35

    // arms: down, holding the book, or up in the air
    const wave = Math.sin(t * 8) * 0.14 * cur.armsUp
    armL.rotation.z = (-0.12 + Math.sin(t * 1.1) * 0.02) * (1 - cur.armsUp) + (-2.55 + wave) * cur.armsUp
    armR.rotation.z = (0.12 - Math.sin(t * 1.1) * 0.02) * (1 - cur.armsUp) + (2.55 - wave) * cur.armsUp
    armL.rotation.x = armR.rotation.x = cur.book * -0.18

    // props fade in and out
    book.visible = cur.book > 0.04
    book.scale.setScalar(Math.max(0.01, cur.book))
    book.position.y = -0.18 + Math.sin(t * 1.4) * 0.015
    glasses.visible = cur.glasses > 0.04
    glasses.scale.setScalar(Math.max(0.01, cur.glasses))

    // hearts and stars drift up around her head
    fx.visible = cur.happy > 0.05
    sprites.forEach((sprite, i) => {
      const life = (t * 0.55 + sprite.userData.phase) % 1
      const a = sprite.userData.angle + t * 0.6
      sprite.position.set(Math.cos(a) * 1.9, 1.2 + life * 2.2, Math.sin(a) * 0.9 + 0.8)
      const s = (0.28 + 0.2 * Math.sin(life * Math.PI)) * (i % 3 === 0 ? 1 : 0.85)
      sprite.scale.set(s, s, s)
      sprite.material.opacity = Math.sin(life * Math.PI) * clamp(cur.happy, 0, 1)
    })
  }

  return { root, update }
}

// The lighting that makes her look soft and warm (used by every 3D view of her)
export function addPuppyLights(scene) {
  scene.add(new THREE.HemisphereLight('#fff1de', '#c8a070', 1.0))
  const key = new THREE.DirectionalLight('#ffffff', 2.2)
  key.position.set(3, 5, 6)
  const fill = new THREE.DirectionalLight('#ffd7b0', 0.7)
  fill.position.set(-4, 1, 4)
  const rim = new THREE.DirectionalLight('#a9b6ff', 1.5)
  rim.position.set(-3, 3, -4)
  scene.add(key, fill, rim)
}
