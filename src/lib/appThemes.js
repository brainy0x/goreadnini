// appThemes.js — app-wide colour themes. Every surface colour is worked out from the current Indigo design
// by turning its hue, so each preset keeps the same look. An optional custom accent colour overrides the highlight.

const STORAGE_KEY = 'grn_app_theme'

export const THEME_ORDER = ['indigo', 'midnight', 'rose', 'forest', 'ocean', 'sunset']

// dh: how far to turn the hue away from indigo; ds: how colourful the backgrounds are
export const THEMES = {
  indigo:   { label: 'Indigo',   dh: 0,    ds: 1,    accent: '#8b95f5' },
  midnight: { label: 'Midnight', dh: -15,  ds: 0.5,  accent: '#6ea8ff' },
  rose:     { label: 'Rose',     dh: 88,   ds: 0.85, accent: '#f58bc0' },
  forest:   { label: 'Forest',   dh: -82,  ds: 0.8,  accent: '#5fd9a3' },
  ocean:    { label: 'Ocean',    dh: -45,  ds: 0.9,  accent: '#4fd8e6' },
  sunset:   { label: 'Sunset',   dh: 141,  ds: 0.8,  accent: '#ff9a62' },
}

export const GLITTER_LEVELS = [
  { id: 'off', label: 'Off', amount: 0 },
  { id: 'light', label: 'Light', amount: 0.5 },
  { id: 'normal', label: 'Normal', amount: 1 },
  { id: 'lots', label: 'Lots', amount: 1.8 },
]

export const DEFAULT_APP_THEME = { theme: 'indigo', accent: '', glitter: 'normal' }

// the Indigo surfaces every theme is derived from
const BASE = {
  bgG1: '#14153d', bgG2: '#1f2260', bgG3: '#101234',
  surfA: '#2a2c7c', surfB: '#1a1c4e', surfC: '#121339',
  sideA: '#232679', sideB: '#181a49',
  card: '#23266a', cardHover: '#2c3080', crimson: '#2b2d78',
  text: '#f3f4ff', textSoft: '#c4c8f0', textMuted: '#98a0dc',
}

// ── colour maths ──
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim())
  const n = parseInt(m ? m[1] : '000000', 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toHex = ([r, g, b]) => `#${[r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('')}`

function rgbToHsl([r, g, b]) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return [0, 0, l]
  const s = d / (1 - Math.abs(2 * l - 1))
  let h
  if (max === rn) h = ((gn - bn) / d) % 6
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return [(h * 60 + 360) % 360, s, l]
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}

const turn = (hex, dh, ds) => {
  const [h, s, l] = rgbToHsl(hexToRgb(hex))
  return toHex(hslToRgb((h + dh + 360) % 360, clamp(s * ds, 0, 1), l))
}

const mix = (a, b, t) => {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  return toHex(ca.map((v, i) => v + (cb[i] - v) * t))
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const rgbText = (hex) => hexToRgb(hex).join(',')
const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v || '')

/** All the CSS variables for a theme (plus the colours the glitter uses). */
export function buildThemeVars({ theme = 'indigo', accent = '' } = {}) {
  const preset = THEMES[theme] || THEMES.indigo
  const t = (hex) => turn(hex, preset.dh, preset.ds)

  const main = isHex(accent) ? accent : preset.accent
  const [h, s, l] = rgbToHsl(hexToRgb(main))
  const light = mix(main, '#ffffff', 0.35)
  const dim = mix(main, '#000000', 0.12)
  const strong = toHex(hslToRgb(h, clamp(s - 0.05, 0, 1), clamp(l - 0.12, 0.15, 1)))

  const bgG1 = t(BASE.bgG1)
  const bgG2 = t(BASE.bgG2)
  const bgG3 = t(BASE.bgG3)
  const surfA = t(BASE.surfA)
  const surfB = t(BASE.surfB)
  const surfC = t(BASE.surfC)
  // text on the accent colour: whichever of dark/white is easier to read
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05)
  const onAccent = contrast(main, bgG1) >= contrast(main, '#ffffff') ? bgG1 : '#ffffff'

  const vars = {
    '--accent': main,
    '--accent-light': light,
    '--accent-strong': strong,
    '--accent-rgb': rgbText(main),
    '--accent-light-rgb': rgbText(light),
    '--accent-strong-rgb': rgbText(strong),

    '--gold': main,
    '--gold-light': light,
    '--gold-dim': dim,
    '--crimson': t(BASE.crimson),
    '--crimson-light': light,
    '--ink': onAccent,

    '--bg-g1': bgG1, '--bg-g2': bgG2, '--bg-g3': bgG3,
    '--bg-g1-rgb': rgbText(bgG1), '--bg-g3-rgb': rgbText(bgG3),
    '--surf-a': surfA, '--surf-b': surfB, '--surf-c': surfC,
    '--surf-b-rgb': rgbText(surfB),
    '--side-a': t(BASE.sideA), '--side-b': t(BASE.sideB),

    '--bg-deep': bgG1,
    '--bg-dark': surfB,
    '--bg-card': t(BASE.card),
    '--bg-card-hover': t(BASE.cardHover),
    '--bg-panel': `linear-gradient(160deg, ${surfA} 0%, ${surfB} 60%, ${surfC} 100%)`,

    '--border': `rgba(${rgbText(light)}, 0.14)`,
    '--border-bright': `rgba(${rgbText(light)}, 0.32)`,
    '--text-primary': t(BASE.text),
    '--text-secondary': t(BASE.textSoft),
    '--text-muted': t(BASE.textMuted),
  }

  return {
    vars,
    themeColor: bgG1,
    glitterColors: ['255,255,255', rgbText(light), rgbText(main), '255,217,138'],
  }
}

export function applyAppTheme(prefs) {
  if (typeof document === 'undefined') return
  const { vars, themeColor } = buildThemeVars(prefs)
  const root = document.documentElement
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor)
}

export function readStoredAppTheme() {
  try { return { ...DEFAULT_APP_THEME, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } }
  catch { return { ...DEFAULT_APP_THEME } }
}

export function storeAppTheme(prefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)) } catch { /* storage full */ }
}

// Apply the saved theme before the app draws, so there is no flash of the wrong colours
export function applyStoredAppTheme() {
  applyAppTheme(readStoredAppTheme())
}
