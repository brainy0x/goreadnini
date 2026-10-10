// epubCover.js — pull the cover image out of an epub, however the book declares it.
//
// Books vary a lot, so we try the places a cover can live, best first:
//   1. the EPUB3 "cover-image" manifest property
//   2. the EPUB2 <meta name="cover"> pointer
//   3. the <guide> cover reference (usually a cover page that holds the image)
//   4. any manifest image named like "cover"
//   5. the first image on the book's first pages
//   6. the biggest of the first few images
// Each candidate is checked to look like a cover (not a tiny logo or a wide banner).

import JSZip from 'jszip'

const safeDecode = (s) => { try { return decodeURI(s) } catch { return s } }
const dirOf = (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '')
const resolvePath = (baseDir, href) => safeDecode(new URL(href, `http://epub.local/${baseDir}`).pathname.replace(/^\//, ''))
const isRaster = (type, path) => /^image\/(jpeg|png|gif|webp)/i.test(type || '') || /\.(jpe?g|png|gif|webp)$/i.test(path || '')
const isPage = (type, path) => /x?html/i.test(type || '') || /\.(xhtml|html?)$/i.test(path || '')

function mimeFor(path) {
  if (/\.png$/i.test(path)) return 'image/png'
  if (/\.gif$/i.test(path)) return 'image/gif'
  if (/\.webp$/i.test(path)) return 'image/webp'
  return 'image/jpeg'
}

async function readImage(zip, path, type) {
  const entry = zip.file(path)
  if (!entry) return null
  const data = await entry.async('uint8array')
  if (!data.length) return null
  return new Blob([data], { type: type && type.startsWith('image/') ? type : mimeFor(path) })
}

// The first <img> / <image> an (x)html page points at, as a path inside the zip
async function imageInPage(zip, pagePath) {
  const entry = zip.file(pagePath)
  if (!entry) return null
  const doc = new DOMParser().parseFromString(await entry.async('string'), 'text/html')
  const el = doc.querySelector('img[src]') || doc.querySelector('image')
  const ref = el && (el.getAttribute('src') || el.getAttribute('xlink:href') || el.getAttribute('href'))
  if (!ref || ref.startsWith('data:')) return null
  return resolvePath(dirOf(pagePath), ref.split('#')[0])
}

/** Does this image look like a book cover? (big enough, not a wide banner) */
export async function looksLikeCover(blob) {
  try {
    const bitmap = await createImageBitmap(blob)
    const ok = bitmap.width >= 150 && bitmap.height >= 200 && bitmap.height >= bitmap.width * 0.9
    bitmap.close?.()
    return ok
  } catch {
    return false
  }
}

/** Shrink an image to a small JPEG data URL so it can live in the book record. */
export async function shrinkCoverBlob(blob, maxWidth = 320) {
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, maxWidth / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return canvas.toDataURL('image/jpeg', 0.8)
}

/** Returns the cover as a Blob, or null if the book has no usable image. */
export async function extractEpubCover(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer)

  const containerFile = zip.file('META-INF/container.xml')
  if (!containerFile) return null
  const container = new DOMParser().parseFromString(await containerFile.async('string'), 'application/xml')
  const opfPath = container.querySelector('rootfile')?.getAttribute('full-path')
  const opfFile = opfPath && zip.file(opfPath)
  if (!opfFile) return null

  const opf = new DOMParser().parseFromString(await opfFile.async('string'), 'application/xml')
  const opfDir = dirOf(opfPath)

  const items = [...opf.querySelectorAll('manifest > item')].map((el) => ({
    id: el.getAttribute('id'),
    href: el.getAttribute('href') || '',
    type: el.getAttribute('media-type') || '',
    props: el.getAttribute('properties') || '',
    path: resolvePath(opfDir, el.getAttribute('href') || ''),
  }))
  const byId = Object.fromEntries(items.map(i => [i.id, i]))

  // An item can be the image itself, or a page that holds it
  const viaItem = async (item) => {
    if (!item) return null
    if (isRaster(item.type, item.path)) return readImage(zip, item.path, item.type)
    if (isPage(item.type, item.path)) {
      const img = await imageInPage(zip, item.path)
      return img ? readImage(zip, img) : null
    }
    return null
  }

  const spineIds = [...opf.querySelectorAll('spine > itemref')].map(r => r.getAttribute('idref'))
  const metaCoverId = opf.querySelector('metadata > meta[name="cover"]')?.getAttribute('content')
  const guideHref = opf.querySelector('guide > reference[type="cover"]')?.getAttribute('href')

  const candidates = [
    () => viaItem(items.find(i => /\bcover-image\b/.test(i.props))),
    () => viaItem(byId[metaCoverId]),
    async () => {
      if (!guideHref) return null
      const path = resolvePath(opfDir, guideHref.split('#')[0])
      if (isPage('', path)) {
        const img = await imageInPage(zip, path)
        return img ? readImage(zip, img) : null
      }
      return isRaster('', path) ? readImage(zip, path) : null
    },
    () => viaItem(items.find(i => isRaster(i.type, i.path) && /cover/i.test(`${i.id} ${i.href}`))),
    async () => {
      for (const id of spineIds.slice(0, 3)) {
        const item = byId[id]
        if (!item || !isPage(item.type, item.path)) continue
        const img = await imageInPage(zip, item.path)
        const blob = img ? await readImage(zip, img) : null
        if (blob && await looksLikeCover(blob)) return blob
      }
      return null
    },
    async () => {
      let best = null
      for (const item of items.filter(i => isRaster(i.type, i.path)).slice(0, 12)) {
        const blob = await readImage(zip, item.path, item.type)
        if (blob && (!best || blob.size > best.size)) best = blob
      }
      return best
    },
  ]

  for (const attempt of candidates) {
    try {
      const blob = await attempt()
      if (blob && await looksLikeCover(blob)) return blob
    } catch { /* try the next place */ }
  }
  return null
}
