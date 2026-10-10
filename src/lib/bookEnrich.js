// bookEnrich.js — best-effort summary/cover/pages/language for a book.
// Never throws and never blocks upload or reading: every step is time-limited and failures are swallowed.

import { lookupBook } from './bookLookup'
import { displayBook } from './bookDisplay'
import { getFile } from './fileStorage'
import { extractEpubCover, shrinkCoverBlob } from './epubCover'
import { localizeCover, isRemoteCover } from './coverCache'

const FIELDS = ['description', 'cover_url', 'pages_total', 'language', 'genre', 'public_rating']
const inFlight = new Set()

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])

const stripHtml = (s = '') => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

// Just the cover, straight from the epub's zip (fast, no epub.js)
async function readCoverOnly(file) {
  const blob = await extractEpubCover(await file.arrayBuffer())
  return blob ? shrinkCoverBlob(blob) : ''
}

// Description, language, author and cover from inside the epub
async function readEpub(file) {
  const buffer = await file.arrayBuffer()
  const patch = {}

  try {
    const blob = await extractEpubCover(buffer)
    if (blob) patch.cover_url = await shrinkCoverBlob(blob)
  } catch { /* fall back to epub.js below */ }

  const mod = await import('epubjs')
  const ePub = mod.default ?? mod.ePub ?? mod
  const eb = await ePub(buffer, { encoding: 'binary' })
  try {
    await eb.ready
    const meta = eb.packaging?.metadata || {}
    const desc = stripHtml(meta.description)
    if (desc.length > 40) patch.description = desc
    if (meta.language) patch.language = String(meta.language).split('-')[0]
    if (meta.creator) patch.lookup_author = meta.creator

    if (!patch.cover_url) {
      try {
        const coverUrl = await eb.coverUrl()
        if (coverUrl) {
          const blob = await (await fetch(coverUrl)).blob()
          patch.cover_url = await shrinkCoverBlob(blob)
        }
      } catch { /* cover is optional */ }
    }
  } finally {
    try { eb.destroy() } catch { /* ignore */ }
  }
  return patch
}

async function safeEpub(file) {
  if (!file) return {}
  try { return await withTimeout(readEpub(file), 30000) } catch { return {} }
}

async function safeOnline(title, author) {
  try { return { patch: await withTimeout(lookupBook(title, author), 15000), failed: false } }
  catch { return { patch: {}, failed: true } }
}

/**
 * Gathers whatever it can for `book`. Pass `file` when you already hold the file (upload),
 * or `loadFile` to fetch it lazily only if the online sources leave gaps.
 * With `coverOnly`, it looks only for a cover: the book file first, then Open Library.
 * Returns { patch, complete } where `complete` is false if the network lookup failed.
 */
export async function gatherBookInfo(book, { file, loadFile, coverOnly } = {}) {
  const { title, author } = displayBook(book)

  if (coverOnly) {
    let cover = ''
    let source = file || null
    if (!source && loadFile) {
      try { source = await withTimeout(loadFile(), 60000) } catch { source = null }
    }
    if (source) {
      try { cover = await withTimeout(readCoverOnly(source), 30000) } catch { cover = '' }
    }
    if (!cover) {
      const online = await safeOnline(title, author)
      cover = online.patch.cover_url || ''
    }
    return { patch: cover ? { cover_url: cover } : {}, complete: true }
  }

  let patch = {}
  let failed = false

  if (file) patch = await safeEpub(file)

  if (!patch.description || !patch.cover_url || !book.pages_total) {
    const online = await safeOnline(title, author)
    failed = online.failed
    patch = { ...online.patch, ...patch, description: patch.description || online.patch.description, cover_url: patch.cover_url || online.patch.cover_url }
  }

  if (!file && loadFile && (!book.description && !patch.description || !book.cover_url && !patch.cover_url)) {
    try {
      const f = await withTimeout(loadFile(), 60000)
      const fromFile = await safeEpub(f)
      patch = { ...patch, ...fromFile, description: patch.description || fromFile.description, cover_url: fromFile.cover_url || patch.cover_url }
    } catch { /* file unavailable — fine */ }
  }

  return { patch, complete: !failed }
}

/**
 * Fetch info and save only the fields the book is still missing. Safe to call without awaiting.
 * Resolves to the fields that were saved (or undefined if nothing ran).
 */
export async function enrichBook(book, updateBook, opts = {}) {
  if (!book || inFlight.has(book.id)) return undefined
  inFlight.add(book.id)
  try {
    const { patch, complete } = await gatherBookInfo(book, opts)
    const updates = {}
    for (const k of FIELDS) if (patch[k] && !book[k]) updates[k] = patch[k]
    if (patch.lookup_author && !book.author) updates.author = patch.lookup_author
    // a cover found online is downloaded and stored with the book, so it works offline and syncs
    if (updates.cover_url && isRemoteCover(updates.cover_url)) updates.cover_url = await localizeCover(updates.cover_url)
    if (opts.coverOnly) {
      // remember that we looked, so we don't download the file again on every launch
      updates.cover_checked = true
    } else if (complete) {
      // only mark done when the lookup actually ran, so offline attempts retry later
      updates.lookup_done = true
    }
    if (Object.keys(updates).length) {
      const stamp = book.updated_at ? { updated_at: book.updated_at } : {}
      await updateBook(book.id, { ...updates, ...stamp })
    }
    return updates
  } catch (e) {
    console.warn('[enrich] skipped:', e)
    return undefined
  } finally {
    inFlight.delete(book.id)
  }
}

export const lazyFileLoader = (book) =>
  book.file_path && book.file_type === 'epub'
    ? async () => (await getFile(book.file_path)).file
    : undefined
