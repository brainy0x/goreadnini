import { useEffect, useRef, useState, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, Bookmark, Highlighter, Settings, Download, Sun, Moon, Coffee, BookOpen, Lock, Unlock } from 'lucide-react' 
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
  const blobUrlRef      = useRef(null)
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
  const [isOrientationLocked, setIsOrientationLocked] = useState(false)

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
        if (event.target.closest && event.target.closest('a, button, input, textarea, select')) return
        const sel = (doc.getSelection && doc.getSelection().toString && doc.getSelection().toString()) || ''
        if (sel && sel.trim()) return

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
      } catch {}
    }
    doc.addEventListener('pointerup', onTap, true)
    doc.__grnTapAttached = true
  }, [])

  // 🎯 FIXED: Predefined padding without breaking epubjs internal flow
  const FONT_SIZE_PADDING = {
    80: '55px',
    90: '45px',
    100: '35px',
    115: '25px',
    130: '15px'
  }

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
      
      // Apply the padding to keep text away from edges
      const paddingAmount = FONT_SIZE_PADDING[activeFontSize] || '35px';
      if (doc.body) {
        // 🚫 DO NOT use flexbox. Let epubjs handle its own flow.
        doc.body.style.display = 'block';
        doc.body.style.margin = '0 auto';
        doc.body.style.padding = `0 ${paddingAmount}`;
        doc.body.style.width = '100%';
        doc.body.style.boxSizing = 'border-box';
      }

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
    if (viewerRef.current) {
      viewerRef.current.style.background = th.bg
      viewerRef.current.style.color = th.text
    }
    applyReaderThemeToRendition(r, t, fs)
    watchIframes()
  }, [watchIframes])

  // ── Handle screen resizing ────────────────────────────────────
    // 🔥 SENIOR ENGINEER FIX: Use ResizeObserver to measure the container natively
  useEffect(() => {
    if (!viewerRef.current || !renditionRef.current) return;

    // Create a native observer that fires exactly when the container changes size
    const resizeObserver = new ResizeObserver(() => {
      // Use requestAnimationFrame to align with the browser's paint cycle
      requestAnimationFrame(() => {
        try {
          renditionRef.current?.resize?.();
        } catch {}
      });
    });

    // Start observing the container div
    resizeObserver.observe(viewerRef.current);
    
    // Cleanup on unmount
    return () => {
      resizeObserver.disconnect();
    };
  }, []); // Runs only once on mount

  // ── Tap to flip pages ─────────────────────────────────────────
  useEffect(() => {
    const onTap = (event) => {
      try {
        if (!viewerRef.current) return
        const toolbar = viewerRef.current.closest('.reader-panel')?.querySelector('.reader-toolbar')
        if (toolbar && toolbar.contains(event.target)) return
        if (event.target.closest && event.target.closest('a, button, input, textarea, select')) return
        const sel = (window.getSelection && window.getSelection().toString && window.getSelection().toString()) || ''
        if (sel && sel.trim()) return
        const rect = viewerRef.current.getBoundingClientRect()
        const rel = (event.clientX - rect.left) / rect.width
        if (rel > 0.62) renditionRef.current?.next()
        else if (rel < 0.38) renditionRef.current?.prev()
      } catch {}
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
        const stored = await getFile(book.file_path)
        if (!stored) {
          throw new Error('File not found in Supabase Storage. Please re-upload the file.')
        }
        const file = stored?.file ?? stored
        if (!(file instanceof Blob)) {
          throw new Error('Stored file is corrupted. Please re-upload.')
        }
        setFileBlob(file)

        const fileType = book.file_type ||
          (file.type === 'application/pdf' ? 'pdf' :
            (book.file_name?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'epub'))

        if (fileType === 'pdf') {
          setIsPdf(true)
          const url = URL.createObjectURL(file)
          blobUrlRef.current = url
          setPdfBlobUrl(url)
          setLoading(false)
          return
        }

        setLoadMsg('Parsing epub...')
        const buffer = await file.arrayBuffer()

        setLoadMsg('Starting reader...')
        const epubModule = await import('epubjs')
        const ePub = epubModule.default ?? epubModule.ePub ?? epubModule

        if (typeof ePub !== 'function') {
          throw new Error('Could not load epub reader library.')
        }

        window.ePub = ePub
        const eb = await ePub(buffer, { encoding: 'binary' })
        bookRef.current = eb
        await eb.ready

        if (!mounted || !viewerRef.current) return

        setLoadMsg('Rendering...')

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

        const toc = eb.navigation?.toc || []
        setTocItems(flattenToc(toc))

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

        const saved = localStorage.getItem(`grn_loc_${book.id}`)
        await r.display(saved || undefined)

        // 🔥 FIX: Force layout correction AFTER the initial load
        setTimeout(() => {
          if (mounted && r) {
            try { r.resize?.() } catch {}
            try { watchIframes() } catch {}
          }
        }, 150)

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
          } catch {}
        })

        const locationsPromise = eb.generateLocations
          ? eb.generateLocations(1024)
          : eb.locations?.generate?.(1024)
        Promise.resolve(locationsPromise).catch(() => {})

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
      if (bookRef.current)  { try { bookRef.current.destroy() } catch {} }
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      stopWatchingIframes()
    }
  }, [book.id, book.file_path, book.file_name, book.file_type, applyTheme, stopWatchingIframes, updateBook, watchIframes])

  // ── Theme / font changes (BRUTALLY SIMPLE FIX) ──────────────
  const changeTheme = (t) => {
    readerSettingsRef.current = { ...readerSettingsRef.current, theme: t }
    setTheme(t)
    if (renditionRef.current) {
      applyTheme(renditionRef.current, t, fontSize)
      // 🔥 DIRTY HACK: Switch flow to scrolled and back to force a hard DOM rebuild
      const currentFlow = renditionRef.current.settings.flow || 'paginated'
      renditionRef.current.flow('scrolled')
      setTimeout(() => {
        if (renditionRef.current) {
          renditionRef.current.flow(currentFlow)
        }
      }, 0)
    }
  }

  const changeFontSize = (fs) => {
    readerSettingsRef.current = { ...readerSettingsRef.current, fontSize: fs }
    setFontSize(fs)
    if (renditionRef.current) {
      // Apply theme to the overall rendition (handles epubjs internal)
      applyTheme(renditionRef.current, theme, fs)
      // Just in case epubjs wipes it, force a fake resize to make it trigger
      renditionRef.current?.resize?.()
    }
    // 🎯 Force update the iframe padding directly
    try {
      if (viewerRef.current) {
        const iframes = viewerRef.current.querySelectorAll('iframe')
        iframes.forEach((f) => {
          try { applyThemeToIframe(f) } catch {}
        })
      }
    } catch {}
  }

    // ── Toggle orientation lock ────────────────────────────────────
  const toggleOrientationLock = async () => {
    try {
      if (!isOrientationLocked) {
        // Force the screen to lock into portrait
        await screen.orientation.lock('portrait');
      } else {
        // Unlock it so it can rotate freely again
        await screen.orientation.unlock();
      }
      setIsOrientationLocked(!isOrientationLocked);
    } catch (err) {
      // If the API isn't supported (desktop browser), we just silently skip it.
      console.warn('Orientation lock skipped:', err);
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
      <button onClick={onClose} style={btnStyle(T)}>
        <X size={14} /> <span style={{ fontFamily: 'Cinzel, serif', fontSize: '.68rem' }}>Close</span>
      </button>
      <span style={{ fontFamily: 'Cinzel, serif', fontSize: '.82rem', color: T.btnColor, fontWeight: 500, letterSpacing: '.04em', flex: 1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {book.title}
      </span>
      <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center', flexShrink: 0 }}>
        {children}
        <button onClick={toggleOrientationLock} style={iconBtnStyle(T)} title={isOrientationLocked ? "Unlock rotation" : "Lock portrait"}>
          {isOrientationLocked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>
        <button onClick={handleDownload} style={iconBtnStyle(T)} title="Download">
          <Download size={14} />
        </button>
      </div>
    </div>
  )

  const SettingsPanel = () => (
    <div style={{ background: T.toolbar, borderBottom: `1px solid ${T.border}`, padding: '.55rem 1rem', display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
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

  if (isPdf) return (
    <div className={`reader-shell theme-${theme}`}>
      <div className="reader-panel">
        <Toolbar />
        <div className="reader-view pdf-viewer">
          <iframe src={pdfViewerUrl || pdfBlobUrl} title={book.title} className="pdf-frame" />
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
    </div>
  )

  return (
    <div className={`reader-shell theme-${theme}`}>
      <div className="reader-panel">
      {loading && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 100, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', pointerEvents: 'none' }}>
          <div style={{ fontSize: '2.5rem', animation: 'pulse 2s ease infinite' }}>📖</div>
          <p style={{ fontFamily: '"IM Fell English", serif', fontStyle: 'italic', color: T.btnColor, fontSize: '1.05rem', opacity: .75 }}>{loadMsg}</p>
          <style>{`@keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}`}</style>
        </div>
      )}

      {error && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 100, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem', textAlign: 'center', pointerEvents: 'auto' }}>
          <div style={{ fontSize: '3rem' }}>📖</div>
          <p style={{ fontFamily: 'Cinzel, serif', color: T.btnColor, fontSize: '.95rem', maxWidth: 360, lineHeight: 1.7 }}>{error}</p>
          <button onClick={onClose} style={{ ...btnStyle(T), marginTop: '.5rem' }}>← Back to Library</button>
        </div>
      )}

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
            {tocItems.length === 0 && <div style={{ fontSize: '.82rem', color: T.btnColor, opacity: .8 }}>No chapter list available.</div>}
            {tocItems.map((item, idx) => (
              <button key={`${item.href || item.id || idx}`} onClick={() => handleOpenChapter(item)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '.45rem 0', background: 'transparent', border: 'none', color: T.btnColor, cursor: 'pointer', fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: '.9rem', lineHeight: 1.4 }}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="reader-view" style={{ background: T.bg }}>
        <div ref={viewerRef} style={{ width: '100%', height: '100%' }} />
      </div>

      <BottomBar showNav={true} />

      <style>{`
        .hide-xs { }
        @media(max-width:480px){ .hide-xs{ display:none } }
        .reader-shell { display: flex; flex-direction: column; height: 100vh; width: 100%; }
        .reader-panel { display: flex; flex-direction: column; flex: 1; margin: 0 auto; max-width: 920px; width: 100%; border-radius: 14px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.12); background: linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0.55)); }
        .reader-toolbar, .reader-controls { flex-direction: row !important; align-items: center !important; justify-content: space-between !important; padding: .6rem 1rem !important; gap: .6rem !important; }
        .reader-toolbar { border-bottom: 1px solid rgba(0,0,0,0.06) !important; }
        .reader-controls { border-top: 1px solid rgba(0,0,0,0.06) !important; }
        .reader-toolbar button, .reader-controls button { border-radius: 10px; padding: .35rem .7rem; }
        .reader-toolbar span, .reader-controls span { font-family: 'Cinzel', serif; }
        .reader-view { flex: 1 1 auto; min-height: 0; display: flex; align-items: stretch; }
        .reader-view > div, .reader-view iframe { width: 100%; height: 100%; }
        @media (max-width: 880px) {
          .reader-panel { margin: 0.7rem auto !important; width: calc(100% - 1.4rem) !important; max-width: 100% !important; }
        }
        @media (max-width: 520px) {
          .reader-panel { margin: 0.5rem auto !important; border-radius: 10px; width: calc(100% - 1rem) !important; max-width: 100% !important; }
          .reader-toolbar, .reader-controls { padding: .5rem .7rem !important; gap: .45rem !important; }
          .reader-toolbar span { font-size: .78rem !important; }
          .reader-toolbar .hide-xs, .reader-controls .hide-xs { display: none !important; }
        }
        .reader-toolbar, .reader-controls { background: rgba(255,255,255,0.72); backdrop-filter: blur(10px); }
        .theme-dark .reader-toolbar, .theme-dark .reader-controls { background: rgba(20,16,12,0.6); }
      `}</style>
    </div>
  </div>
  )
}

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