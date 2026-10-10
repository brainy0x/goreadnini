// pupPortrait.js — renders Anabelle's face in 3D once and hands back a picture of it,
// so small spots (like the header button) get the 3D look without running a 3D scene.
import * as THREE from 'three'
import { buildPuppy, addPuppyLights } from '../components/pup3d/buildPuppy'

let renderer = null
let scene = null
let camera = null
let puppy = null
const cache = new Map()

export function renderPortrait(mood = 'idle') {
  if (cache.has(mood)) return cache.get(mood)

  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(1)
    renderer.setSize(256, 256)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60)
    camera.position.set(0, 1.95, 7.1)
    camera.lookAt(0, 1.8, 0)
    addPuppyLights(scene)
    puppy = buildPuppy()
    scene.add(puppy.root)
  }

  puppy.update({ mood, pointer: { x: 0, y: 0 }, poke: 0 }, mood === 'cheer' ? 1.05 : 1.3, 1)
  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL('image/png')
  cache.set(mood, url)
  return url
}
