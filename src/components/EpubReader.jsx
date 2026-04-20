import { useEffect, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Bookmark, Highlighter, Settings } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import { useToast } from '../contexts/ToastContext'

const THEMES = {
  light: { bg: '#f8f3e8', text: '#1e1508', label: 'Parchment' },
  sepia: { bg: '#efe3c8', text: '#3d2b0e', label: 'Sepia' },
  dark:  { bg: '#14100c', text: '#ddd0b8', label: 'Dark' },
}

export default function EpubReader({ book, onClose }) {
  const { updateBook, addHighlight, addBookmark } = useBooks()
  const toast = useToast()
  const viewerRef = useRef()
  const renditionRef = useRef()
  const bookRef = useRef()

  const [progress, setProgress]       = useState(book.progress || 0)
  const [theme, setTheme]             = useState('light')
  const [fontSize, setFontSize]       = useState(100)
  const [showSettings, setShowSettings] = useState(false)
  const [currentCfi, setCurrentCfi]   = useState('')
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [isPdf, setIsPdf]             = useState(false)
  const [pdfUrl, setPdfUrl]           = useState(null)

  // ── apply reader theme to epub rendition ──
  const applyTheme = (r, t, fs) => {
    const { bg, text } = THEMES[t]
    r.themes.default({
      body: {
        background:  `${bg} !important`,
        color:       `${text} !important`,
        fontFamily:  '"Cormorant Garamond", Georgia, serif !important',
        fontSize:    `${fs}% !important`,
        lineHeight:  '1.85 !important',
        padding:     '0 2.5rem !important',
        maxWidth:    '680px !important',
        margin:      '0 auto !important',
      },
      p:  { marginBottom: '1em !important' },
      h1: { fontFamily: '"Cinzel", serif !important', color: `${text} !important` },
      h2: { fontFamily: '"Cinzel", serif !important', color: `${text} !important` },
      a:  { color: '#9b5030 !important' },
    })
  }

  useEffect(() => {
    const fileType = book.file_type || (book.file_name?.endsWith('.pdf') ? 'pdf' : 'epub')

    if (fileType === 'pdf') {
      setIsPdf(true)
      if (book.file_data) setPdfUrl(book.file_data)
      setLoading(false)
      return
    }

    let mounted = true
    const init = async () => {
      try {
        const Epub = (await import('epubjs')).default

        let src = book.file_data || null
        if (!src && book.epub_path) {
          const { createClient } = await import('@supabase/supabase-js')
          const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
          const { data } = await sb.storage.from('epubs').createSignedUrl(book.epub_path, 3600)
          src = data?.signedUrl
        }

        if (!src)     { setError('No epub file found for this book.'); setLoading(false); return }
        if (!mounted) return

        const eb = Epub(src)
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
        console.error(e)
        if (mounted) { setError('Could not open this epub. Make sure it is a valid .epub file.'); setLoading(false) }
      }
    }

    init()
    return () => { mounted = false; bookRef.current?.destroy() }
  }, [book.id])

  const changeTheme = (t) => {
    setTheme(t)
    if (renditionRef.current) applyTheme(renditionRef.current, t, fontSize)
  }

  const changeFontSize = (fs) => {
    setFontSize(fs)
    if (renditionRef.current) applyTheme(renditionRef.current, theme, fs)
  }

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

  const navBtnStyle = {
    background: 'none', border: 'none', cursor: 'pointer', padding: '.3rem',
    color: theme === 'dark' ? '#c4a068' : '#5a3e28',
  }

  // ── PDF ──
  if (isPdf) return (
    <div className={`reader-container theme-${theme}`}>
      <div className="reader-toolbar">
        <button onClick={onClose} className="reader-btn"><X size={14} /> Close</button>
        <span className="reader-toolbar-title">{book.title}</span>
        <div style={{ display: 'flex', gap: '.4rem' }}>
          {Object.entries(THEMES).map(([k]) => (
            <span key={k} className={`theme-pill ${k} ${theme === k ? 'active' : ''}`} onClick={() => setTheme(k)}>{THEMES[k].label}</span>
          ))}
        </div>
      </div>
      <div className="reader-frame" style={{ background: '#404040' }}>
        {pdfUrl
          ? <iframe src={`${pdfUrl}#toolbar=1`} style={{ width: '100%', height: '100%', border: 'none' }} title={book.title} />
          : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', color: '#999' }}>
              <div style={{ fontSize: '3rem' }}>📄</div>
              <p style={{ fontFamily: 'Cinzel, serif', fontSize: '.9rem' }}>PDF requires Supabase storage to display</p>
              <button className="btn btn-ghost" onClick={onClose} style={{ color: '#999', borderColor: 'rgba(255,255,255,.2)' }}>Go Back</button>
            </div>
        }
      </div>
      <div className="reader-controls">
        <button onClick={onClose} className="reader-btn">← Library</button>
        <div className="reader-progress"><div className="reader-progress-fill" style={{ width: `${progress}%` }} /></div>
        <span className="reader-page-info">PDF</span>
      </div>
    </div>
  )

  // ── ERROR ──
  if (error) return (
    <div className={`reader-container theme-${theme}`} style={{ alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
      <div style={{ fontSize: '3rem' }}>📖</div>
      <p style={{ fontFamily: 'Cinzel, serif', fontSize: '.95rem', color: theme === 'dark' ? '#c4a068' : '#4a3820' }}>{error}</p>
      <button className="reader-btn" onClick={onClose} style={{ color: theme === 'dark' ? '#c4a068' : '#4a3820', border: '1px solid rgba(0,0,0,.2)', borderRadius: 4, padding: '.4rem 1rem' }}>Go Back</button>
    </div>
  )

  // ── EPUB ──
  return (
    <div className={`reader-container theme-${theme}`}>
      {/* Toolbar */}
      <div className="reader-toolbar">
        <button onClick={onClose} className="reader-btn"><X size={14} /> Close</button>
        <span className="reader-toolbar-title">{book.title}</span>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          <button onClick={handleHighlight} className="reader-btn"><Highlighter size={12} /> Highlight</button>
          <button onClick={handleBookmark}  className="reader-btn"><Bookmark size={12} /> Bookmark</button>
          <button onClick={() => setShowSettings(s => !s)} className="reader-btn" style={{ padding: '.3rem .4rem' }}><Settings size={14} /></button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div style={{
          padding: '.7rem 1.5rem',
          borderBottom: `1px solid ${theme === 'dark' ? 'rgba(212,168,67,.15)' : 'rgba(0,0,0,.1)'}`,
          background: theme === 'dark' ? '#1e1810' : theme === 'sepia' ? '#e4d4b0' : '#e8dfc8',
          display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap',
        }}>
          {/* Theme switcher */}
          <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '.6rem', letterSpacing: '.12em', color: theme === 'dark' ? '#8a7055' : '#6a5038', marginRight: '.25rem' }}>THEME</span>
            {Object.entries(THEMES).map(([k, v]) => (
              <span key={k} className={`theme-pill ${k} ${theme === k ? 'active' : ''}`} onClick={() => changeTheme(k)}>{v.label}</span>
            ))}
          </div>
          {/* Font size */}
          <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '.6rem', letterSpacing: '.12em', color: theme === 'dark' ? '#8a7055' : '#6a5038', marginRight: '.25rem' }}>SIZE</span>
            {[80, 90, 100, 115, 130].map(s => (
              <button key={s} onClick={() => changeFontSize(s)} style={{
                background: fontSize === s ? (theme === 'dark' ? '#9b1f35' : '#5a3010') : 'transparent',
                color: fontSize === s ? 'white' : theme === 'dark' ? '#c4a068' : '#4a3820',
                border: `1px solid ${theme === 'dark' ? 'rgba(212,168,67,.2)' : 'rgba(0,0,0,.18)'}`,
                borderRadius: 3, padding: '.18rem .5rem', cursor: 'pointer',
                fontFamily: 'Cinzel, serif', fontSize: '.62rem',
              }}>{s}%</button>
            ))}
          </div>
        </div>
      )}

      {/* Reader */}
      <div className="reader-frame">
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: THEMES[theme].bg, zIndex: 10 }}>
            <p style={{ fontFamily: '"IM Fell English", serif', fontStyle: 'italic', color: THEMES[theme].text, fontSize: '1.1rem', opacity: .7 }}>Opening your book...</p>
          </div>
        )}
        <div ref={viewerRef} id="epub-viewer" style={{ background: THEMES[theme].bg }} />
      </div>

      {/* Controls */}
      <div className="reader-controls">
        <button style={navBtnStyle} onClick={() => renditionRef.current?.prev()}><ChevronLeft size={22} /></button>
        <div className="reader-progress"><div className="reader-progress-fill" style={{ width: `${progress}%` }} /></div>
        <span className="reader-page-info">{progress}%</span>
        <button style={navBtnStyle} onClick={() => renditionRef.current?.next()}><ChevronRight size={22} /></button>
      </div>
    </div>
  )
}
