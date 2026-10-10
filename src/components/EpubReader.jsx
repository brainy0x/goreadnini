import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Bookmark, List, SlidersHorizontal, Copy, Quote as QuoteIcon, Download } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import { useToast } from '../contexts/ToastContext'
import { getFile } from '../lib/fileStorage'
import { displayEpubTarget, flattenToc, isInternalHref } from '../lib/epubNavigation'
import { displayBook, categoryOf } from '../lib/bookDisplay'
import { usePomodoro } from '../contexts/PomodoroContext'
import PomodoroChip from './PomodoroChip'
import { DEFAULT_PREFS, pickAppearance, resolvePrefs, layoutSignature, applyReaderStyle, mixColors } from '../lib/readerPrefs'
import { ensurePageFonts } from '../lib/readerFonts'
import DefaultViewManager from 'epubjs/src/managers/default/index'
import IframeView from 'epubjs/src/managers/views/iframe'
import EpubCFI from 'epubjs/src/utils/epubcfi'
import { readSpineWeights, progressFromLocation, locationForProgress } from '../lib/epubWeights'
import ReaderSettings from './reader/ReaderSettings'
import ReaderDrawer from './reader/ReaderDrawer'
import { HIGHLIGHT_COLORS } from '../lib/highlightColors'
import '../reader.css'

const CHARS_PER_MINUTE = 1200    // ~220 words per minute

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

const readLocalPrefs = () => {
  try { return JSON.parse(localStorage.getItem('grn_reader_prefs') || '{}') } catch { return {} }
}

// Choose where to open: whichever of the synced position / this device's position is newer
function pickStartCfi(book) {
  let local = null
  try {
    const raw = localStorage.getItem(`grn_loc_${book.id}`)
    if (raw) local = raw.startsWith('epubcfi') ? { cfi: raw, t: 0 } : JSON.parse(raw)
  } catch { local = null }
  const remoteTime = book.last_read_at ? Date.parse(book.last_read_at) : 0
  if (book.last_cfi && (!local || remoteTime > (local.t || 0))) return book.last_cfi
  return local?.cfi || book.last_cfi || undefined
}

