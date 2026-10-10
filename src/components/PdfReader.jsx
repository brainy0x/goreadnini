import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Bookmark, List, SlidersHorizontal, Search } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import { useToast } from '../contexts/ToastContext'
import { getFile } from '../lib/fileStorage'
import { loadPdfjs } from '../lib/pdfjs'
import { displayBook, categoryOf } from '../lib/bookDisplay'
import { usePomodoro } from '../contexts/PomodoroContext'
import PomodoroChip from './PomodoroChip'
import { resolvePrefs, mixColors } from '../lib/readerPrefs'
import PdfPage from './reader/PdfPage'
import PdfSettings from './reader/PdfSettings'
import { PDF_THEMES } from '../lib/pdfThemes'
import PdfSearch from './reader/PdfSearch'
import ReaderDrawer from './reader/ReaderDrawer'
import '../reader.css'

const GAP = 10            // space between pages
const PAD_TOP = 12
const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
const DEFAULT_PDF_PREFS = { theme: 'light', dim: 0, warmth: 0 }

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

const readLocalPdfPrefs = () => {
  try { return JSON.parse(localStorage.getItem('grn_pdf_prefs') || '{}') } catch { return {} }
}

// Where to open: whichever of the synced position / this device's position is newer
function pickStart(book) {
  let local = null
  try {
    const raw = localStorage.getItem(`grn_pdfpos_${book.id}`)
    if (raw) local = JSON.parse(raw)
  } catch { local = null }
  const remoteTime = book.last_read_at ? Date.parse(book.last_read_at) : 0
  if (book.last_page && (!local || remoteTime > (local.t || 0))) return { page: book.last_page, frac: book.last_frac || 0 }
  if (local?.page) return { page: local.page, frac: local.frac || 0 }
  return { page: 1, frac: 0 }
}

// Where every page sits, for the current width and zoom. Each page is fitted to the screen width.
function computeLayout(sizes, containerW, zoom) {
  if (!sizes || !containerW) return null
  const pad = containerW < 600 ? 8 : 20
  const fitW = Math.max(120, containerW - pad * 2)
  const scales = []
  const widths = []
  const heights = []
  const tops = []
  let y = PAD_TOP
  sizes.forEach((size) => {
    const s = size || sizes[0]
    const scale = (fitW / s.w) * zoom
    scales.push(scale)
    widths.push(s.w * scale)
    heights.push(s.h * scale)
    tops.push(y)
    y += s.h * scale + GAP
  })
  return { scales, widths, heights, tops }
}

function flattenOutline(items = [], depth = 0) {
  return items.flatMap(item => [
    { label: item.title || 'Untitled', dest: item.dest, depth },
    ...flattenOutline(item.items || [], depth + 1),
  ])
}

