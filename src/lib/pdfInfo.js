// pdfInfo.js — what we can learn from a PDF file: is it one, how many pages, who wrote it, and a cover.

import { loadPdfjs } from './pdfjs'

/** True if the file starts with the PDF signature (more reliable than the file name or type). */
export async function isPdfBlob(blob) {
  try {
    const head = await blob.slice(0, 5).text()
    return head.startsWith('%PDF')
  } catch {
    return false
  }
}

/** Resolves to { pages_total, lookup_author?, cover_url? } (page 1 becomes the cover). Never rejects for a bad cover. */
export async function readPdfInfo(blob) {
  const pdfjs = await loadPdfjs()
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) })
  try {
    const doc = await task.promise
    const info = { pages_total: doc.numPages }

    try {
      const meta = await doc.getMetadata()
      const author = meta?.info?.Author
      if (typeof author === 'string' && author.trim()) info.lookup_author = author.trim()
    } catch { /* metadata is optional */ }

    try {
      const page = await doc.getPage(1)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: 320 / base.width })
      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvas, viewport }).promise
      info.cover_url = canvas.toDataURL('image/jpeg', 0.8)
    } catch { /* no cover */ }

    return info
  } finally {
    try { await task.destroy() } catch { /* already gone */ }
  }
}