export default function EpubReader({ book, onClose }) {
  const {
    books, bookmarks, highlights, readerPrefs,
    updateBook, addHighlight, deleteHighlight, addBookmark, deleteBookmark, addQuote, addSession, saveReaderPrefs,
  } = useBooks()
  const toast = useToast()

  const liveBook = books.find(b => b.id === book.id) || book
  const { title: bookTitle, author: bookAuthor } = displayBook(liveBook)
  const academic = categoryOf(liveBook) === 'academic'
  const pomo = usePomodoro()
  const myBookmarks = useMemo(() => bookmarks.filter(b => b.book_id === book.id), [bookmarks, book.id])
  const myHighlights = useMemo(() => highlights.filter(h => h.book_id === book.id), [highlights, book.id])
  const profiles = readerPrefs?.profiles || []

  // ── refs ──────────────────────────────────────────────────────
  const viewerRef       = useRef(null)
  const renditionRef    = useRef(null)
  const bookRef         = useRef(null)
  const blobUrlRef      = useRef(null)
  const tocRef          = useRef([])
  const curStartCfiRef  = useRef('')
  const progressRef     = useRef(book.progress || 0)
  const weightsRef      = useRef(null)   // chapter sizes, used to turn "which page" into a percentage
  const layoutSigRef    = useRef('')
  const uiVisibleRef    = useRef(true)
  const keyHandlerRef   = useRef(() => {})
  const latestBookRef   = useRef(liveBook)
  const highlightsRef   = useRef(myHighlights)
  const fnsRef          = useRef({})
  const pendingSaveRef  = useRef(null)
  const saveTimerRef    = useRef(null)
  const relayoutTimer   = useRef(null)
  const relayoutBusy    = useRef(false)
  const relayoutPending = useRef(false)
  const persistTimer    = useRef(null)
  const prefsDirtyRef   = useRef(false)
  const activeSecRef    = useRef(0)
  const lastActivityRef = useRef(0)
  const sessionSavedRef = useRef(false)
  const scrubRef        = useRef(null)

  // Keep these refs current for callbacks that outlive a render. A layout effect runs right after
  // render and before the reader's other effects, so they are always set by the time they're used.
  useLayoutEffect(() => {
    latestBookRef.current = liveBook
    highlightsRef.current = myHighlights
    fnsRef.current = { updateBook, addHighlight, deleteHighlight, addBookmark, deleteBookmark, addQuote, addSession, saveReaderPrefs, toast, onClose }
  })

  // ── preferences ───────────────────────────────────────────────
  const [prefs, setPrefs] = useState(() => ({
    ...DEFAULT_PREFS,
    ...pickAppearance(readLocalPrefs()),
    ...pickAppearance(readerPrefs || {}),
    ...pickAppearance(liveBook.reader_prefs || {}),
  }))
  const [bookOnly, setBookOnly] = useState(() => !!liveBook.reader_prefs)
  const prefsRef = useRef(prefs)
  const bookOnlyRef = useRef(bookOnly)

  const [systemDark, setSystemDark] = useState(
    () => (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) || false
  )
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const handler = (e) => setSystemDark(e.matches)
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [])

  const resolved = useMemo(() => resolvePrefs(prefs, systemDark), [prefs, systemDark])
  const resolvedRef = useRef(resolved)
  useLayoutEffect(() => { resolvedRef.current = resolved }, [resolved])

  // ── UI state ──────────────────────────────────────────────────
  const [uiVisible, setUiVisible]       = useState(true)
  const [sheet, setSheet]               = useState(null) // 'settings' | 'drawer' | null
  const [loading, setLoading]           = useState(true)
  const [loadMsg, setLoadMsg]           = useState('Opening your book...')
  const [error, setError]               = useState(null)
  const [isPdf, setIsPdf]               = useState(false)
  const [pdfBlobUrl, setPdfBlobUrl]     = useState(null)
  const [fileBlob, setFileBlob]         = useState(null)
  const [tocItems, setTocItems]         = useState([])
  const [progress, setProgress]         = useState(book.progress || 0)
  const [chapterTitle, setChapterTitle] = useState('')
  const [range, setRange]               = useState({ start: '', end: '' })
  const [locsReady, setLocsReady]       = useState(false)
  const [locsTotal, setLocsTotal]       = useState(0)
  const [scrub, setScrub]               = useState(null)
  const [selMenu, setSelMenu]           = useState(null)
  const [hlMenu, setHlMenu]             = useState(null)

  const setUi = useCallback((v) => { uiVisibleRef.current = v; setUiVisible(v) }, [])
  const markActivity = useCallback(() => { lastActivityRef.current = Date.now() }, [])

  useEffect(() => { ensurePageFonts() }, [])

  // Release any orientation lock so the OS decides (kept from the previous reader)
  useEffect(() => {
    const id = setTimeout(() => {
      try { window.screen?.orientation?.unlock?.() } catch { /* nothing locked */ }
    }, 100)
    return () => clearTimeout(id)
  }, [])

  // Hide the toolbars shortly after opening so the page is what you see
  useEffect(() => {
    if (loading) return
    const id = setTimeout(() => setUi(false), 3500)
    return () => clearTimeout(id)
  }, [loading, setUi])

  // ── saving progress / position (debounced) ────────────────────
  const flushProgress = useCallback(() => {
    clearTimeout(saveTimerRef.current)
    const pending = pendingSaveRef.current
    if (!pending) return
    pendingSaveRef.current = null
    const update = { last_cfi: pending.cfi, last_read_at: new Date().toISOString() }
    // only write a percentage once we've actually worked one out, so we never overwrite it with a guess
    if (typeof pending.progress === 'number') update.progress = pending.progress
    fnsRef.current.updateBook(book.id, update)
  }, [book.id])

  const queueSave = useCallback((cfi, pct) => {
    try { localStorage.setItem(`grn_loc_${book.id}`, JSON.stringify({ cfi, t: Date.now() })) } catch { /* storage full */ }
    pendingSaveRef.current = { cfi, progress: pct }
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(flushProgress, 2500)
  }, [book.id, flushProgress])


  // Reaching the end marks the book Finished (once per opening)
  const finishedRef = useRef(false)
  const maybeFinish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    const current = latestBookRef.current
    if (current.shelf === 'finished') return
    fnsRef.current.updateBook(book.id, { shelf: 'finished', date_finished: new Date().toISOString().split('T')[0], progress: 100 })
    fnsRef.current.toast(`Finished “${displayBook(current).title}” ✦`, 'success')
  }, [book.id])

  // ── reading-time tracking for Stats ───────────────────────────
  useEffect(() => {
    lastActivityRef.current = Date.now()
    const id = setInterval(() => {
      if (!document.hidden && Date.now() - lastActivityRef.current < 120000) activeSecRef.current += 5
    }, 5000)
    return () => clearInterval(id)
  }, [])

  const flushSession = useCallback(() => {
    if (sessionSavedRef.current) return
    const minutes = Math.floor(activeSecRef.current / 60)
    if (minutes < 1) return
    sessionSavedRef.current = true
    fnsRef.current.addSession({ book_id: book.id, minutes, pages_read: 0 })
  }, [book.id])

  const flushPrefs = useCallback(() => {
    clearTimeout(persistTimer.current)
    if (!prefsDirtyRef.current) return
    prefsDirtyRef.current = false
    const full = pickAppearance(prefsRef.current)
    if (bookOnlyRef.current) {
      const update = { reader_prefs: full }
      if (latestBookRef.current.updated_at) update.updated_at = latestBookRef.current.updated_at
      fnsRef.current.updateBook(book.id, update)
    } else {
      try { localStorage.setItem('grn_reader_prefs', JSON.stringify(full)) } catch { /* storage full */ }
      fnsRef.current.saveReaderPrefs(full)
    }
  }, [book.id])

  const handleClose = useCallback(() => {
    flushProgress()
    flushSession()
    flushPrefs()
    fnsRef.current.onClose()
  }, [flushProgress, flushSession, flushPrefs])

  const updatePrefs = useCallback((patch) => {
    const next = { ...prefsRef.current, ...patch }
    prefsRef.current = next
    setPrefs(next)
    prefsDirtyRef.current = true
    clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(flushPrefs, 700)
  }, [flushPrefs])

  const toggleBookOnly = useCallback((on) => {
    setBookOnly(on)
    bookOnlyRef.current = on
    const keepStamp = latestBookRef.current.updated_at ? { updated_at: latestBookRef.current.updated_at } : {}
    if (on) {
      prefsDirtyRef.current = true
      flushPrefs()
    } else {
      fnsRef.current.updateBook(book.id, { reader_prefs: null, ...keepStamp })
      const global = { ...DEFAULT_PREFS, ...pickAppearance(readLocalPrefs()), ...pickAppearance(readerPrefs || {}) }
      prefsRef.current = global
      setPrefs(global)
    }
  }, [book.id, flushPrefs, readerPrefs])

  const saveProfile = (name) => {
    const item = { id: crypto.randomUUID(), name, prefs: pickAppearance(prefsRef.current) }
    saveReaderPrefs({ profiles: [...profiles, item] })
    toast(`Saved “${name}”`, 'success')
  }
  const deleteProfile = (id) => saveReaderPrefs({ profiles: profiles.filter(p => p.id !== id) })
  const applyProfile = (p) => updatePrefs({ ...pickAppearance(p.prefs) })

  // ── re-lay out pages (needed when font/spacing/margins change) ─
  const scheduleRelayout = useCallback(() => {
    clearTimeout(relayoutTimer.current)
    relayoutTimer.current = setTimeout(async () => {
      const r = renditionRef.current
      if (!r) return
      if (relayoutBusy.current) { relayoutPending.current = true; return }
      relayoutBusy.current = true
      try {
        r.clear()
        await r.display(curStartCfiRef.current || undefined)
      } catch (e) {
        console.warn('[Reader] relayout failed:', e)
      }
      relayoutBusy.current = false
      if (relayoutPending.current) { relayoutPending.current = false; scheduleRelayout() }
    }, 300)
  }, [])

  // Apply preference changes to the open book
  useEffect(() => {
    const r = renditionRef.current
    if (!r) return
    try { r.getContents().forEach(c => applyReaderStyle(c, resolved)) } catch { /* not rendered yet */ }
    const sig = layoutSignature(resolved)
    if (sig !== layoutSigRef.current) {
      layoutSigRef.current = sig
      scheduleRelayout()
    }
  }, [resolved, scheduleRelayout])

  // ── tapping / keys ────────────────────────────────────────────
  const handleTapX = useCallback((absX) => {
    const rect = viewerRef.current?.getBoundingClientRect()
    if (!rect) return
    setSelMenu(null)
    setHlMenu(null)
    const rel = (absX - rect.left) / rect.width
    const r = renditionRef.current
    if (rel > 0.65) { r?.next(); setUi(false) }
    else if (rel < 0.35) { r?.prev(); setUi(false) }
    else setUi(!uiVisibleRef.current)
  }, [setUi])

  useLayoutEffect(() => {
    keyHandlerRef.current = (e) => {
      if (e.target?.closest?.('input, textarea, select')) return
      const r = renditionRef.current
      const next = e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)
      const prev = e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)
      if (next && !sheet) { e.preventDefault?.(); r?.next(); setUi(false); markActivity() }
      else if (prev && !sheet) { e.preventDefault?.(); r?.prev(); setUi(false); markActivity() }
      else if (e.key === 'Escape') {
        if (sheet) setSheet(null)
        else if (selMenu || hlMenu) { setSelMenu(null); setHlMenu(null) }
        else handleClose()
      }
    }
  })

  useEffect(() => {
    const handler = (e) => keyHandlerRef.current(e)
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── highlights drawn on the page ──────────────────────────────
  const drawHighlight = useCallback((cfiRange, color) => {
    const r = renditionRef.current
    if (!r || !cfiRange) return
    try {
      r.annotations.highlight(cfiRange, { color: color || 'gold' }, (e) => {
        // The highlight layer lives in the main page, so these are already page coordinates
        const point = e?.touches?.[0] || e
        if (!point) return
        setSelMenu(null)
        setHlMenu({ x: point.clientX, y: point.clientY, cfiRange })
      })
    } catch (err) {
      console.warn('[Reader] could not draw highlight:', err)
    }
  }, [])

  const createHighlight = (color) => {
    if (!selMenu) return
    drawHighlight(selMenu.cfiRange, color)
    addHighlight({
      book_id: book.id,
      text: selMenu.text,
      cfi: selMenu.cfiRange,
      cfi_range: selMenu.cfiRange,
      color,
      page_info: `${progressRef.current}%`,
    })
    try { renditionRef.current?.getContents().forEach(c => c.window.getSelection()?.removeAllRanges()) } catch { /* ignore */ }
    setSelMenu(null)
    toast('Highlighted ✦', 'success')
  }

  const removeHighlight = (cfiRange) => {
    try { renditionRef.current?.annotations.remove(cfiRange, 'highlight') } catch { /* already gone */ }
    const h = highlightsRef.current.find(x => (x.cfi_range || x.cfi) === cfiRange)
    if (h) deleteHighlight(h.id)
    setHlMenu(null)
  }

  const saveSelectionAsQuote = () => {
    if (!selMenu) return
    addQuote({ book_id: book.id, text: selMenu.text, book_title: bookTitle, author: bookAuthor })
    try { renditionRef.current?.getContents().forEach(c => c.window.getSelection()?.removeAllRanges()) } catch { /* ignore */ }
    setSelMenu(null)
    toast('Saved to your quotes ✦', 'success')
  }

  const copySelection = async () => {
    if (!selMenu) return
    try { await navigator.clipboard.writeText(selMenu.text); toast('Copied', 'success') } catch { toast('Could not copy', 'error') }
    setSelMenu(null)
  }

  // ── bookmarks ─────────────────────────────────────────────────
  const hereBookmarks = useMemo(() => {
    if (!range.start) return []
    const cfi = new EpubCFI()
    return myBookmarks.filter(b => {
      try { return b.cfi && cfi.compare(b.cfi, range.start) >= 0 && cfi.compare(b.cfi, range.end || range.start) <= 0 } catch { return false }
    })
  }, [myBookmarks, range])

  const toggleBookmark = () => {
    if (!range.start) return
    if (hereBookmarks.length) {
      hereBookmarks.forEach(b => deleteBookmark(b.id))
      toast('Bookmark removed')
    } else {
      addBookmark({
        book_id: book.id,
        cfi: range.start,
        label: `${chapterTitle || 'Page'} · ${progress}%`,
        page_info: `${progress}%`,
      })
      toast('Bookmarked ✦', 'success')
    }
  }

  // ── navigation helpers ────────────────────────────────────────
  const openCfi = async (cfi) => {
    setSheet(null)
    if (!cfi || !renditionRef.current) return
    try { await renditionRef.current.display(cfi) } catch { toast('Could not jump there', 'error') }
  }

  const openChapter = async (item) => {
    setSheet(null)
    if (!renditionRef.current || !bookRef.current) return
    try {
      const href = item.href || item.id
      if (!href) return
      const handled = await displayEpubTarget({
        book: bookRef.current,
        rendition: renditionRef.current,
        viewer: viewerRef.current,
        href,
        currentHref: renditionRef.current?.currentLocation?.()?.start?.href,
      })
      if (!handled) throw new Error('No matching section found')
    } catch (e) {
      console.error('[Reader] could not open chapter:', e)
      toast('That chapter could not be opened right now', 'error')
    }
  }

  const commitScrub = () => {
    const value = scrubRef.current
    scrubRef.current = null
    setScrub(null)
    if (value == null || !weightsRef.current || !renditionRef.current) return
    // jump to the start of the chapter that holds that point in the book
    const target = locationForProgress(weightsRef.current, value)
    if (!target) return
    try { renditionRef.current.display(target.href) } catch { /* chapter not found */ }
  }

  const handleDownload = () => {
    if (!fileBlob) return
    const url = URL.createObjectURL(fileBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = liveBook.file_name || bookTitle
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // ── decorate each rendered page: style, links, taps, swipes ───
  const decorateContents = useCallback((contents) => {
    const doc = contents?.document
    if (!doc) return
    applyReaderStyle(contents, resolvedRef.current)
    if (doc.__rdBound) return
    doc.__rdBound = true

    // Internal links (footnotes, chapter links)
    doc.addEventListener('click', async (event) => {
      const anchor = event.target?.closest?.('a[href]')
      if (!anchor) return
      const href = (anchor.getAttribute('href') || '').trim()
      if (!href || !isInternalHref(href)) return
      event.preventDefault()
      event.stopPropagation()
      try {
        // The chapter this link lives in, so relative links resolve to the right file
        const section = bookRef.current?.book?.sections?.get?.(contents.sectionIndex)
        const linkBase = section?.href || renditionRef.current?.currentLocation?.()?.start?.href || ''
        await displayEpubTarget({ book: bookRef.current, rendition: renditionRef.current, viewer: viewerRef.current, href, linkBase })
      } catch (e) {
        console.warn('[Reader] could not resolve link:', href, e)
      }
    }, true)

    // Tap zones and swipes
    let sx = 0
    let sy = 0
    let st = 0
    doc.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; st = Date.now() }, true)
    doc.addEventListener('pointerup', (e) => {
      markActivity()
      const sel = doc.getSelection?.()
      if (sel && sel.toString().trim()) return
      if (e.target?.closest?.('a[href]')) return
      const dx = e.clientX - sx
      const dy = e.clientY - sy
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        if (dx < 0) renditionRef.current?.next()
        else renditionRef.current?.prev()
        setUi(false)
        return
      }
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && Date.now() - st < 600) {
        const frameLeft = contents.window?.frameElement?.getBoundingClientRect?.().left || 0
        handleTapX(e.clientX + frameLeft)
      }
    }, true)

    doc.addEventListener('keydown', (e) => keyHandlerRef.current(e))
  }, [handleTapX, markActivity, setUi])

  // ── load the file and start the reader ────────────────────────
  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        setLoadMsg('Loading file...')
        if (!book.file_path) {
          throw new Error('This book does not have an uploaded file attached yet. Please re-upload it from the Upload page.')
        }
        const stored = await getFile(book.file_path)
        if (!stored) throw new Error('File not found in storage. Please re-upload the file.')
        const file = stored?.file ?? stored
        if (!(file instanceof Blob)) throw new Error('Stored file is corrupted. Please re-upload.')
        if (!mounted) return
        setFileBlob(file)

        const current = latestBookRef.current
        const fileType = current.file_type ||
          (file.type === 'application/pdf' ? 'pdf' : (current.file_name?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'epub'))

        if (fileType === 'pdf') {
          setIsPdf(true)
          const url = URL.createObjectURL(file)
          blobUrlRef.current = url
          setPdfBlobUrl(url)
          setLoading(false)
          return
        }

        setLoadMsg('Opening book...')
        const buffer = await file.arrayBuffer()
        const epubModule = await import('epubjs')
        const ePub = epubModule.default ?? epubModule.ePub ?? epubModule
        if (typeof ePub !== 'function') throw new Error('Could not load epub reader library.')

        window.ePub = ePub
        const eb = await ePub(buffer, { encoding: 'binary' })
        bookRef.current = eb
        await eb.ready
        if (!mounted || !viewerRef.current) return

        setLoadMsg('Preparing pages...')
        const r = eb.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          spread: 'none',
          flow: 'paginated',
          manager: DefaultViewManager,
          view: IframeView,
          allowScriptedContent: false,
        })
        renditionRef.current = r

        const toc = flattenToc(eb.navigation?.toc || [])
        tocRef.current = toc
        setTocItems(toc)

        r.hooks.content.register(decorateContents)

        r.on('selected', (cfiRange, contents) => {
          try {
            const win = contents.window
            const sel = win.getSelection()
            const text = (sel?.toString() || '').trim()
            if (!text) return
            const rect = sel.getRangeAt(0).getBoundingClientRect()
            const frame = win.frameElement?.getBoundingClientRect()
            setHlMenu(null)
            setSelMenu({
              x: (frame?.left || 0) + rect.left + rect.width / 2,
              y: (frame?.top || 0) + rect.top,
              bottom: (frame?.top || 0) + rect.bottom,
              cfiRange,
              text,
            })
          } catch { /* selection vanished */ }
        })

        r.on('relocated', (loc) => {
          if (!mounted) return
          const start = loc?.start
          if (!start) return
          curStartCfiRef.current = start.cfi
          setRange({ start: start.cfi, end: loc.end?.cfi || start.cfi })
          setSelMenu(null)
          setHlMenu(null)
          markActivity()

          // Which chapter are we in?
          const base = (start.href || '').split('#')[0]
          if (base) {
            const match = tocRef.current.find(t => {
              const tb = (t.href || '').split('#')[0]
              return tb && (tb === base || tb.endsWith(base) || base.endsWith(tb))
            })
            if (match) setChapterTitle(match.label)
          }

          // How far through the book?
          const pct = progressFromLocation(weightsRef.current, start)
          if (pct !== null) { progressRef.current = pct; setProgress(pct) }
          if (pct === 100) maybeFinish()

          queueSave(start.cfi, pct === null ? undefined : pct)
        })

        layoutSigRef.current = layoutSignature(resolvedRef.current)

        const startCfi = pickStartCfi(latestBookRef.current)
        try {
          await r.display(startCfi)
        } catch {
          await r.display()
        }

        // Re-draw this book's saved highlights
        highlightsRef.current.forEach(h => { if (h.cfi_range) drawHighlight(h.cfi_range, h.color) })

        if (mounted) setLoading(false)

        // Work out how much text each chapter holds (fast, one pass over the file). Until it's done
        // we keep the saved percentage rather than guessing; afterwards progress tracks every page turn.
        readSpineWeights(buffer)
          .then((weights) => {
            if (!mounted || !weights) return
            weightsRef.current = weights
            setLocsTotal(weights.total)
            setLocsReady(true)
            const here = renditionRef.current?.currentLocation?.()
            const pct = here?.start ? progressFromLocation(weights, here.start) : null
            if (pct !== null) {
              progressRef.current = pct
              setProgress(pct)
              if (curStartCfiRef.current) queueSave(curStartCfiRef.current, pct)
            }
          })
          .catch((e) => console.warn('[Reader] could not measure the book for progress:', e))
      } catch (e) {
        console.error('[Reader]', e)
        if (mounted) {
          setError(e.message || 'Unknown error opening file.')
          setLoading(false)
        }
      }
    }

    init()

    return () => {
      mounted = false
      flushProgress()
      flushSession()
      flushPrefs()
      clearTimeout(relayoutTimer.current)
      if (bookRef.current) { try { bookRef.current.destroy() } catch { /* already destroyed */ } }
      bookRef.current = null
      renditionRef.current = null
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, book.file_path])

  // ── derived display values ────────────────────────────────────
  const shownProgress = scrub ?? progress
  const minutesLeft = locsReady
    ? Math.max(1, Math.round(((100 - shownProgress) / 100) * locsTotal / CHARS_PER_MINUTE))
    : null
  const timeLabel = minutesLeft === null ? '' : minutesLeft >= 60
    ? `~${Math.floor(minutesLeft / 60)}h ${minutesLeft % 60}m left`
    : `~${minutesLeft} min left`

  const rootStyle = {
    '--rd-bg': resolved.bg,
    '--rd-text': resolved.text,
    '--rd-accent': resolved.accent,
    '--rd-ui': mixColors(resolved.bg, resolved.text, 0.08),
    '--rd-line': mixColors(resolved.bg, resolved.text, 0.22),
    '--rd-muted': mixColors(resolved.bg, resolved.text, 0.62),
    background: resolved.bg,
    color: resolved.text,
  }

  const popLeft = (x) => clamp(x, 150, (typeof window !== 'undefined' ? window.innerWidth : 600) - 150)

  // ── PDF: no pages/themes, just a viewer with the same chrome ──
  if (isPdf) {
    const pdfUrl = pdfBlobUrl ? `${pdfBlobUrl}#toolbar=0&navpanes=0&scrollbar=1` : ''
    return (
      <div className={`rd ${resolved.dark ? 'rd-dark' : 'rd-light'}`} style={rootStyle}>
        <header className="rd-top show">
          <button className="rd-icon" onClick={handleClose} aria-label="Back"><ChevronLeft size={22} /></button>
          <div className="rd-title"><strong>{bookTitle}</strong></div>
          <button className="rd-icon" onClick={handleDownload} aria-label="Download"><Download size={19} /></button>
        </header>
        <div className="rd-pdf">
          <iframe src={pdfUrl || pdfBlobUrl} title={bookTitle} className="pdf-frame" />
          <div className="pdf-ios-fallback">
            <div style={{ fontSize: '3rem' }}>📄</div>
            <p>PDF preview isn&apos;t supported on this browser.<br />Download to read.</p>
            <button className="rd-btn" onClick={handleDownload}><Download size={15} /> Download PDF</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`rd ${resolved.dark ? 'rd-dark' : 'rd-light'}`} style={rootStyle}>
      {/* taps inside the book are handled in the page itself; this catches taps on the margins around it */}
      <div className="rd-stage" onClick={(e) => handleTapX(e.clientX)}>
        <div ref={viewerRef} className="rd-viewer" />
      </div>

      {resolved.warmth > 0 && (
        <div className="rd-tint rd-tint-warm" style={{ background: `rgba(255, 150, 40, ${resolved.warmth * 0.0035})` }} />
      )}
      {resolved.dim > 0 && (
        <div className="rd-tint" style={{ background: `rgba(0, 0, 0, ${resolved.dim / 100})` }} />
      )}

      <div className={`rd-mini ${uiVisible ? 'hide' : ''}`}>
        {academic && pomo.active ? `${pomo.mini} · ` : ''}{chapterTitle ? `${chapterTitle} · ` : ''}{progress}%
      </div>

      <header className={`rd-top ${uiVisible ? 'show' : ''}`}>
        <button className="rd-icon" onClick={handleClose} aria-label="Back to library"><ChevronLeft size={22} /></button>
        <div className="rd-title">
          <strong>{bookTitle}</strong>
          {chapterTitle && <span>{chapterTitle}</span>}
        </div>
        {academic && <PomodoroChip />}
        <button className={`rd-icon ${hereBookmarks.length ? 'active' : ''}`} onClick={toggleBookmark} aria-label="Bookmark this page">
          <Bookmark size={19} fill={hereBookmarks.length ? 'currentColor' : 'none'} />
        </button>
        <button className="rd-icon" onClick={() => setSheet('drawer')} aria-label="Contents, bookmarks and highlights"><List size={20} /></button>
        <button className="rd-icon" onClick={() => setSheet('settings')} aria-label="Reading settings"><SlidersHorizontal size={19} /></button>
      </header>

      <footer className={`rd-bottom ${uiVisible ? 'show' : ''}`}>
        <div className="rd-scrub-row">
          <button className="rd-icon rd-icon-sm" onClick={() => renditionRef.current?.prev()} aria-label="Previous page"><ChevronLeft size={18} /></button>
          <input
            type="range"
            className="rd-scrub"
            min={0}
            max={100}
            step={0.5}
            value={shownProgress}
            disabled={!locsReady}
            onChange={(e) => { const v = Number(e.target.value); scrubRef.current = v; setScrub(v) }}
            onPointerUp={commitScrub}
            onKeyUp={commitScrub}
            aria-label="Reading progress"
          />
          <button className="rd-icon rd-icon-sm" onClick={() => renditionRef.current?.next()} aria-label="Next page"><ChevronRight size={18} /></button>
        </div>
        <div className="rd-bottom-info">
          <span>{Math.round(shownProgress)}%</span>
          <span>{locsReady ? timeLabel : 'Measuring book…'}</span>
        </div>
      </footer>

      {selMenu && (
        <div
          className="rd-pop"
          style={{
            left: popLeft(selMenu.x),
            top: selMenu.y > 90 ? selMenu.y - 56 : selMenu.bottom + 14,
          }}
        >
          {Object.entries(HIGHLIGHT_COLORS).map(([name, hex]) => (
            <button key={name} className="rd-dot" style={{ background: hex }} onClick={() => createHighlight(name)} aria-label={`Highlight ${name}`} />
          ))}
          <span className="rd-pop-sep" />
          <button className="rd-icon rd-icon-sm" onClick={saveSelectionAsQuote} aria-label="Save as quote"><QuoteIcon size={16} /></button>
          <button className="rd-icon rd-icon-sm" onClick={copySelection} aria-label="Copy"><Copy size={16} /></button>
        </div>
      )}

      {hlMenu && (
        <div className="rd-pop" style={{ left: popLeft(hlMenu.x), top: Math.max(70, hlMenu.y - 56) }}>
          <button className="rd-pop-text" onClick={() => removeHighlight(hlMenu.cfiRange)}>Remove highlight</button>
        </div>
      )}

      {sheet === 'settings' && (
        <ReaderSettings
          prefs={prefs}
          resolved={resolved}
          onChange={updatePrefs}
          onReset={() => updatePrefs({ ...DEFAULT_PREFS })}
          profiles={profiles}
          onSaveProfile={saveProfile}
          onApplyProfile={applyProfile}
          onDeleteProfile={deleteProfile}
          bookOnly={bookOnly}
          onToggleBookOnly={toggleBookOnly}
          onDownload={handleDownload}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === 'drawer' && (
        <ReaderDrawer
          tocItems={tocItems}
          currentChapter={chapterTitle}
          bookmarks={myBookmarks}
          highlights={myHighlights}
          onOpenToc={openChapter}
          onOpenCfi={openCfi}
          onDeleteBookmark={deleteBookmark}
          onDeleteHighlight={(h) => removeHighlight(h.cfi_range || h.cfi)}
          onClose={() => setSheet(null)}
        />
      )}

      {loading && (
        <div className="rd-loading">
          <div className="rd-spinner" />
          <p>{loadMsg}</p>
        </div>
      )}

      {error && (
        <div className="rd-loading rd-error">
          <div style={{ fontSize: '2.6rem' }}>📖</div>
          <p>{error}</p>
          <button className="rd-btn" onClick={handleClose}>Back to library</button>
        </div>
      )}
    </div>
  )
}
