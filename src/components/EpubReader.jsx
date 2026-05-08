import { useEffect, useRef, useState, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, Bookmark, Highlighter, Settings, Download, Sun, Moon, Coffee } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import { useToast } from '../contexts/ToastContext'
import { getFile } from '../lib/fileStorage'

const THEMES = {
  light: { bg: '#f8f3e8', text: '#1e1508', toolbar: '#ede5d0', border: 'rgba(0,0,0,0.12)', btnColor: '#4a3820', icon: Sun   },
  sepia: { bg: '#efe3c8', text: '#3d2b0e', toolbar: '#e4d4b0', border: 'rgba(0,0,0,0.12)', btnColor: '#5a3a10', icon: Coffee},
  dark:  { bg: '#14100c', text: '#ddd0b8', toolbar: '#1e1810', border: 'rgba(212,168,67,.18)', btnColor: '#c4a068', icon: Moon  },
}

export default function EpubReader({ book, onClose }) {
  const { updateBook, addHighlight, addBookmark } = useBooks()
  const toast = useToast()

  const viewerRef    = useRef(null)
  const renditionRef = useRef(null)
  const bookRef      = useRef(null)
  const blobUrlRef   = useRef(null) // track blob URLs for cleanup

  const [progress,     setProgress]     = useState(book.progress || 0)
  const [theme,        setTheme]        = useState('light')
  const [fontSize,     setFontSize]     = useState(100)
  const [showSettings, setShowSettings] = useState(false)
  const [currentCfi,   setCurrentCfi]   = useState('')
  const [loading,      setLoading]      = useState(true)
  const [loadMsg,      setLoadMsg]      = useState('Opening your book...')
  const [error,        setError]        = useState(null)
  const [isPdf,        setIsPdf]        = useState(false)
  const [pdfBlobUrl,   setPdfBlobUrl]   = useState(null)
  const [fileBlob,     setFileBlob]     = useState(null)

  const T = THEMES[theme]

  // ── Apply epub theme styles ──────────────────────────────────
  const applyTheme = useCallback((r, t, fs) => {
    const th = THEMES[t]
    r.themes.default({
      '*': {
        'color':       `${th.text} !important`,
        'background':  `${th.bg} !important`,
      },
      'body': {
        'background':   `${th.bg} !important`,
        'color':        `${th.text} !important`,
        'font-family':  '"Cormorant Garamond", Georgia, serif !important',
        'font-size':    `${fs}% !important`,
        'line-height':  '1.9 !important',
        'padding':      '2rem 3rem !important',
        'max-width':    '100% !important',
        'margin':       '0 !important',
      },
      'p': {
        'margin-bottom': '1.1em !important',
        'text-indent':   '1.5em !important',
      },
      'h1, h2, h3': {
        'font-family': '"Cinzel", serif !important',
        'color':       `${th.text} !important`,
        'text-indent': '0 !important',
      },
      'a': { 'color': '#9b5030 !important' },
      'img': { 'max-width': '100% !important' },
    })
  }, [])

  // ── Load file and init reader ────────────────────────────────
  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        setLoadMsg('Loading file...')

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
          (book.file_name?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'epub')

        // ── PDF path ─────────────────────────────────────────
        if (fileType === 'pdf') {
          setIsPdf(true)
          const url = URL.createObjectURL(file)
          blobUrlRef.current = url
          setPdfBlobUrl(url)
          setLoading(false)
          return
        }

      // ... (PDF check above remains the same)
      // ── EPUB path ─────────────────────────────────────────
        setLoadMsg('Parsing epub...')

        // 1. Get the raw ArrayBuffer from Supabase
        const buffer = await file.arrayBuffer()

        setLoadMsg('Starting reader...')
        const epubModule = await import('epubjs')
        const ePub = epubModule.default ?? epubModule.ePub ?? epubModule

        if (typeof ePub !== 'function') {
          throw new Error('Could not load epub reader library.')
        }

        // 2. Pass the buffer AND explicitly tell epub.js it is binary data.
        // This bypasses the buggy instanceof check and prevents your React
        // router from serving index.html in the background.
        const eb = ePub(buffer, { encoding: 'binary' })
        bookRef.current = eb

        // 3. Wait for the book's metadata and structure to be parsed
        await eb.ready

        if (!mounted || !viewerRef.current) return

        setLoadMsg('Rendering...')

        // renderTo must happen AFTER eb.ready
        const r = eb.renderTo(viewerRef.current, {
          width:   '100%',
          height:  '100%',
          spread:  'none',
          flow:    'paginated',
          manager: 'default',
          allowScriptedContent: false,
        })
        renditionRef.current = r
        
        // ... rest of the code remains the same

        // Apply visual theme before display
        applyTheme(r, 'light', 100)

        // Restore last position or go to start
        const saved = localStorage.getItem(`grn_loc_${book.id}`)
        await r.display(saved || undefined)

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
          } catch {}
        })

        // Generate locations for progress % (non-blocking)
        eb.locations.generate(1024).catch(() => {})

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
    }
  }, [book.id, book.file_path, book.file_name, book.file_type])

  // ── Theme / font changes ──────────────────────────────────────
  const changeTheme = (t) => {
    setTheme(t)
    if (renditionRef.current) applyTheme(renditionRef.current, t, fontSize)
  }

  const changeFontSize = (fs) => {
    setFontSize(fs)
    if (renditionRef.current) applyTheme(renditionRef.current, theme, fs)
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

  // ── Shared toolbar renderer ───────────────────────────────────
  const Toolbar = ({ children }) => (
    <div style={{
      background: T.toolbar,
      borderBottom: `1px solid ${T.border}`,
      padding: '.7rem 1rem',
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
    <div style={{ background: T.toolbar, borderTop: `1px solid ${T.border}`, padding: '.55rem 1rem', display: 'flex', alignItems: 'center', gap: '.75rem', flexShrink: 0 }}>
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

  // ── Loading state ─────────────────────────────────────────────
  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
      <div style={{ fontSize: '2.5rem', animation: 'pulse 2s ease infinite' }}>📖</div>
      <p style={{ fontFamily: '"IM Fell English", serif', fontStyle: 'italic', color: T.btnColor, fontSize: '1.05rem', opacity: .75 }}>{loadMsg}</p>
      <style>{`@keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}`}</style>
    </div>
  )

  // ── Error state ───────────────────────────────────────────────
  if (error) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem' }}>📖</div>
      <p style={{ fontFamily: 'Cinzel, serif', color: T.btnColor, fontSize: '.95rem', maxWidth: 360, lineHeight: 1.7 }}>{error}</p>
      <button onClick={onClose} style={{ ...btnStyle(T), marginTop: '.5rem' }}>← Back to Library</button>
    </div>
  )

  // ── PDF viewer ────────────────────────────────────────────────
  if (isPdf) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', flexDirection: 'column', background: '#3a3a3a' }}>
      <Toolbar>
        {/* no extra epub-only buttons */}
      </Toolbar>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Desktop — embed PDF natively */}
        <embed
          src={pdfBlobUrl}
          type="application/pdf"
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        />
        {/* iOS / mobile fallback */}
        <div style={{
          display: 'none',
          position: 'absolute', inset: 0,
          alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: '1rem',
          background: '#2a2a2a', color: '#ddd',
          textAlign: 'center', padding: '2rem',
        }} className="pdf-ios-fallback">
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

      <style>{`
        @supports (-webkit-touch-callout: none) {
          .pdf-ios-fallback { display: flex !important; }
          embed[type="application/pdf"] { display: none !important; }
        }
      `}</style>
    </div>
  )

  // ── EPUB viewer ───────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', flexDirection: 'column', background: T.bg }}>
      <Toolbar>
        <button onClick={handleHighlight} style={btnStyle(T)} title="Highlight selected text">
          <Highlighter size={13} /> <span style={{ fontFamily: 'Cinzel, serif', fontSize: '.65rem' }} className="hide-xs">Highlight</span>
        </button>
        <button onClick={handleBookmark} style={btnStyle(T)} title="Bookmark this page">
          <Bookmark size={13} /> <span style={{ fontFamily: 'Cinzel, serif', fontSize: '.65rem' }} className="hide-xs">Bookmark</span>
        </button>
        <button onClick={() => setShowSettings(s => !s)} style={iconBtnStyle(T, showSettings)} title="Reader settings">
          <Settings size={14} />
        </button>
      </Toolbar>

      {showSettings && <SettingsPanel />}

      {/* The epub canvas */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: T.bg }}>
        <div ref={viewerRef} style={{ width: '100%', height: '100%' }} />
      </div>

      <BottomBar showNav={true} />

      <style>{`.hide-xs { } @media(max-width:480px){.hide-xs{display:none}}`}</style>
    </div>
  )
}

// ── Style helpers ─────────────────────────────────────────────
const btnStyle = (T) => ({
  background: 'none',
  border: `1px solid ${T.border}`,
  borderRadius: 4,
  cursor: 'pointer',
  color: T.btnColor,
  padding: '.3rem .65rem',
  display: 'flex',
  alignItems: 'center',
  gap: '.3rem',
  transition: 'background .15s',
})

const iconBtnStyle = (T, active = false) => ({
  background: active ? 'rgba(128,90,40,0.15)' : 'none',
  border: `1px solid ${T.border}`,
  borderRadius: 4,
  cursor: 'pointer',
  color: T.btnColor,
  padding: '.3rem .4rem',
  display: 'flex',
  alignItems: 'center',
})

const labelStyle = (T) => ({
  fontFamily: 'Cinzel, serif',
  fontSize: '.58rem',
  letterSpacing: '.12em',
  color: T.btnColor,
  opacity: .65,
  marginRight: '.15rem',
})