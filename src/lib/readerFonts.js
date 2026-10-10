// readerFonts.js — reader fonts bundled with the app (works offline once installed as a PWA).
// The same @font-face rules are injected into the page and into every book iframe.

import lit400 from '@fontsource/literata/files/literata-latin-400-normal.woff2?url'
import lit400i from '@fontsource/literata/files/literata-latin-400-italic.woff2?url'
import lit700 from '@fontsource/literata/files/literata-latin-700-normal.woff2?url'
import mer400 from '@fontsource/merriweather/files/merriweather-latin-400-normal.woff2?url'
import mer400i from '@fontsource/merriweather/files/merriweather-latin-400-italic.woff2?url'
import mer700 from '@fontsource/merriweather/files/merriweather-latin-700-normal.woff2?url'
import int400 from '@fontsource/inter/files/inter-latin-400-normal.woff2?url'
import int400i from '@fontsource/inter/files/inter-latin-400-italic.woff2?url'
import int700 from '@fontsource/inter/files/inter-latin-700-normal.woff2?url'
import dys400 from '@fontsource/opendyslexic/files/opendyslexic-latin-400-normal.woff2?url'
import dys400i from '@fontsource/opendyslexic/files/opendyslexic-latin-400-italic.woff2?url'
import dys700 from '@fontsource/opendyslexic/files/opendyslexic-latin-700-normal.woff2?url'

const FACES = [
  ['Literata', 400, 'normal', lit400],
  ['Literata', 400, 'italic', lit400i],
  ['Literata', 700, 'normal', lit700],
  ['Merriweather', 400, 'normal', mer400],
  ['Merriweather', 400, 'italic', mer400i],
  ['Merriweather', 700, 'normal', mer700],
  ['Inter', 400, 'normal', int400],
  ['Inter', 400, 'italic', int400i],
  ['Inter', 700, 'normal', int700],
  ['OpenDyslexic', 400, 'normal', dys400],
  ['OpenDyslexic', 400, 'italic', dys400i],
  ['OpenDyslexic', 700, 'normal', dys700],
]

// Absolute URLs so the rules also resolve inside blob:/srcdoc iframes
const abs = (url) => {
  try { return new URL(url, window.location.origin).href } catch { return url }
}

let cached = null
export function fontFaceCss() {
  if (!cached) {
    cached = FACES.map(([family, weight, style, url]) =>
      `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};font-display:swap;src:url("${abs(url)}") format("woff2");}`
    ).join('\n')
  }
  return cached
}

// Make the fonts available to the reader's own UI (settings preview etc.)
export function ensurePageFonts() {
  if (typeof document === 'undefined' || document.getElementById('rd-page-fonts')) return
  const style = document.createElement('style')
  style.id = 'rd-page-fonts'
  style.textContent = fontFaceCss()
  document.head.appendChild(style)
}
