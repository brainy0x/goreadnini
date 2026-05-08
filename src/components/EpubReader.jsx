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
  const viewerRef    = useRef(null)
  const renditionRef = useRef(null)
  const bookRef      = useRef(null)

  const [progress,      setProgress]      = useState(book.progress || 0)
  const [theme,         setTheme]         = useState('light')
  const [fontSize,      setFontSize]      = useState(100)
  const [showSettings,  setShowSettings]  = useState(false)
  const [currentCfi,    setCurrentCfi]    = useState('')
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [isPdf,         setIsPdf]         = useState(false)
  const [pdfBlobUrl,    setPdfBlobUrl]    = useState(null)
  const [fileBlob,      setFileBlob]      = useState(null)

  const T = THEMES[theme]

  const applyTheme = (r, t, fs) => {
    const th = THEMES[t]
    r.themes.default({
      body: {
        'background': `${th.bg} !important`,
        'color': `${th.text} !important`,
        'font-family': '"Cormorant Garamond", Georgia, serif !important',
        'font-size': `${fs}% !important`,
        'line-height': '1.85 !important',
        'padding': '0 2.5rem !important',
      }
    })
  }

  useEffect(() => {
    let mounted = true
    const fileType = book.file_type || (book.file_name?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'epub')

    const loadFile = async () => {
      try {
        const stored = await getFile(book.file_path)
        const file = stored?.file || stored
        if (!file) throw new Error('File not found')
        setFileBlob(file)

        if (fileType === 'pdf') {
          setIsPdf(true)
          setPdfBlobUrl(URL.createObjectURL(file))
          setLoading(false)
          return
        }

        // EPUB Logic - Robust Initialization
        const epubModule = await import('epubjs')
        const ePub = epubModule.default || epubModule
        const arrayBuffer = await file.arrayBuffer()
        
        // Handle cases where ePub() returns a promise (common in some environments)
        let eb = ePub(arrayBuffer)
        if (eb instanceof Promise) eb = await eb
        
        bookRef.current = eb
        await eb.opened

        if (!mounted || !viewerRef.current) return

        const r = eb.renderTo(viewerRef.current, { 
          width: '100%', 
          height: '100%', 
          manager: 'default',
          flow: 'paginated'
        })
        
        renditionRef.current = r
        applyTheme(r, theme, fontSize)

        const saved = localStorage.getItem(`grn_loc_${book.id}`)
        await r.display(saved || undefined)

        r.on('relocated', async (loc) => {
          if (!mounted) return
          const cfi = loc.start.cfi
          setCurrentCfi(cfi)
          localStorage.setItem(`grn_loc_${book.id}`, cfi)
          try {
            const pct = await eb.locations.percentageFromCfi(cfi)
            setProgress(Math.round(pct * 100))
            updateBook(book.id, { progress: Math.round(pct * 100) })
          } catch {}
        })

        await eb.locations.generate(1024)
        if (mounted) setLoading(false)
      } catch (e) {
        console.error('Reader error:', e)
        if (mounted) { setError(e.message); setLoading(false); }
      }
    }

    loadFile()
    return () => { 
      mounted = false
      if (bookRef.current) bookRef.current.destroy() 
    }
  }, [book.id])

  useEffect(() => {
    return () => { if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl) }
  }, [pdfBlobUrl])

  // UI Handlers
  const handleDownload = () => {
    if (!fileBlob) return
    const url = URL.createObjectURL(fileBlob)
    const a = document.createElement('a')
    a.href = url; a.download = book.file_name || book.title; a.click()
    URL.revokeObjectURL(url)
  }

  // Prevents Toolbar/UI items from overlapping PDF viewer
  if (loading) return <div style={{ background: T.bg, color: T.text, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>
  if (error) return <div style={{ background: T.bg, color: T.text, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Error: {error}</div>

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: T.bg, display: 'flex', flexDirection: 'column' }}>
      {/* HEADER: Shared for both PDF and EPUB */}
      <div style={{ background: T.toolbar, borderBottom: `1px solid ${T.border}`, padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 110 }}>
        <button onClick={onClose} style={{ background: 'none', border: `1px solid ${T.border}`, color: T.btnColor, padding: '.4rem .8rem', cursor: 'pointer' }}><X size={16} /></button>
        <span style={{ color: T.text, fontWeight: 'bold' }}>{book.title}</span>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {!isPdf && <button onClick={() => setShowSettings(!showSettings)} style={{ background: 'none', border: 'none', color: T.btnColor }}><Settings size={20} /></button>}
          <button onClick={handleDownload} style={{ background: 'none', border: 'none', color: T.btnColor }}><Download size={20} /></button>
        </div>
      </div>

      {/* READER VIEW */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {!isPdf && (
          <>
            <button 
              onClick={() => renditionRef.current?.prev()} 
              style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '10%', zIndex: 10, background: 'transparent', border: 'none', cursor: 'pointer' }}
            ><ChevronLeft size={30} color={T.btnColor} /></button>
            <button 
              onClick={() => renditionRef.current?.next()} 
              style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '10%', zIndex: 10, background: 'transparent', border: 'none', cursor: 'pointer' }}
            ><ChevronRight size={30} color={T.btnColor} /></button>
            <div ref={viewerRef} style={{ height: '100%', width: '100%' }} />
          </>
        )}
        
        {isPdf && (
          <iframe 
            src={pdfBlobUrl} 
            style={{ width: '100%', height: '100%', border: 'none', position: 'absolute', top: 0, left: 0 }} 
            title="PDF Viewer"
          />
        )}
      </div>

      {/* SETTINGS OVERLAY */}
      {showSettings && !isPdf && (
        <div style={{ position: 'absolute', top: '70px', right: '20px', background: T.toolbar, border: `1px solid ${T.border}`, padding: '1rem', borderRadius: '8px', zIndex: 150 }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            {Object.keys(THEMES).map(k => (
              <button key={k} onClick={() => setTheme(k)} style={{ background: THEMES[k].bg, width: '30px', height: '30px', borderRadius: '50%', border: '1px solid gray' }} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
