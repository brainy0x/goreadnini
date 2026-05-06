import { useEffect, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Bookmark, Highlighter, Settings, Download } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import { useToast } from '../contexts/ToastContext'
import { getFile } from '../lib/fileStorage'

const THEMES = {
  light: { bg: '#f8f3e8', text: '#1e1508', toolbar: '#ede5d0', border: 'rgba(0,0,0,0.1)',  btnColor: '#4a3820' },
  sepia: { bg: '#efe3c8', text: '#3d2b0e', toolbar: '#e4d4b0', border: 'rgba(0,0,0,0.1)',  btnColor: '#4a3820' },
  dark:  { bg: '#14100c', text: '#ddd0b8', toolbar: '#1e1810', border: 'rgba(212,168,67,.15)', btnColor: '#c4a068' },
}

export default function EpubReader({ book, onClose }) {
  const { updateBook, addHighlight, addBookmark } = useBooks()
  const toast  = useToast()
  const viewerRef    = useRef()
  const renditionRef = useRef()
  const bookRef      = useRef()

  const [progress,      setProgress]      = useState(book.progress || 0)
  const [theme,         setTheme]         = useState('light')
  const [fontSize,      setFontSize]      = useState(100)
  const [showSettings,  setShowSettings]  = useState(false)
  const [currentCfi,    setCurrentCfi]    = useState('')
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [isPdf,         setIsPdf]         = useState(false)
  const [pdfBlobUrl,    setPdfBlobUrl]    = useState(null)
  const [fileBlob,      setFileBlob]      = useState(null)  // for download fallback

  const T = THEMES[theme]

  const applyTheme = (r, t, fs) => {
    const th = THEMES[t]
    r.themes.default({
      body: {
        'background':   `${th.bg} !important`,
        'color':        `${th.text} !important`,
        'font-family':  '"Cormorant Garamond", Georgia, serif !important',
        'font-size':    `${fs}% !important`,
        'line-height':  '1.85 !important',
        'padding':      '0 2.5rem !important',
        'max-width':    '680px !important',
        'margin':       '0 auto !important',
      },
      p:  { 'margin-bottom': '1em !important' },
      h1: { 'font-family': '"Cinzel", serif !important', 'color': `${th.text} !important` },
      h2: { 'font-family': '"Cinzel", serif !important', 'color': `${th.text} !important` },
    })
  }

  useEffect(() => {
    const fileType = book.file_type || (book.file_name?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'epub')

    const loadFile = async () => {
      // Validate that file_path exists
      if (!book.file_path) {
        setError('No file path found. This book may not have been fully uploaded.')
        setLoading(false)
        return
      }

      try {
        // Get file from Supabase Storage
        const stored = await getFile(book.file_path)
        if (!stored) {
          setError('File not found in Supabase Storage. Please re-upload the file.')
          setLoading(false)
          return
        }

        const file = stored.file || stored
        setFileBlob(file)

        if (fileType === 'pdf') {
          setIsPdf(true)
          const url = URL.createObjectURL(file)
          setPdfBlobUrl(url)
          setLoading(false)
          return
        }

        // ePub
        let mounted = true
        try {
          const Epub = (await import('epubjs')).default
          const arrayBuffer = await file.arrayBuffer()
          const eb = Epub(arrayBuffer)
          bookRef.current = eb

          const r = eb.renderTo(viewerRef.current, { width: '100%', height: '100%', spread: 'none' })
          renditionRef.current = r
          applyTheme(r, 'light', 100)

          const saved = localStorage.getItem(`grn_loc_${book.id}`)
          r.display(saved || undefined)

          r.on('relocated', async (loc) => {
            if (!mounted) return
            const cfi = loc.start.cfi
            setCurrentCfi(cfi)
            localStorage.setItem(`grn_loc_${book.id}`, cfi)
            try {
              const pct = await eb.locations.percentageFromCfi(cfi)
              const p = Math.round(pct * 100)
              setProgress(p)
              updateBook(book.id, { progress: p })
            } catch {}
          })

          await eb.locations.generate(1024)
          if (mounted) setLoading(false)
        } catch (e) {
          console.error('ePub render error:', e)
          if (mounted) { setError('Could not open this epub file.'); setLoading(false) }
        }
      } catch (storageError) {
        console.error('Supabase storage error:', storageError)
        const msg = storageError?.message || JSON.stringify(storageError)
        setError(`Failed to load from storage: ${msg}`)
        setLoading(false)
      }
    }

    loadFile()
    return () => { bookRef.current?.destroy() }
  }, [book.id])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => { if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl) }
  }, [pdfBlobUrl])

  const changeTheme = (t) => { setTheme(t); if (renditionRef.current) applyTheme(renditionRef.current, t, fontSize) }
  const changeFontSize = (fs) => { setFontSize(fs); if (renditionRef.current) applyTheme(renditionRef.current, theme, fs) }

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
    const a = document.createElement('a')
    a.href = url; a.download = book.file_name || book.title
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── SHARED TOOLBAR ──
  const Toolbar = () => (
    <div style={{ background: T.toolbar, borderBottom: `1px solid ${T.border}`, padding: '.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', flexShrink: 0 }}>
      <button onClick={onClose} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '.3rem', color: T.btnColor, fontFamily: 'Cinzel, serif', fontSize: '.68rem', padding: '.3rem .7rem' }}>
        <X size={13} /> Close
      </button>
      <span style={{ fontFamily: 'Cinzel, serif', fontSize: '.82rem', color: T.btnColor, fontWeight: 500, letterSpacing: '.05em', flex: 1, textAlign: 'center', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {book.title}
      </span>
      <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
        {!isPdf && <>
          <button onClick={handleHighlight} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '.3rem', color: T.btnColor, fontFamily: 'Cinzel, serif', fontSize: '.65rem', padding: '.3rem .6rem' }}>
            <Highlighter size={11} /><span className="hide-mobile">Highlight</span>
          </button>
          <button onClick={handleBookmark} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '.3rem', color: T.btnColor, fontFamily: 'Cinzel, serif', fontSize: '.65rem', padding: '.3rem .6rem' }}>
            <Bookmark size={11} /><span className="hide-mobile">Bookmark</span>
          </button>
        </>}
        <button onClick={handleDownload} title="Download file" style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4, cursor: 'pointer', color: T.btnColor, padding: '.3rem .45rem', display: 'flex', alignItems: 'center' }}>
          <Download size={13} />
        </button>
        {!isPdf && (
          <button onClick={() => setShowSettings(s => !s)} style={{ background: showSettings ? 'rgba(128,100,50,0.15)' : 'none', border: `1px solid ${T.border}`, borderRadius: 4, cursor: 'pointer', color: T.btnColor, padding: '.3rem .45rem', display: 'flex', alignItems: 'center' }}>
            <Settings size={13} />
          </button>
        )}
      </div>
    </div>
  )

  // ── SETTINGS PANEL ──
  const SettingsPanel = () => (
    <div style={{ background: T.toolbar, borderBottom: `1px solid ${T.border}`, padding: '.6rem 1rem', display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: '.35rem', alignItems: 'center' }}>
        <span style={{ fontFamily: 'Cinzel, serif', fontSize: '.58rem', letterSpacing: '.12em', color: T.btnColor, opacity: .7 }}>THEME</span>
        {Object.entries(THEMES).map(([k]) => (
          <button key={k} onClick={() => changeTheme(k)} style={{ padding: '.2rem .55rem', borderRadius: 3, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontSize: '.62rem', border: theme === k ? `2px solid var(--gold)` : `1px solid ${T.border}`, background: THEMES[k].bg, color: THEMES[k].text, fontWeight: theme === k ? 600 : 400 }}>
            {k.charAt(0).toUpperCase() + k.slice(1)}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '.35rem', alignItems: 'center' }}>
        <span style={{ fontFamily: 'Cinzel, serif', fontSize: '.58rem', letterSpacing: '.12em', color: T.btnColor, opacity: .7 }}>SIZE</span>
        {[80, 90, 100, 115, 130].map(s => (
          <button key={s} onClick={() => changeFontSize(s)} style={{ padding: '.2rem .45rem', borderRadius: 3, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontSize: '.62rem', border: `1px solid ${T.border}`, background: fontSize === s ? '#9b1f35' : 'transparent', color: fontSize === s ? '#fff' : T.btnColor }}>
            {s}%
          </button>
        ))}
      </div>
    </div>
  )

  // ── BOTTOM NAV ──
  const BottomNav = ({ showNav = true }) => (
    <div style={{ background: T.toolbar, borderTop: `1px solid ${T.border}`, padding: '.6rem 1rem', display: 'flex', alignItems: 'center', gap: '.75rem', flexShrink: 0 }}>
      {showNav && <button onClick={() => renditionRef.current?.prev()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.btnColor, padding: '.2rem', display: 'flex' }}><ChevronLeft size={22} /></button>}
      <div style={{ flex: 1, height: 4, background: 'rgba(128,100,50,0.2)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#9b1f35,#d4a843)', borderRadius: 2, transition: 'width .3s' }} />
      </div>
      <span style={{ fontFamily: 'Cinzel, serif', fontSize: '.65rem', color: T.btnColor, opacity: .8, minWidth: 38, textAlign: 'center' }}>{progress}%</span>
      {showNav && <button onClick={() => renditionRef.current?.next()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.btnColor, padding: '.2rem', display: 'flex' }}><ChevronRight size={22} /></button>}
    </div>
  )

  // ── ERROR STATE ──
  if (error) return (
    <div style={{ position: 'fixed', inset: 0, background: T.bg, zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem' }}>📖</div>
      <p style={{ fontFamily: 'Cinzel, serif', color: T.btnColor, fontSize: '.95rem', maxWidth: 340, lineHeight: 1.6 }}>{error}</p>
      <button onClick={onClose} style={{ marginTop: '.5rem', fontFamily: 'Cinzel, serif', fontSize: '.75rem', padding: '.5rem 1.25rem', border: `1px solid ${T.border}`, borderRadius: 4, background: 'none', cursor: 'pointer', color: T.btnColor }}>
        ← Back to Library
      </button>
    </div>
  )

  // ── PDF VIEWER ──
  if (isPdf) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', flexDirection: 'column', background: '#404040' }}>
      <style>{`.hide-mobile { } @media(max-width:480px){.hide-mobile{display:none}}`}</style>
      <Toolbar />
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {pdfBlobUrl ? (
          <>
            {/* Desktop: iframe */}
            <iframe
              src={pdfBlobUrl}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              title={book.title}
            />
            {/* Mobile fallback — shown via CSS if iframe fails */}
            <div className="pdf-mobile-fallback" style={{ display: 'none', position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', background: '#2a2a2a', color: '#ddd', textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: '3rem' }}>📄</div>
              <p style={{ fontFamily: 'Cinzel, serif', fontSize: '.9rem' }}>PDF preview not supported on this browser</p>
              <button onClick={handleDownload} style={{ background: 'var(--gold)', color: '#1a1208', border: 'none', borderRadius: 4, padding: '.6rem 1.25rem', fontFamily: 'Cinzel, serif', fontSize: '.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                <Download size={14} /> Download PDF to Read
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontFamily: 'Cinzel, serif' }}>Loading PDF...</p>
          </div>
        )}
      </div>
      <BottomNav showNav={false} />
    </div>
  )

  // ── EPUB VIEWER ──
  return (
    <div style={{ position: 'fixed', inset: 0, background: T.bg, zIndex: 500, display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .hide-mobile { }
        @media(max-width:480px){ .hide-mobile { display:none } }
        /* iOS iframe PDF fallback */
        @supports (-webkit-touch-callout: none) {
          .pdf-mobile-fallback { display: flex !important; }
          iframe[title] { display: none !important; }
        }
      `}</style>
      <Toolbar />
      {showSettings && <SettingsPanel />}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: T.bg }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, zIndex: 10 }}>
            <p style={{ fontFamily: '"IM Fell English", serif', fontStyle: 'italic', color: T.btnColor, fontSize: '1.1rem', opacity: .7 }}>
              Opening your book...
            </p>
          </div>
        )}
        <div ref={viewerRef} style={{ width: '100%', height: '100%' }} />
      </div>
      <BottomNav showNav={true} />
    </div>
  )
}
