import { useEffect, useRef, useState, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, Bookmark, Highlighter, Settings, Download, Sun, Moon, Coffee, BookOpen } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import { useToast } from '../contexts/ToastContext'
import { useTheme } from '../contexts/ThemeContext'
import { getFile } from '../lib/fileStorage'
import { displayEpubTarget, flattenToc, isInternalHref } from '../lib/epubNavigation'
import { READER_THEMES, applyReaderThemeToDocument, applyReaderThemeToRendition } from '../lib/readerTheme'
import DefaultViewManager from 'epubjs/src/managers/default/index'
import IframeView from 'epubjs/src/managers/views/iframe'

const THEME_ICONS = {
  light: Sun,
  sepia: Coffee,
  dark: Moon,
}

const THEMES = Object.fromEntries(
  Object.entries(READER_THEMES).map(([key, value]) => [key, { ...value, icon: THEME_ICONS[key] }])
)

export default function EpubReader({ book, onClose }) {
  const { updateBook, addHighlight, addBookmark } = useBooks()
  const toast = useToast()

  const viewerRef       = useRef(null)
  const renditionRef    = useRef(null)
  const bookRef         = useRef(null)
  const blobUrlRef      = useRef(null) // track blob URLs for cleanup
  const watchedIframes  = useRef(new WeakSet())
  const iframeObserver  = useRef(null)
  const readerSettingsRef = useRef({ theme: 'light', fontSize: 100 })

  const { theme, setTheme } = useTheme()
  const [progress, setProgress] = useState(book.progress || 0)
  const [fontSize, setFontSize] = useState(100)
  const [showSettings, setShowSettings] = useState(false)
  const [currentCfi,   setCurrentCfi]   = useState('')
  const [loading,      setLoading]      = useState(true)
  const [loadMsg,      setLoadMsg]      = useState('Opening your book...')
  const [error,        setError]        = useState(null)
  const [isPdf,        setIsPdf]        = useState(false)
  const [pdfBlobUrl,   setPdfBlobUrl]   = useState(null)
  const [fileBlob,     setFileBlob]     = useState(null)
  const [tocItems,     setTocItems]     = useState([])
  const [tocOpen,      setTocOpen]      = useState(false)

  const pdfViewerUrl = pdfBlobUrl ? `${pdfBlobUrl}#toolbar=0&navpanes=0&scrollbar=1` : ''

  const T = THEMES[theme]

  useEffect(() => {
    readerSettingsRef.current = { theme, fontSize }
  }, [theme, fontSize])

  const handleInternalLinkClick = useCallback(async (href) => {
    return displayEpubTarget({
      book: bookRef.current,
      rendition: renditionRef.current,
      viewer: viewerRef.current,
      href,
    })
  }, [])

  const attachInternalLinkInterceptors = useCallback((doc) => {
    if (!doc || doc.__grnInterceptAttached) return
    const listener = async (event) => {
      const anchor = event.target.closest?.('a[href]')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href) return
      const normalized = href.trim()
      if (!isInternalHref(normalized)) return

      event.preventDefault()
      event.stopPropagation()
      const handled = await handleInternalLinkClick(normalized)
      if (!handled) {
        console.warn('[EpubReader] Could not resolve internal link:', normalized)
      }
    }

    doc.addEventListener('click', listener, true)
    doc.__grnInterceptAttached = true
  }, [handleInternalLinkClick])

  const attachTapListenerToDocument = useCallback((doc, iframe) => {
    if (!doc || doc.__grnTapAttached) return
    const onTap = (event) => {
      try {
        // don't flip when clicking links or interactive elements
        if (event.target.closest && event.target.closest('a, button, input, textarea, select')) return
        const sel = (doc.getSelection && doc.getSelection().toString && doc.getSelection().toString()) || ''
        if (sel && sel.trim()) return

        // compute page X coordinate — for events inside iframe, event.clientX is relative to iframe
        const iframeRect = iframe?.getBoundingClientRect?.() || { left: 0 }
        const pageX = (event.clientX || 0) + (iframeRect.left || 0)
        const viewerRect = viewerRef.current?.getBoundingClientRect?.()
        if (!viewerRect) return

        const rel = (pageX - viewerRect.left) / viewerRect.width
        if (rel > 0.62) {
          renditionRef.current?.next()
        } else if (rel < 0.38) {
          renditionRef.current?.prev()
        }
      } catch {
        // ignore
      }
    }

    doc.addEventListener('pointerup', onTap, true)
    doc.__grnTapAttached = true
  }, [])

  const applyThemeToIframe = useCallback((iframe) => {
    if (!iframe) return
    const { theme: activeTheme, fontSize: activeFontSize } = readerSettingsRef.current
    const th = THEMES[activeTheme]
    iframe.style.background = th.bg
    iframe.style.color = th.text

    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return

    const applyNow = () => {
      applyReaderThemeToDocument(doc, activeTheme, activeFontSize)
      attachInternalLinkInterceptors(doc)
      attachTapListenerToDocument(doc, iframe)
    }

    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', applyNow, { once: true })
    } else {
      applyNow()
    }
  }, [attachInternalLinkInterceptors])

  const watchIframes = useCallback(() => {
    if (!viewerRef.current) return
    const iframes = viewerRef.current.querySelectorAll('iframe')
    iframes.forEach((iframe) => {
      if (!watchedIframes.current.has(iframe)) {
        watchedIframes.current.add(iframe)
        iframe.addEventListener('load', () => applyThemeToIframe(iframe), true)
      }
      applyThemeToIframe(iframe)
    })

    if (!iframeObserver.current) {
      iframeObserver.current = new MutationObserver(() => watchIframes())
      iframeObserver.current.observe(viewerRef.current, { childList: true, subtree: true })
    }
  }, [applyThemeToIframe])

  const stopWatchingIframes = useCallback(() => {
    if (iframeObserver.current) {
      iframeObserver.current.disconnect()
      iframeObserver.current = null
    }
    watchedIframes.current = new WeakSet()
  }, [])

  // ── Apply epub theme styles ──────────────────────────────────
  const applyTheme = useCallback((r, t, fs) => {
    const th = THEMES[t]
    if (!r?.themes) return

    // Ensure the viewer wrapper itself is themed to avoid bleed during page transitions.
    if (viewerRef.current) {
      viewerRef.current.style.background = th.bg
      viewerRef.current.style.color = th.text
    }

    applyReaderThemeToRendition(r, t, fs)
    watchIframes()
  }, [watchIframes])

  // Reflow reader on resize / orientation changes
  useEffect(() => {
    const onResize = () => {
      try { renditionRef.current?.resize?.() } catch {
        // EPUB.js can be between view manager swaps during orientation changes.
      }
      try { if (renditionRef.current) applyTheme(renditionRef.current, theme, fontSize) } catch {
        // A stale iframe can disappear while the browser is reflowing.
      }
      try { watchIframes() } catch {
        // Mutation timing during teardown should not interrupt reading.
      }
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('orientationchange', onResize) }
  }, [theme, fontSize, applyTheme, watchIframes])

  // Attach tap listener to the outer viewer for non-iframe areas (mobile tap-to-flip)
  useEffect(() => {
    const onTap = (event) => {
      try {
        // ignore if clicking toolbar/controls
        if (!viewerRef.current) return
        const toolbar = viewerRef.current.closest('.reader-panel')?.querySelector('.reader-toolbar')
        if (toolbar && toolbar.contains(event.target)) return

        // ignore if clicking interactive elements
        if (event.target.closest && event.target.closest('a, button, input, textarea, select')) return

        // selection guard
        const sel = (window.getSelection && window.getSelection().toString && window.getSelection().toString()) || ''
        if (sel && sel.trim()) return

        const rect = viewerRef.current.getBoundingClientRect()
        const rel = (event.clientX - rect.left) / rect.width
        if (rel > 0.62) renditionRef.current?.next()
        else if (rel < 0.38) renditionRef.current?.prev()
      } catch {
        // no-op
      }
    }

    const node = viewerRef.current
    if (node) node.addEventListener('pointerup', onTap, true)
    return () => { if (node) node.removeEventListener('pointerup', onTap, true) }
  }, [])

  // ── Load file and init reader ────────────────────────────────
  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        setLoadMsg('Loading file...')

        if (!book.file_path) {
          throw new Error('This book does not have an uploaded file attached yet. Please re-upload it from the Upload page.')
        }

        // Get file from Supabase Storage
        const stored = await getFile(book.file_path)
        if (!stored) {
          throw new Error('File not found in Supabase Storage. Please re-upload the file.')
        }
        const file = stored?.file ?? stored
        console.log('[EpubReader] Retrieved file from storage:', file)
        if (!(file instanceof Blob)) {
          throw new Error('Stored file is corrupted. Please re-upload.')
        }
        setFileBlob(file)

        const fileType = book.file_type ||
          (file.type === 'application/pdf' ? 'pdf' :
            (book.file_name?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'epub'))

        // ── PDF path ─────────────────────────────────────────
        if (fileType === 'pdf') {
          setIsPdf(true)
          const url = URL.createObjectURL(file)
          blobUrlRef.current = url
          setPdfBlobUrl(url)
          setLoading(false)
          return
        }

      // ── EPUB path ─────────────────────────────────────────
        setLoadMsg('Parsing epub...')

        // 1. Get the raw ArrayBuffer from Supabase
        const buffer = await file.arrayBuffer()
        console.log('[EpubReader] ArrayBuffer ready, size:', buffer.byteLength)

        setLoadMsg('Starting reader...')
        const epubModule = await import('epubjs')
        const ePub = epubModule.default ?? epubModule.ePub ?? epubModule

        if (typeof ePub !== 'function') {
          throw new Error('Could not load epub reader library.')
        }

        window.ePub = ePub

        console.log('[EpubReader] Creating epub instance with buffer (binary mode)')
        // 2. Pass the buffer AND explicitly tell epub.js it is binary data.
        const eb = await ePub(buffer, { encoding: 'binary' })
        bookRef.current = eb
        console.log('[EpubReader] epub instance created, waiting for ready...')

        // 3. Wait for the book's metadata and structure to be parsed
        await eb.ready
        console.log('[EpubReader] EPUB ready, manifest loaded')

        if (!mounted || !viewerRef.current) {
          console.log('[EpubReader] Component unmounted or viewer ref missing')
          return
        }

        setLoadMsg('Rendering...')
        console.log('[EpubReader] Calling renderTo on viewer...')

        // renderTo must happen AFTER eb.ready
        const r = eb.renderTo(viewerRef.current, {
          width:   '100%',
          height:  '100%',
          spread:  'none',
          flow:    'paginated',
          manager: DefaultViewManager,
          view:    IframeView,
          allowScriptedContent: false,
        })
        renditionRef.current = r
        console.log('[EpubReader] renderTo complete, applying theme...')

        const toc = eb.navigation?.toc || []
        setTocItems(flattenToc(toc))

        // Apply visual theme before display and keep it synced when pages rerender.
        applyTheme(r, readerSettingsRef.current.theme, readerSettingsRef.current.fontSize)
        watchIframes()
        r.on('displayed', () => {
          applyTheme(r, readerSettingsRef.current.theme, readerSettingsRef.current.fontSize)
          watchIframes()
        })
        if (r.on) r.on('rendered', () => {
          applyTheme(r, readerSettingsRef.current.theme, readerSettingsRef.current.fontSize)
          watchIframes()
        })

        // Restore last position or go to start
        const saved = localStorage.getItem(`grn_loc_${book.id}`)
        console.log('[EpubReader] Displaying EPUB at position:', saved || 'start')
        await r.display(saved || undefined)
        console.log('[EpubReader] EPUB displayed successfully')

        // Track location changes
        r.on('relocated', async (loc) => {
          if (!mounted) return
          const cfi = loc.start.cfi
          setCurrentCfi(cfi)
          localStorage.setItem(`grn_loc_${book.id}`, cfi)
          try {
            const pct = await eb.locations.percentageFromCfi(cfi)
            const p   = Math.round((pct || 0) * 100)
            setProgress(p)
            updateBook(book.id, { progress: p })
          } catch {
            // Some EPUBs do not generate percentage locations consistently.
          }
        })

        // Generate locations for progress % (non-blocking)
        const locationsPromise = eb.generateLocations
          ? eb.generateLocations(1024)
          : eb.locations?.generate?.(1024)
        Promise.resolve(locationsPromise).catch(() => {
          // Progress can still be tracked by CFI even if generated locations fail.
        })

        console.log('[EpubReader] Initialization complete, hiding loader')
        if (mounted) setLoading(false)

      } catch (e) {
        console.error('[EpubReader]', e)
        if (mounted) {
          setError(e.message || 'Unknown error opening file.')
          setLoading(false)
        }
      }
    }

    init()

    return () => {
      mounted = false
      if (bookRef.current)  { try { bookRef.current.destroy() } catch {
        // EPUB.js may already have torn down its managers during iframe unload.
      } }
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      stopWatchingIframes()
    }
  }, [book.id, book.file_path, book.file_name, book.file_type, applyTheme, stopWatchingIframes, updateBook, watchIframes])

  // ── Theme / font changes ──────────────────────────────────────
  const changeTheme = (t) => {
    readerSettingsRef.current = { ...readerSettingsRef.current, theme: t }
    setTheme(t)
    if (renditionRef.current) applyTheme(renditionRef.current, t, fontSize)
  }

  const changeFontSize = (fs) => {
    readerSettingsRef.current = { ...readerSettingsRef.current, fontSize: fs }
    setFontSize(fs)
    if (renditionRef.current) applyTheme(renditionRef.current, theme, fs)
    // Force re-apply theme to any live iframes immediately so font-size changes take effect
    try {
      if (viewerRef.current) {
        const iframes = viewerRef.current.querySelectorAll('iframe')
        iframes.forEach((f) => {
          try { applyThemeToIframe(f) } catch { /* ignore transient iframe access errors */ }
        })
      }
    } catch {
      // no-op
    }
  }

  // ── Actions ───────────────────────────────────────────────────
  const handleHighlight = () => {
    const sel = window.getSelection()
    if (!sel?.toString().trim()) { toast('Select some text first', 'error'); return }
    addHighlight({ book_id: book.id, text: sel.toString().trim(), cfi: currentCfi, color: 'gold', page_info: `${progress}%` })
    toast('Passage highlighted ✦', 'success')
    sel.removeAllRanges()
  }

  const handleBookmark = () => {
    addBookmark({ book_id: book.id, cfi: currentCfi, label: `Bookmark at ${progress}%`, page_info: `${progress}%` })
    toast('Bookmark saved ✦', 'success')
  }

  const handleDownload = () => {
    if (!fileBlob) return
    const url = URL.createObjectURL(fileBlob)
    const a   = document.createElement('a')
    a.href = url; a.download = book.file_name || book.title; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const handleOpenChapter = async (item) => {
    setTocOpen(false)
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
    } catch (error) {
      console.error('[EpubReader] Could not open chapter:', error)
      toast('That chapter could not be opened right now', 'error')
    }
  }

  // ── Shared toolbar renderer ───────────────────────────────────
  const Toolbar = ({ children }) => (
    <div className="reader-toolbar" style={{
      background: T.toolbar,
      borderBottom: `1px solid ${T.border}`,
      boxShadow: '0 24px 70px rgba(0,0,0,0.16)',
      backdropFilter: 'blur(16px)',
      padding: '1rem 1.1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '.75rem',
      flexShrink: 0,
      zIndex: 10,
    }}>
      {/* Left — close */}
      <button onClick={onClose} style={btnStyle(T)}>
        <X size={14} /> <span style={{ fontFamily: 'Cinzel, serif', fontSize: '.68rem' }}>Close</span>
      </button>

      {/* Center — title */}
      <span style={{ fontFamily: 'Cinzel, serif', fontSize: '.82rem', color: T.btnColor, fontWeight: 500, letterSpacing: '.04em', flex: 1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {book.title}
      </span>

      {/* Right — actions */}
      <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center', flexShrink: 0 }}>
        {children}
        <button onClick={handleDownload} style={iconBtnStyle(T)} title="Download">
          <Download size={14} />
        </button>
      </div>
    </div>
  )

  // ── Settings panel ────────────────────────────────────────────
  const SettingsPanel = () => (
    <div style={{ background: T.toolbar, borderBottom: `1px solid ${T.border}`, padding: '.55rem 1rem', display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
      {/* Theme pills */}
      <div style={{ display: 'flex', gap: '.35rem', alignItems: 'center' }}>
        <span style={labelStyle(T)}>THEME</span>
        {Object.entries(THEMES).map(([k, v]) => {
          const Icon = v.icon
          return (
            <button key={k} onClick={() => changeTheme(k)} style={{
              padding: '.22rem .6rem', borderRadius: 4, cursor: 'pointer',
              fontFamily: 'Cinzel, serif', fontSize: '.62rem',
              border: theme === k ? '2px solid #d4a843' : `1px solid ${T.border}`,
              background: v.bg, color: v.text,
              display: 'flex', alignItems: 'center', gap: '.25rem',
              fontWeight: theme === k ? 700 : 400,
            }}>
              <Icon size={10} /> {k.charAt(0).toUpperCase() + k.slice(1)}
            </button>
          )
        })}
      </div>

      {/* Font size */}
      <div style={{ display: 'flex', gap: '.3rem', alignItems: 'center' }}>
        <span style={labelStyle(T)}>SIZE</span>
        {[80, 90, 100, 115, 130].map(s => (
          <button key={s} onClick={() => changeFontSize(s)} style={{
            padding: '.22rem .45rem', borderRadius: 3, cursor: 'pointer',
            fontFamily: 'Cinzel, serif', fontSize: '.62rem',
            border: `1px solid ${T.border}`,
            background: fontSize === s ? '#9b1f35' : 'transparent',
            color: fontSize === s ? '#fff' : T.btnColor,
          }}>
            {s}%
          </button>
        ))}
      </div>
    </div>
  )

  // ── Bottom progress bar + nav ─────────────────────────────────
  const BottomBar = ({ showNav = true }) => (
    <div className="reader-controls" style={{ background: T.toolbar, borderTop: `1px solid ${T.border}`, padding: '.55rem 1rem', display: 'flex', alignItems: 'center', gap: '.75rem', flexShrink: 0 }}>
      {showNav && (
        <button onClick={() => renditionRef.current?.prev()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.btnColor, padding: '.2rem', display: 'flex' }}>
          <ChevronLeft size={22} />
        </button>
      )}
      <div style={{ flex: 1, height: 4, background: 'rgba(128,100,50,0.18)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#9b1f35,#d4a843)', borderRadius: 2, transition: 'width .4s' }} />
      </div>
      <span style={{ fontFamily: 'Cinzel, serif', fontSize: '.65rem', color: T.btnColor, opacity: .8, minWidth: 38, textAlign: 'right' }}>
        {progress}%
      </span>
      {showNav && (
        <button onClick={() => renditionRef.current?.next()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.btnColor, padding: '.2rem', display: 'flex' }}>
          <ChevronRight size={22} />
        </button>
      )}
    </div>
  )

  // ── Main render: Everything in one unified structure ────────────

  // Error state (rendered as overlay in EPUB return below)
  // PDF viewer
  if (isPdf) return (
    <div className={`reader-shell theme-${theme}`}>
      <div className="reader-panel">
        <Toolbar>
          {/* no extra epub-only buttons */}
        </Toolbar>

        <div className="reader-view pdf-viewer">
          <iframe
            src={pdfViewerUrl || pdfBlobUrl}
            title={book.title}
            className="pdf-frame"
          />
          <div className="pdf-ios-fallback">
            <div style={{ fontSize: '3rem' }}>📄</div>
            <p style={{ fontFamily: 'Cinzel, serif', fontSize: '.9rem', maxWidth: 280, lineHeight: 1.6 }}>
              PDF inline preview isn't supported on this browser.<br/>Download to read.
            </p>
            <button onClick={handleDownload} style={{ background: '#d4a843', color: '#1a1208', border: 'none', borderRadius: 4, padding: '.6rem 1.4rem', fontFamily: 'Cinzel, serif', fontSize: '.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
              <Download size={14} /> Download PDF
            </button>
          </div>
        </div>

        <BottomBar showNav={false} />
      </div>

      <style>{`
        .pdf-viewer { position: relative; flex: 1; overflow: hidden; }
        .pdf-frame { width: 100%; height: 100%; border: none; background: #f7f2e8; }
        .pdf-frame::-webkit-scrollbar { display: none; }
        .pdf-ios-fallback { display: none; position: absolute; inset: 0; align-items: center; justify-content: center; flex-direction: column; gap: 1rem; background: #2a2a2a; color: #ddd; text-align: center; padding: 2rem; }
        @supports (-webkit-touch-callout: none) {
          .pdf-ios-fallback { display: flex !important; }
          embed[type="application/pdf"] { display: none !important; }
        }
      `}</style>
    </div>
  )

  // ── EPUB viewer ───────────────────────────────────────────────
  return (
    <div className={`reader-shell theme-${theme}`}>
      <div className="reader-panel">
      {/* Overlay: Loading state */}
      {loading && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 100, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', pointerEvents: 'none' }}>
          <div style={{ fontSize: '2.5rem', animation: 'pulse 2s ease infinite' }}>📖</div>
          <p style={{ fontFamily: '"IM Fell English", serif', fontStyle: 'italic', color: T.btnColor, fontSize: '1.05rem', opacity: .75 }}>{loadMsg}</p>
          <style>{`@keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}`}</style>
        </div>
      )}

      {/* Overlay: Error state */}
      {error && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 100, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem', textAlign: 'center', pointerEvents: 'auto' }}>
          <div style={{ fontSize: '3rem' }}>📖</div>
          <p style={{ fontFamily: 'Cinzel, serif', color: T.btnColor, fontSize: '.95rem', maxWidth: 360, lineHeight: 1.7 }}>{error}</p>
          <button onClick={onClose} style={{ ...btnStyle(T), marginTop: '.5rem' }}>← Back to Library</button>
        </div>
      )}

      {/* Main EPUB interface */}
      <Toolbar>
        <button onClick={handleHighlight} style={btnStyle(T)} title="Highlight selected text">
          <Highlighter size={13} /> <span style={{ fontFamily: 'Cinzel, serif', fontSize: '.65rem' }} className="hide-xs">Highlight</span>
        </button>
        <button onClick={handleBookmark} style={btnStyle(T)} title="Bookmark this page">
          <Bookmark size={13} /> <span style={{ fontFamily: 'Cinzel, serif', fontSize: '.65rem' }} className="hide-xs">Bookmark</span>
        </button>
        <button onClick={() => setTocOpen(s => !s)} style={iconBtnStyle(T, tocOpen)} title="Table of contents">
          <BookOpen size={14} />
        </button>
        <button onClick={() => setShowSettings(s => !s)} style={iconBtnStyle(T, showSettings)} title="Reader settings">
          <Settings size={14} />
        </button>
      </Toolbar>

      {showSettings && <SettingsPanel />}

      {tocOpen && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 130, background: 'rgba(8,6,4,0.78)', display: 'flex' }} onClick={() => setTocOpen(false)}>
          <div style={{ width: 'min(320px, 86vw)', height: '100%', background: T.toolbar, borderRight: `1px solid ${T.border}`, overflowY: 'auto', padding: '1rem', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '.8rem', color: T.btnColor, marginBottom: '.7rem' }}>Contents</div>
            {tocItems.length === 0 && <div style={{ fontSize: '.82rem', color: T.btnColor, opacity: .8 }}>No chapter list available for this book.</div>}
            {tocItems.map((item, idx) => (
              <button key={`${item.href || item.id || idx}`} onClick={() => handleOpenChapter(item)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '.45rem 0', background: 'transparent', border: 'none', color: T.btnColor, cursor: 'pointer', fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: '.9rem', lineHeight: 1.4 }}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* The epub canvas — ALWAYS rendered so ref is accessible */}
      <div className="reader-view" style={{ background: T.bg }}>
        <div ref={viewerRef} style={{ width: '100%', height: '100%' }} />
      </div>

      <BottomBar showNav={true} />

      <style>{`
        .hide-xs { }
        @media(max-width:480px){ .hide-xs{ display:none } }

        /* Reader shell improvements: compact glass morphism toolbar + controls */
        .reader-shell { display: flex; flex-direction: column; height: 100vh; width: 100%; }
        .reader-panel { display: flex; flex-direction: column; flex: 1; margin: 0 auto; max-width: 920px; width: 100%; border-radius: 14px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.12); background: linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0.55)); }

        .reader-toolbar, .reader-controls { flex-direction: row !important; align-items: center !important; justify-content: space-between !important; padding: .6rem 1rem !important; gap: .6rem !important; }
        .reader-toolbar { border-bottom: 1px solid rgba(0,0,0,0.06) !important; }
        .reader-controls { border-top: 1px solid rgba(0,0,0,0.06) !important; }

        .reader-toolbar button, .reader-controls button { border-radius: 10px; padding: .35rem .7rem; }
        .reader-toolbar span, .reader-controls span { font-family: 'Cinzel', serif; }

        .reader-view { flex: 1 1 auto; min-height: 0; display: flex; align-items: stretch; }
        .reader-view > div, .reader-view iframe { width: 100%; height: 100%; }

        /* Make toolbars compact on small screens but still accessible */
        @media (max-width: 520px) {
          .reader-panel { border-radius: 10px; margin: 10px; }
          .reader-toolbar, .reader-controls { padding: .5rem .7rem !important; gap: .45rem !important; }
          .reader-toolbar span { font-size: .78rem !important; }
          .reader-toolbar .hide-xs, .reader-controls .hide-xs { display: none !important; }
        }

        /* subtle glass effect */
        .reader-toolbar, .reader-controls { background: rgba(255,255,255,0.72); backdrop-filter: blur(10px); }
        .theme-dark .reader-toolbar, .theme-dark .reader-controls { background: rgba(20,16,12,0.6); }

        /* tap target hints (invisible) */
        .grn-tap-target { position: absolute; inset: 0; pointer-events: none; }
      `}</style>
    </div>
  </div>
  )
}

// ── Style helpers ─────────────────────────────────────────────
const btnStyle = (T) => ({
  background: 'rgba(255,255,255,0.08)',
  border: `1px solid ${T.border}`,
  borderRadius: 10,
  cursor: 'pointer',
  color: T.btnColor,
  padding: '.45rem .85rem',
  display: 'flex',
  alignItems: 'center',
  gap: '.35rem',
  transition: 'all .18s ease',
})

const iconBtnStyle = (T, active = false) => ({
  background: active ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)',
  border: `1px solid ${T.border}`,
  borderRadius: 10,
  cursor: 'pointer',
  color: T.btnColor,
  padding: '.4rem .5rem',
  display: 'flex',
  alignItems: 'center',
  transition: 'all .18s ease',
})

const labelStyle = (T) => ({
  fontFamily: 'Cinzel, serif',
  fontSize: '.58rem',
  letterSpacing: '.12em',
  color: T.btnColor,
  opacity: .65,
  marginRight: '.15rem',
})