export default function PdfReader({ book, onClose }) {
  const {
    books, bookmarks, readerPrefs,
    updateBook, addBookmark, deleteBookmark, addSession, saveReaderPrefs,
  } = useBooks()
  const toast = useToast()

  const liveBook = books.find(b => b.id === book.id) || book
  const { title: bookTitle } = displayBook(liveBook)
  const academic = categoryOf(liveBook) === 'academic'
  const pomo = usePomodoro()
  const myBookmarks = useMemo(() => bookmarks.filter(b => b.book_id === book.id), [bookmarks, book.id])

  // ── refs ──────────────────────────────────────────────────────
  const scrollRef       = useRef(null)
  const layoutRef       = useRef(null)
  const zoomRef         = useRef(1)
  const anchorRef       = useRef(null)    // where to scroll to after the layout changes
  const positionRef     = useRef({ page: 1, frac: 0 })
  const progressRef     = useRef(book.progress || 0)
  const numPagesRef     = useRef(0)
  const latestBookRef   = useRef(liveBook)
  const fnsRef          = useRef({})
  const keyHandlerRef   = useRef(() => {})
  const uiVisibleRef    = useRef(true)
  const pendingSaveRef  = useRef(null)
  const saveTimerRef    = useRef(null)
  const prefsTimerRef   = useRef(null)
  const prefsDirtyRef   = useRef(false)
  const rafRef          = useRef(0)
  const pointersRef     = useRef(new Map())
  const pinchRef        = useRef(null)
  const pinchedRef      = useRef(false)
  const activeSecRef    = useRef(0)
  const lastActivityRef = useRef(0)
  const sessionSavedRef = useRef(false)
  const scrubRef        = useRef(null)
  const outlineRef      = useRef([])
  const containerWRef   = useRef(0)

  // ── state ─────────────────────────────────────────────────────
  const [scrollEl, setScrollEl]       = useState(null)
  const [pdfjs, setPdfjs]             = useState(null)
  const [textCache]                   = useState(() => new Map())   // page text, kept for fast repeat searches
  const [doc, setDoc]                 = useState(null)
  const [sizes, setSizes]             = useState(null)
  const [containerW, setContainerW]   = useState(0)
  const [zoom, setZoom]               = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [progress, setProgress]       = useState(book.progress || 0)
  const [scrub, setScrub]             = useState(null)
  const [uiVisible, setUiVisible]     = useState(true)
  const [sheet, setSheet]             = useState(null) // 'settings' | 'drawer' | 'search'
  const [loading, setLoading]         = useState(true)
  const [loadMsg, setLoadMsg]         = useState('Opening your document...')
  const [error, setError]             = useState(null)
  const [fileBlob, setFileBlob]       = useState(null)
  const [outline, setOutline]         = useState([])
  const [pdfPrefs, setPdfPrefs]       = useState(() => ({ ...DEFAULT_PDF_PREFS, ...(readerPrefs?.pdf || {}), ...readLocalPdfPrefs() }))
  const pdfPrefsRef = useRef(pdfPrefs)

  const numPages = sizes ? sizes.length : 0
  const layout = useMemo(() => computeLayout(sizes, containerW, zoom), [sizes, containerW, zoom])
  const theme = PDF_THEMES[pdfPrefs.theme] || PDF_THEMES.light
  const resolved = useMemo(() => resolvePrefs({ preset: theme.preset }, false), [theme])

  useLayoutEffect(() => {
    latestBookRef.current = liveBook
    layoutRef.current = layout
    numPagesRef.current = numPages
    zoomRef.current = zoom
    fnsRef.current = { updateBook, addBookmark, deleteBookmark, addSession, saveReaderPrefs, toast, onClose }
  })

  const setScroll = useCallback((el) => {
    scrollRef.current = el
    setScrollEl(el)
  }, [])

  const setUi = useCallback((v) => { uiVisibleRef.current = v; setUiVisible(v) }, [])
  const markActivity = useCallback(() => { lastActivityRef.current = Date.now() }, [])

  // Hide the toolbars shortly after opening
  useEffect(() => {
    if (loading) return undefined
    const id = setTimeout(() => setUi(false), 3500)
    return () => clearTimeout(id)
  }, [loading, setUi])

  // ── saving position / progress ────────────────────────────────
  const flushProgress = useCallback(() => {
    clearTimeout(saveTimerRef.current)
    const pending = pendingSaveRef.current
    if (!pending) return
    pendingSaveRef.current = null
    fnsRef.current.updateBook(book.id, {
      last_page: pending.pos.page,
      last_frac: pending.pos.frac,
      progress: pending.pct,
      last_read_at: new Date().toISOString(),
    })
  }, [book.id])

  const queueSave = useCallback((pos, pct) => {
    try { localStorage.setItem(`grn_pdfpos_${book.id}`, JSON.stringify({ ...pos, t: Date.now() })) } catch { /* storage full */ }
    pendingSaveRef.current = { pos, pct }
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

  // ── reading time for Stats ────────────────────────────────────
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

  // ── document settings (page colour, dimmer) ───────────────────
  const flushPdfPrefs = useCallback(() => {
    clearTimeout(prefsTimerRef.current)
    if (!prefsDirtyRef.current) return
    prefsDirtyRef.current = false
    try { localStorage.setItem('grn_pdf_prefs', JSON.stringify(pdfPrefsRef.current)) } catch { /* storage full */ }
    fnsRef.current.saveReaderPrefs({ pdf: pdfPrefsRef.current })
  }, [])

  const updatePdfPrefs = useCallback((patch) => {
    const next = { ...pdfPrefsRef.current, ...patch }
    pdfPrefsRef.current = next
    setPdfPrefs(next)
    prefsDirtyRef.current = true
    clearTimeout(prefsTimerRef.current)
    prefsTimerRef.current = setTimeout(flushPdfPrefs, 700)
  }, [flushPdfPrefs])

  const handleClose = useCallback(() => {
    flushProgress()
    flushSession()
    flushPdfPrefs()
    fnsRef.current.onClose()
  }, [flushProgress, flushSession, flushPdfPrefs])

  // ── load the document ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    let task = null

    ;(async () => {
      try {
        if (!book.file_path) throw new Error('This document has no uploaded file attached yet. Please re-upload it from the Upload page.')
        setLoadMsg('Loading file...')
        const stored = await getFile(book.file_path)
        const file = stored?.file ?? stored
        if (!(file instanceof Blob)) throw new Error('Stored file is corrupted. Please re-upload.')
        if (cancelled) return
        setFileBlob(file)

        setLoadMsg('Opening document...')
        const lib = await loadPdfjs()
        task = lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
        const pdf = await task.promise
        if (cancelled) return

        // measure every page (in batches) so we know exactly how tall the document is
        const count = pdf.numPages
        const measured = new Array(count)
        for (let i = 0; i < count; i += 25) {
          const batch = []
          for (let j = i; j < Math.min(i + 25, count); j++) {
            batch.push(pdf.getPage(j + 1).then((page) => {
              const view = page.getViewport({ scale: 1 })
              measured[j] = { w: view.width, h: view.height }
            }))
          }
          await Promise.all(batch)
          if (cancelled) return
          setLoadMsg(`Preparing pages… ${Math.min(i + 25, count)} / ${count}`)
        }

        try {
          const raw = await pdf.getOutline()
          const flat = flattenOutline(raw || [])
          outlineRef.current = flat
          if (!cancelled) setOutline(flat)
        } catch { /* no contents list */ }

        const start = pickStart(latestBookRef.current)
        anchorRef.current = { page: clamp(start.page, 1, count), frac: start.frac }
        positionRef.current = anchorRef.current

        setPdfjs(lib)
        setDoc(pdf)
        setSizes(measured)
        setLoading(false)
      } catch (e) {
        console.error('[PdfReader]', e)
        if (!cancelled) {
          setError(e.message || 'Could not open this PDF.')
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
      flushProgress()
      flushSession()
      flushPdfPrefs()
      try { task?.destroy() } catch { /* already destroyed */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, book.file_path])

  // ── keep the visible spot steady when the layout changes ──────
  useLayoutEffect(() => {
    const el = scrollRef.current
    const a = anchorRef.current
    if (!el || !layout || !a) return
    const index = clamp(a.page - 1, 0, layout.tops.length - 1)
    el.scrollTop = layout.tops[index] + a.frac * layout.heights[index] - el.clientHeight * 0.3
    anchorRef.current = null
  }, [layout, scrollEl])

  // Track the width of the reading area (changes on rotation or window resize)
  useEffect(() => {
    if (!scrollEl) return undefined
    const observer = new ResizeObserver((entries) => {
      const width = Math.round(entries[0].contentRect.width)
      const previous = containerWRef.current
      if (!width || Math.abs(previous - width) < 2) return
      if (previous) anchorRef.current = positionRef.current   // keep the same spot after a rotation/resize
      containerWRef.current = width
      setContainerW(width)
    })
    observer.observe(scrollEl)
    return () => observer.disconnect()
  }, [scrollEl])

  // ── scrolling: which page are we on, how far through ──────────
  const computePosition = useCallback(() => {
    const el = scrollRef.current
    const lay = layoutRef.current
    const n = numPagesRef.current
    if (!el || !lay || !n) return
    const probe = el.scrollTop + el.clientHeight * 0.3
    let lo = 0
    let hi = n - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (lay.tops[mid] <= probe) lo = mid
      else hi = mid - 1
    }
    const page = lo + 1
    const frac = clamp((probe - lay.tops[lo]) / lay.heights[lo], 0, 1)
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 6
    const pct = atEnd && page === n ? 100 : Math.round(((page - 1 + frac) / n) * 100)

    const pos = { page, frac }
    positionRef.current = pos
    progressRef.current = pct
    setCurrentPage(page)
    setProgress(pct)
    if (pct === 100) maybeFinish()
    queueSave(pos, pct)
  }, [queueSave, maybeFinish])

  const onScroll = useCallback(() => {
    markActivity()
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      computePosition()
    })
  }, [computePosition, markActivity])

  const scrollToPage = useCallback((page, frac = 0) => {
    const el = scrollRef.current
    const lay = layoutRef.current
    if (!el || !lay) return
    const index = clamp(page - 1, 0, lay.tops.length - 1)
    el.scrollTo({ top: lay.tops[index] + frac * lay.heights[index] - 8, behavior: 'auto' })
  }, [])

  const applyZoom = useCallback((value) => {
    const next = clamp(Math.round(value * 100) / 100, MIN_ZOOM, MAX_ZOOM)
    if (next === zoomRef.current) return
    anchorRef.current = positionRef.current
    zoomRef.current = next
    setZoom(next)
  }, [])

  // ── taps and pinch ────────────────────────────────────────────
  const onTap = (e) => {
    if (pinchedRef.current) { pinchedRef.current = false; return }
    const sel = window.getSelection?.()
    if (sel && sel.toString().trim()) return
    if (e.target.closest?.('a, button')) return
    setUi(!uiVisibleRef.current)
  }

  const onPointerDown = (e) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()]
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: zoomRef.current, ratio: 1 }
    }
  }

  const onPointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinchRef.current && pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()]
      pinchRef.current.ratio = Math.hypot(a.x - b.x, a.y - b.y) / pinchRef.current.dist
    }
  }

  const onPointerEnd = (e) => {
    pointersRef.current.delete(e.pointerId)
    const pinch = pinchRef.current
    if (pinch) {
      pinchRef.current = null
      pinchedRef.current = true
      applyZoom(pinch.zoom * pinch.ratio)
    }
  }

  // ── keyboard ──────────────────────────────────────────────────
  useLayoutEffect(() => {
    keyHandlerRef.current = (e) => {
      if (e.target?.closest?.('input, textarea, select')) return
      const el = scrollRef.current
      if (e.key === 'Escape') {
        if (sheet) setSheet(null)
        else handleClose()
        return
      }
      if (!el || sheet) return
      const page = el.clientHeight * 0.9
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) { e.preventDefault(); el.scrollBy({ top: page, behavior: 'smooth' }) }
      else if (e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) { e.preventDefault(); el.scrollBy({ top: -page, behavior: 'smooth' }) }
      else if (e.key === 'Home') { e.preventDefault(); el.scrollTo({ top: 0 }) }
      else if (e.key === 'End') { e.preventDefault(); el.scrollTo({ top: el.scrollHeight }) }
      else if (e.key === '+' || e.key === '=') applyZoom(zoomRef.current + 0.1)
      else if (e.key === '-') applyZoom(zoomRef.current - 0.1)
    }
  })

  useEffect(() => {
    const handler = (e) => keyHandlerRef.current(e)
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── bookmarks, contents, search jumps ─────────────────────────
  const hereBookmarks = useMemo(
    () => myBookmarks.filter(b => b.cfi === `pdf:${currentPage}`),
    [myBookmarks, currentPage]
  )

  const toggleBookmark = () => {
    if (hereBookmarks.length) {
      hereBookmarks.forEach(b => deleteBookmark(b.id))
      toast('Bookmark removed')
    } else {
      addBookmark({
        book_id: book.id,
        cfi: `pdf:${currentPage}`,
        label: `Page ${currentPage}`,
        page_info: `${progress}%`,
      })
      toast('Bookmarked ✦', 'success')
    }
  }

  const openBookmark = (cfi) => {
    setSheet(null)
    const page = Number(String(cfi || '').replace('pdf:', ''))
    if (page) scrollToPage(page)
  }

  const openOutlineItem = async (item) => {
    setSheet(null)
    try {
      let dest = item.dest
      if (typeof dest === 'string') dest = await doc.getDestination(dest)
      if (!Array.isArray(dest)) return
      const ref = dest[0]
      const index = typeof ref === 'object' ? await doc.getPageIndex(ref) : ref
      scrollToPage(index + 1)
    } catch {
      toast('Could not jump to that section', 'error')
    }
  }

  const commitScrub = () => {
    const page = scrubRef.current
    scrubRef.current = null
    setScrub(null)
    if (page) scrollToPage(page)
  }

  const handleDownload = () => {
    if (!fileBlob) return
    const url = URL.createObjectURL(fileBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = liveBook.file_name || `${bookTitle}.pdf`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // ── display ───────────────────────────────────────────────────
  const shownPage = scrub ?? currentPage
  const rootStyle = {
    '--rd-bg': resolved.bg,
    '--rd-text': resolved.text,
    '--rd-accent': resolved.accent,
    '--rd-ui': mixColors(resolved.bg, resolved.text, 0.08),
    '--rd-line': mixColors(resolved.bg, resolved.text, 0.22),
    '--rd-muted': mixColors(resolved.bg, resolved.text, 0.62),
    background: theme.stage,
    color: resolved.text,
  }

  return (
    <div className={`rd ${resolved.dark ? 'rd-dark' : 'rd-light'}`} style={rootStyle}>
      <div
        ref={setScroll}
        className="pdf-scroll"
        onScroll={onScroll}
        onClick={onTap}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {pdfjs && doc && layout && (
          <div className="pdf-pages" style={{ paddingTop: PAD_TOP }}>
            {layout.heights.map((height, i) => (
              <PdfPage
                key={i}
                pdfjs={pdfjs}
                doc={doc}
                num={i + 1}
                scale={layout.scales[i]}
                width={layout.widths[i]}
                height={height}
                root={scrollEl}
                filter={theme.filter}
              />
            ))}
          </div>
        )}
      </div>

      {pdfPrefs.warmth > 0 && (
        <div className="rd-tint rd-tint-warm" style={{ background: `rgba(255, 150, 40, ${pdfPrefs.warmth * 0.0035})` }} />
      )}
      {pdfPrefs.dim > 0 && (
        <div className="rd-tint" style={{ background: `rgba(0, 0, 0, ${pdfPrefs.dim / 100})` }} />
      )}

      <div className={`rd-mini ${uiVisible ? 'hide' : ''}`}>{academic && pomo.active ? `${pomo.mini} · ` : ''}Page {currentPage} / {numPages} · {progress}%</div>

      <header className={`rd-top ${uiVisible ? 'show' : ''}`}>
        <button className="rd-icon" onClick={handleClose} aria-label="Back to library"><ChevronLeft size={22} /></button>
        <div className="rd-title">
          <strong>{bookTitle}</strong>
          {numPages > 0 && <span>Page {currentPage} of {numPages}</span>}
        </div>
        {academic && <PomodoroChip />}
        <button className="rd-icon" onClick={() => setSheet('search')} aria-label="Search the document"><Search size={19} /></button>
        <button className={`rd-icon ${hereBookmarks.length ? 'active' : ''}`} onClick={toggleBookmark} aria-label="Bookmark this page">
          <Bookmark size={19} fill={hereBookmarks.length ? 'currentColor' : 'none'} />
        </button>
        <button className="rd-icon" onClick={() => setSheet('drawer')} aria-label="Contents and bookmarks"><List size={20} /></button>
        <button className="rd-icon" onClick={() => setSheet('settings')} aria-label="Document settings"><SlidersHorizontal size={19} /></button>
      </header>

      <footer className={`rd-bottom ${uiVisible ? 'show' : ''}`}>
        <div className="rd-scrub-row">
          <button className="rd-icon rd-icon-sm" onClick={() => scrollToPage(Math.max(1, currentPage - 1))} aria-label="Previous page"><ChevronLeft size={18} /></button>
          <input
            type="range"
            className="rd-scrub"
            min={1}
            max={Math.max(1, numPages)}
            step={1}
            value={shownPage}
            disabled={!numPages}
            onChange={(e) => { const v = Number(e.target.value); scrubRef.current = v; setScrub(v) }}
            onPointerUp={commitScrub}
            onKeyUp={commitScrub}
            aria-label="Page"
          />
          <button className="rd-icon rd-icon-sm" onClick={() => scrollToPage(Math.min(numPages, currentPage + 1))} aria-label="Next page"><ChevronRight size={18} /></button>
        </div>
        <div className="rd-bottom-info">
          <span>Page {shownPage} / {numPages}</span>
          <span>{progress}% read</span>
        </div>
      </footer>

      {sheet === 'settings' && (
        <PdfSettings
          prefs={pdfPrefs}
          onChange={updatePdfPrefs}
          zoom={zoom}
          onZoom={applyZoom}
          onDownload={handleDownload}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === 'drawer' && (
        <ReaderDrawer
          tocItems={outline}
          currentChapter=""
          bookmarks={myBookmarks}
          highlights={[]}
          showHighlights={false}
          onOpenToc={openOutlineItem}
          onOpenCfi={openBookmark}
          onDeleteBookmark={deleteBookmark}
          onDeleteHighlight={() => {}}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === 'search' && doc && (
        <PdfSearch
          doc={doc}
          textCache={textCache}
          onGo={(page) => { setSheet(null); scrollToPage(page) }}
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
          <div style={{ fontSize: '2.6rem' }}>📄</div>
          <p>{error}</p>
          <button className="rd-btn" onClick={handleClose}>Back to library</button>
        </div>
      )}
    </div>
  )
}
