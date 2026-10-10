// bookDisplay.js — tidy up titles/authors that came from raw filenames and generate fallback covers

export function displayBook(book) {
  const raw = (book.title || '').replace(/OceanofPDF\.com/gi, '').trim()
  const parts = raw.split(/\s{3,}/).map(p => p.trim()).filter(Boolean)
  let title = raw
  let author = (book.author || '').trim()
  if (parts.length > 1 && !author) {
    author = parts[parts.length - 1]
    title = parts.slice(0, -1).join(' ')
  } else if (parts.length > 1) {
    title = parts.join(' ')
  }
  title = title.replace(/\s{2,}/g, ' ').trim() || 'Untitled'
  return { title, author }
}

const PALETTES = [
  ['#0f766e', '#134e4a'],
  ['#1d4ed8', '#1e1b4b'],
  ['#b45309', '#7c2d12'],
  ['#7e22ce', '#3b0764'],
  ['#be123c', '#4c0519'],
  ['#0e7490', '#164e63'],
  ['#4d7c0f', '#1a2e05'],
  ['#c2410c', '#431407'],
]

export function coverGradient(seed = '') {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const [a, b] = PALETTES[h % PALETTES.length]
  return `linear-gradient(155deg, ${a} 0%, ${b} 100%)`
}

// Which decorative pattern a generated cover gets (0–4), stable per title
export function coverPattern(seed = '') {
  let h = 7
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0
  return h % 5
}
