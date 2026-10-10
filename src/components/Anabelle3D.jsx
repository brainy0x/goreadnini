import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { buildPuppy, addPuppyLights } from './pup3d/buildPuppy'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// Anabelle in 3D. She follows your finger/cursor with her head, and tapping her makes her hop and wag.
// If WebGL isn't available she is replaced by `fallback` (the flat drawing).
// `staticTime` draws a single still frame at that moment (used for previews and reduced motion).
export default function Anabelle3D({ mood = 'idle', size = 150, fallback = null, staticTime }) {
  const hostRef = useRef(null)
  const moodRef = useRef(mood)
  const pokeRef = useRef(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => { moodRef.current = mood }, [mood])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    } catch {
      setFailed(true)
      return undefined
    }

    const width = size
    const height = Math.round(size * 1.06)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(width, height)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 60)
    camera.position.set(0, 0.75, 10.4)
    camera.lookAt(0, 0.7, 0)

    addPuppyLights(scene)

    const puppy = buildPuppy()
    scene.add(puppy.root)

    const pointer = { x: 0, y: 0 }
    const onMove = (e) => {
      const rect = host.getBoundingClientRect()
      pointer.x = clamp((e.clientX - (rect.left + rect.width / 2)) / 320, -1, 1)
      pointer.y = clamp((e.clientY - (rect.top + rect.height / 2)) / 320, -1, 1)
    }

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let observer = null
    let visible = true

    if (staticTime !== undefined || reduceMotion) {
      // one still frame: snap into pose, draw once
      puppy.update({ mood: moodRef.current, pointer, poke: 0 }, staticTime ?? 1.2, 1)
      renderer.render(scene, camera)
    } else {
      window.addEventListener('pointermove', onMove, { passive: true })
      observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting })
      observer.observe(host)

      let t = 0
      let last = performance.now()
      const loop = (now) => {
        raf = requestAnimationFrame(loop)
        if (!visible || document.hidden) { last = now; return }
        const dt = Math.min(0.05, (now - last) / 1000)
        last = now
        t += dt
        pokeRef.current = Math.max(0, pokeRef.current - dt)
        puppy.update({ mood: moodRef.current, pointer, poke: pokeRef.current }, t, dt)
        renderer.render(scene, camera)
      }
      raf = requestAnimationFrame(loop)
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      observer?.disconnect()
      scene.traverse((obj) => {
        obj.geometry?.dispose?.()
        const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : []
        mats.forEach((m) => { m.map?.dispose?.(); m.dispose?.() })
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [size, staticTime])

  if (failed) return fallback

  return (
    <div
      ref={hostRef}
      className="an3d"
      style={{ width: size, height: Math.round(size * 1.06) }}
      onPointerDown={() => { pokeRef.current = 1.4 }}
      role="img"
      aria-label="Anabelle the puppy"
    />
  )
}
