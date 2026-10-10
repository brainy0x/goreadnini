import { useEffect, useRef } from 'react'
import { useAppTheme } from '../contexts/AppThemeContext'
import { GLITTER_LEVELS } from '../lib/appThemes'

// Soft glitter behind the whole app: tiny sparkles that drift upward and twinkle. The colours follow the
// theme and the amount comes from Settings. Light on purpose: one canvas at ~30 fps, paused when the tab
// is hidden, and still if motion is reduced.

export default function GlitterBackground() {
  const canvasRef = useRef(null)
  const { prefs, glitterColors } = useAppTheme()
  const amount = GLITTER_LEVELS.find(l => l.id === prefs.glitter)?.amount ?? 1

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || amount <= 0) return undefined

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let w = 0
    let h = 0
    let sparkles = []
    let raf = 0
    let last = 0

    const make = () => {
      const count = Math.round(Math.min(180, Math.max(78, (w * h) / 8500)) * amount)
      sparkles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.55 + Math.random() * 1.2,
        big: Math.random() < 0.1,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 1.6,
        rise: 2 + Math.random() * 7,
        color: glitterColors[Math.floor(Math.random() * glitterColors.length)],
      }))
    }

    const draw = (t) => {
      ctx.clearRect(0, 0, w, h)
      for (const s of sparkles) {
        // sharp, short twinkles rather than a smooth pulse
        const twinkle = reduceMotion ? 0.5 : Math.pow(Math.max(0, Math.sin(t * s.speed + s.phase)), 5)
        const alpha = 0.14 + twinkle * 0.86
        const y = (((s.y - t * s.rise) % h) + h) % h

        if (s.big) {
          const size = 2.4 + twinkle * 5
          ctx.fillStyle = `rgba(${s.color},${alpha * 0.14})`
          ctx.beginPath()
          ctx.arc(s.x, y, size * 1.7, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = `rgba(${s.color},${alpha})`
          ctx.beginPath()
          ctx.moveTo(s.x, y - size)
          ctx.quadraticCurveTo(s.x, y, s.x + size, y)
          ctx.quadraticCurveTo(s.x, y, s.x, y + size)
          ctx.quadraticCurveTo(s.x, y, s.x - size, y)
          ctx.quadraticCurveTo(s.x, y, s.x, y - size)
          ctx.fill()
        } else {
          ctx.fillStyle = `rgba(${s.color},${alpha})`
          ctx.beginPath()
          ctx.arc(s.x, y, s.r, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      make()
      if (reduceMotion) draw(1)
    }

    resize()
    window.addEventListener('resize', resize)

    if (!reduceMotion) {
      const loop = (now) => {
        raf = requestAnimationFrame(loop)
        if (document.hidden || now - last < 33) return
        last = now
        draw(now / 1000)
      }
      raf = requestAnimationFrame(loop)
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [amount, glitterColors])

  if (amount <= 0) return null
  return <canvas ref={canvasRef} className="glitter" aria-hidden="true" />
}
