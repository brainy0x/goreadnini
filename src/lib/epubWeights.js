// epubWeights.js — reading progress without epub.js's slow "locations" index.
//
// We read the epub's zip once, find the reading order, and measure how much text each chapter
// holds. Progress is then: text in the chapters before this one + how far through this chapter
// you are (epub.js tells us the page number within the current chapter).

import JSZip from 'jszip'

const textLength = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim().length

const safeDecode = (s) => { try { return decodeURI(s) } catch { return s } }
const normalize = (href = '') => safeDecode(href).split('#')[0].replace(/^\.?\//, '')

// "OEBPS/content.opf" + "../Text/ch1.xhtml" -> "Text/ch1.xhtml" inside the zip
function resolveInZip(opfDir, href) {
  const url = new URL(href, `http://epub.local/${opfDir}`)
  return safeDecode(url.pathname.replace(/^\//, ''))
}

/**
 * Returns { items: [{ href, norm, start, weight }], total } in reading order, or null if the
 * book's structure can't be read. `href` is exactly as written in the book's manifest, which is
 * what epub.js uses to look pages up.
 */
export async function readSpineWeights(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer)

  const containerFile = zip.file('META-INF/container.xml')
  if (!containerFile) return null
  const container = new DOMParser().parseFromString(await containerFile.async('string'), 'application/xml')
  const opfPath = container.querySelector('rootfile')?.getAttribute('full-path')
  const opfFile = opfPath && zip.file(opfPath)
  if (!opfFile) return null

  const opf = new DOMParser().parseFromString(await opfFile.async('string'), 'application/xml')
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : ''

  const manifest = {}
  opf.querySelectorAll('manifest > item').forEach((item) => {
    manifest[item.getAttribute('id')] = item.getAttribute('href')
  })

  const items = []
  let total = 0
  const refs = [...opf.querySelectorAll('spine > itemref')]
  for (let i = 0; i < refs.length; i++) {
    const href = manifest[refs[i].getAttribute('idref')]
    if (!href) continue
    const entry = zip.file(resolveInZip(opfDir, href)) || zip.file(resolveInZip(opfDir, encodeURI(href)))
    let weight = 0
    if (entry) {
      try { weight = textLength(await entry.async('string')) } catch { weight = 0 }
    }
    items.push({ href, norm: normalize(href), start: total, weight })
    total += weight
    // keep the page responsive while a long book is measured
    if (i % 20 === 19) await new Promise(resolve => setTimeout(resolve, 0))
  }

  return total > 0 ? { items, total } : null
}

function findItemIndex(weights, start) {
  const href = normalize(start.href)
  let i = weights.items.findIndex(it => it.norm === href)
  if (i < 0 && href) {
    i = weights.items.findIndex(it => it.norm && (it.norm.endsWith(href) || href.endsWith(it.norm)))
  }
  if (i < 0 && typeof start.index === 'number' && start.index < weights.items.length) i = start.index
  return i
}

/** Whole-number percent (0–100) for an epub.js location start, or null if it can't be placed. */
export function progressFromLocation(weights, start) {
  if (!weights || !start) return null
  const idx = findItemIndex(weights, start)
  if (idx < 0) return null

  const item = weights.items[idx]
  const d = start.displayed
  let fraction = 0
  if (d && d.total > 0) fraction = Math.min(1, Math.max(0, (d.page - 1) / d.total))

  let pct = Math.round(((item.start + fraction * item.weight) / weights.total) * 100)
  // the last page of the last chapter means the book is finished
  if (idx === weights.items.length - 1 && d && d.total > 0 && d.page >= d.total) pct = 100
  return Math.min(100, Math.max(0, pct))
}

/** The chapter that holds `percent` of the way through the book: { href, index }. */
export function locationForProgress(weights, percent) {
  if (!weights) return null
  const pos = (Math.min(100, Math.max(0, percent)) / 100) * weights.total
  let found = -1
  for (let i = 0; i < weights.items.length; i++) {
    const it = weights.items[i]
    if (it.weight > 0 && pos >= it.start && pos < it.start + it.weight) { found = i; break }
  }
  if (found < 0) {
    for (let i = weights.items.length - 1; i >= 0; i--) if (weights.items[i].weight > 0) { found = i; break }
  }
  return found < 0 ? null : { href: weights.items[found].href, index: found }
}
