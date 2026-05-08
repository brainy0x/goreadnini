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
        'background':   `${th.bg} !important`,
        'color':        `${th.text} !important`,
        'font-family':  '"Cormorant Garamond", Georgia, serif !important',
        'font-size':    `${fs}% !important`,
        'line-height':  '1.85 !important',
        'padding':      '0 2.5rem !important',
      }
    })
  }

  useEffect(() => {
    let mounted = true
    const fileType = book.file_type || (book.file_name?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'epub')

    const loadFile = async () => {
      if (!book.file_path) {
        setError('No file path found.')
        setLoading(false)
        return
      }

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

        // EPUB Logic
        const epubModule = await import('epubjs')
        const ePub = epubModule.default || epubModule
        const arrayBuffer = await file.arrayBuffer()

        // Validation fix
        const firstBytes = new Uint8Array(arrayBuffer.slice(0, 2))
        if (firstBytes[0] !== 0x50 || firstBytes[1] !== 0x4B) {
          throw new Error('Not a valid EPUB file')
        }

        const eb = ePub(arrayBuffer)
        bookRef.current = eb
        await eb.ready

        if (!mounted || !viewerRef.current) return

        const r = eb.renderTo(viewerRef.current, { 
          width: '100%', 
          height: '100%', 
          flow: 'paginated',
          manager: 'default'
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

  const handleDownload = () => {
    if (!fileBlob) return
    const url = URL.createObjectURL(fileBlob)
    const a = document.createElement('a')
    a.href = url; a.download = book.file_name || book.title; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div style={{ background: T.bg, color: T.text, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel' }}>Loading Library...</div>
  if (error) return <div style={{ background: T.bg, color: T.text, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Error: {error}</div>

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: T.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: T.toolbar, borderBottom: `1px solid ${T.border}`, padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onClose} style={{ background: 'none', border: `1px solid ${T.border}`, color: T.btnColor, padding: '.4rem .8rem', cursor: 'pointer' }}><X size={16} /></button>
        <span style={{ color: T.text, fontFamily: 'Cinzel', fontWeight: 'bold' }}>{book.title}</span>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={() => setShowSettings(!showSettings)} style={{ background: 'none', border: 'none', color: T.btnColor, cursor: 'pointer' }}><Settings size={20} /></button>
          <button onClick={handleDownload} style={{ background: 'none', border: 'none', color: T.btnColor, cursor: 'pointer' }}><Download size={20} /></button>
        </div>
      </div>

      {/* Reader Body */}
      <div style={{ flex: 1, position: 'relative' }}>
        {!isPdf && (
          <>
            <button onClick={() => renditionRef.current?.prev()} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '80px', zIndex: 10, background: 'transparent', border: 'none', cursor: 'pointer', color: T.btnColor }}><ChevronLeft size={40} /></button>
            <button onClick={() => renditionRef.current?.next()} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '80px', zIndex: 10, background: 'transparent', border: 'none', cursor: 'pointer', color: T.btnColor }}><ChevronRight size={40} /></button>
          </>
        )}
        
        {isPdf ? (
          <iframe src={pdfBlobUrl} style={{ width: '100%', height: '100%', border: 'none' }} />
        ) : (
          <div ref={viewerRef} style={{ height: '100%', width: '100%' }} />
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '.5rem', textAlign: 'center', fontSize: '.8rem', color: T.text, borderTop: `1px solid ${T.border}`, background: T.toolbar }}>
        Progress: {progress}%
      </div>
    </div>
  )
}
