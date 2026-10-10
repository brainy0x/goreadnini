// readerPrefs.js — reader appearance preferences: presets, fonts, defaults, and the CSS injected into each book page.

import { fontFaceCss } from './readerFonts'

export const PRESETS = {
  paper: { label: 'Paper', bg: '#f7f3ea', text: '#1f1a12', link: '#4a56d6' },
  sepia: { label: 'Sepia', bg: '#efe3c8', text: '#3d2b0e', link: '#9b5030' },
  gray:  { label: 'Gray',  bg: '#d9dbe0', text: '#22242a', link: '#3a49c9' },
  night: { label: 'Night', bg: '#1a1c4e', text: '#e6e8ff', link: '#9aa4ff' },
  black: { label: 'Black', bg: '#000000', text: '#c9ccd6', link: '#8b95f5' },
}

export const FONTS = [
  { id: 'original',     label: 'Original',     stack: null },
  { id: 'literata',     label: 'Literata',     stack: '"Literata", Georgia, serif' },
  { id: 'merriweather', label: 'Merriweather', stack: '"Merriweather", Georgia, serif' },
  { id: 'georgia',      label: 'Georgia',      stack: 'Georgia, "Times New Roman", serif' },
  { id: 'inter',        label: 'Inter',        stack: '"Inter", system-ui, sans-serif' },
  { id: 'opendyslexic', label: 'OpenDyslexic', stack: '"OpenDyslexic", "Comic Sans MS", sans-serif' },
]

export const DEFAULT_PREFS = {
  preset: 'paper',
  bg: '#f7f3ea',
  text: '#1f1a12',
  font: 'literata',
  size: 100,
  lineHeight: 1.7,
  paraSpacing: 0.6,
  margin: 24,
  align: 'left',
  hyphens: false,
  warmth: 0,
  dim: 0,
  autoNight: false,
}

export const APPEARANCE_KEYS = Object.keys(DEFAULT_PREFS)

// Changing any of these changes how pages break, so the book must be re-laid out
export const LAYOUT_KEYS = ['fontStackId', 'size', 'lineHeight', 'paraSpacing', 'margin', 'align', 'hyphens']

export function pickAppearance(obj = {}) {
  const out = {}
  for (const k of APPEARANCE_KEYS) if (obj[k] !== undefined && obj[k] !== null) out[k] = obj[k]
  return out
}

// ── colour helpers ─────────────────────────────────────────────
function parseHex(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function luminance(hex) {
  const rgb = parseHex(hex)
  if (!rgb) return 0
  const [r, g, b] = rgb.map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a, b) {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export const isDarkColor = (hex) => luminance(hex) < 0.35

// Blend colour a toward colour b by t (0..1) -> "#rrggbb"
export function mixColors(a, b, t) {
  const ca = parseHex(a) || [0, 0, 0]
  const cb = parseHex(b) || [255, 255, 255]
  const hex = ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, '0')).join('')
  return `#${hex}`
}

// ── resolve saved prefs into everything the reader needs to draw ─
export function resolvePrefs(prefs, systemDark = false) {
  const p = { ...DEFAULT_PREFS, ...prefs }
  let key = PRESETS[p.preset] || p.preset === 'custom' ? p.preset : 'paper'
  if (p.autoNight && systemDark && key !== 'black' && key !== 'night') key = 'night'

  const preset = PRESETS[key]
  const bg = preset ? preset.bg : (p.bg || PRESETS.paper.bg)
  const text = preset ? preset.text : (p.text || PRESETS.paper.text)
  const dark = isDarkColor(bg)
  const font = FONTS.find(f => f.id === p.font) || FONTS[0]

  return {
    ...p,
    key,
    bg,
    text,
    dark,
    link: preset ? preset.link : (dark ? '#9aa4ff' : '#4a56d6'),
    accent: dark ? '#9aa4ff' : '#4a56d6',
    fontStackId: font.id,
    fontStack: font.stack,
    contrast: contrastRatio(bg, text),
  }
}

export const layoutSignature = (r) => LAYOUT_KEYS.map(k => r[k]).join('|')

// ── CSS injected into every book page ──────────────────────────
export function buildIframeCss(r) {
  const family = r.fontStack ? `font-family: ${r.fontStack} !important;` : ''
  const inherit = r.fontStack ? 'body * { font-family: inherit !important; }' : ''
  const indent = r.paraSpacing >= 0.5 ? 0 : 1.3
  const hyphens = r.hyphens ? 'auto' : 'manual'

  return `
${fontFaceCss()}

html {
  background-color: ${r.bg} !important;
  touch-action: pan-y pinch-zoom;
}

body {
  background-color: ${r.bg} !important;
  color: ${r.text} !important;
  ${family}
  font-size: ${r.size}% !important;
  line-height: ${r.lineHeight} !important;
  text-align: ${r.align === 'justify' ? 'justify' : 'left'} !important;
  hyphens: ${hyphens} !important;
  -webkit-hyphens: ${hyphens} !important;
}

${inherit}

body p, body div, body span, body section, body article, body main, body li,
body blockquote, body h1, body h2, body h3, body h4, body h5, body h6,
body td, body th, body em, body strong, body i, body b {
  color: ${r.text} !important;
  background-color: transparent !important;
}

body p {
  margin-top: 0 !important;
  margin-bottom: ${r.paraSpacing}em !important;
  text-indent: ${indent}em !important;
  orphans: 2;
  widows: 2;
}

body h1, body h2, body h3, body h4, body h5, body h6 {
  text-indent: 0 !important;
  line-height: 1.3 !important;
}

body a, body a * {
  color: ${r.link} !important;
}

img, svg, video {
  max-width: 100% !important;
  height: auto !important;
}

::selection {
  background: ${r.accent}55;
}
`
}

// Apply prefs to one rendered book page (an epubjs Contents object)
export function applyReaderStyle(contents, r) {
  const doc = contents?.document
  if (!doc || !doc.documentElement) return

  const css = buildIframeCss(r)
  let style = doc.getElementById('grn-reader-style')
  if (!style) {
    style = doc.createElement('style')
    style.id = 'grn-reader-style'
    ;(doc.head || doc.documentElement).appendChild(style)
  }
  if (style.textContent !== css) style.textContent = css

  const body = doc.body
  if (body) {
    // epubjs sets inline padding on the body for its columns; override it so margins are ours
    body.style.setProperty('padding', `0 ${r.margin}px`, 'important')
    body.style.setProperty('box-sizing', 'border-box', 'important')
  }
}
