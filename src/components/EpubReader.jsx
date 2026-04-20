import { useEffect, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Bookmark, Highlighter, Settings, ZoomIn, ZoomOut } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import { useToast } from '../contexts/ToastContext'

export default function EpubReader({ book, onClose }) {
  const { updateBook, addHighlight, addBookmark } = useBooks()
  const toast = useToast()
  const viewerRef = useRef()
  const renditionRef = useRef()
  const bookRef = useRef()
  const [progress, setProgress] = useState(book.progress || 0)
  const [fontSize, setFontSize] = useState(100)
  const [showSettings, setShowSettings] = useState(false)
  const [currentCfi, setCurrentCfi] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isPdf, setIsPdf] = useState(false)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [pdfPage, setPdfPage] = useState(1)
  const [pdfTotal, setPdfTotal] = useState(0)
  const pdfRef = useRef()

  useEffect(() => {
    const fileType = book.file_type || (book.file_name?.endsWith('.pdf') ? 'pdf' : 'epub')

    if (fileType === 'pdf') {
      setIsPdf(true)
      if (book.file_data) {
        setPdfUrl(book.file_data)
      }
      setLoading(false)
      return
    }

    // ePub flow
    let mounted = true
    const initEpub = async () => {
      try {
        const Epub = (await import('epubjs')).default

        let epubSrc
        if (book.file_data) {
          epubSrc = book.file_data
        } else if (book.epub_path) {
          const { createClient } = await import('@supabase/supabase-js')
          const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
          const { data } = await sb.storage.from('epubs').createSignedUrl(book.epub_path, 3600)
          epubSrc = data?.signedUrl
        }

        if (!epubSrc) { setError('No file found for this book.'); return }
        if (!mounted) return

        const epubBook = Epub(epubSrc)
        bookRef.current = epubBook

        const rendition = epubBook.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          spread: 'none',
        })
        renditionRef.current = rendition

        rendition.themes.default({
          body: {
            background: '#f8f3e8 !important',
            color: '#2a1f10 !important',
            fontFamily: '"Cormorant Garamond", Georgia, serif !important',
            fontSize: `${fontSize}%`,
            lineHeight: '1.8',
            padding: '0 2rem !important',
          },
        })

        const savedLoc = localStorage.getItem(`grn_loc_${book.id}`)
        rendition.display(savedLoc || undefined)

        rendition.on('relocated', async (loc) => {
          if (!mounted) return
          const cfi = loc.start.cfi
          setCurrentCfi(cfi)
          localStorage.setItem(`grn_loc_${book.id}`, cfi)
          try {
            const pct = await epubBook.locations.percentageFromCfi(cfi)
            const p = Math.round(pct * 100)
            setProgress(p)
            updateBook(book.id, { progress: p })
          } catch {}
        })

        await epubBook.locations.generate(1024)
        if (mounted) setLoading(false)

      } catch (e) {
        console.error('Epub error:', e)
        if (mounted) { setError('Could not open this epub file. Make sure it is a valid .epub.'); setLoading(false) }
      }
    }

    initEpub()
    return () => { mounted = false; if (bookRef.current) bookRef.current.destroy() }
  }, [book.id])

  const changeFontSize = (size) => {
    setFontSize(size)
    renditionRef.current?.themes.default({ body: { fontSize: `${size}%` } })
  }

  const handleHighlight = () => {
    const selection = window.getSelection()
    if (!selection?.toString().trim()) { toast('Select some text to highlight', 'error'); return }
    const text = selection.toString().trim()
    addHighlight({ book_id: book.id, text, cfi: currentCfi, color: 'gold', page_info: `${progress}%` })
    toast('Passage highlighted ✦', 'success')
    selection.removeAllRanges()
  }

  const handleBookmark = () => {
    addBookmark({ book_id: book.id, cfi: currentCfi, label: `Bookmark at ${progress}%`, page_info: `${progress}%` })
    toast('Bookmark saved ✦', 'success')
  }

  // ── PDF VIEWER ──
  if (isPdf) {
    return (
      <div className="reader-container">
        <div className="reader-toolbar">
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#4a3828', fontFamily: 'Cinzel, serif', fontSize: '0.7rem' }}>
            <X size={14} /> Close
          </button>
          <div className="reader-toolbar-title">{book.title}</div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {pdfTotal > 0 && (
              <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: '#6a5040' }}>
                Page {pdfPage} / {pdfTotal}
              </span>
            )}
          </div>
        </div>

        <div className="reader-frame" style={{ background: '#525659' }}>
          {pdfUrl ? (
            <iframe
              ref={pdfRef}
              src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title={book.title}
              onLoad={() => setLoading(false)}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '1rem', color: '#ccc' }}>
              <div style={{ fontSize: '3rem' }}>📄</div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem' }}>
                PDF file not found
              </div>
              <div style={{ fontSize: '0.8rem', opacity: 0.7, textAlign: 'center', maxWidth: 300 }}>
                PDF viewing requires Supabase storage to be configured. Local PDF files are not supported in browser due to security restrictions.
              </div>
              <button className="btn btn-ghost" onClick={onClose} style={{ color: '#ccc', borderColor: 'rgba(255,255,255,0.3)' }}>Go Back</button>
            </div>
          )}
        </div>

        <div className="reader-controls">
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6a5040', fontFamily: 'Cinzel, serif', fontSize: '0.7rem' }}>
            ← Back to Library
          </button>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: '#8a7260' }}>
            PDF Viewer
          </div>
          <div />
        </div>
      </div>
    )
  }

  // ── EPUB VIEWER ──
  if (error) return (
    <div className="reader-container" style={{ alignItems: 'center', justifyContent: 'center', gap: '1rem', background: '#f8f3e8' }}>
      <div style={{ fontSize: '3rem' }}>📖</div>
      <div style={{ fontFamily: 'Cinzel, serif', color: '#4a3828', fontSize: '0.95rem' }}>{error}</div>
      <button className="btn btn-ghost" onClick={onClose} style={{ color: '#4a3828', borderColor: 'rgba(0,0,0,0.2)' }}>Go Back</button>
    </div>
  )

  return (
    <div className="reader-container">
      <div className="reader-toolbar">
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#4a3828', fontFamily: 'Cinzel, serif', fontSize: '0.7rem' }}>
          <X size={14} /> Close
        </button>
        <div className="reader-toolbar-title">{book.title}</div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={handleHighlight} style={{ background: 'none', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 4, padding: '0.3rem 0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', color: '#4a3828', fontFamily: 'Cinzel, serif' }}>
            <Highlighter size={12} /> Highlight
          </button>
          <button onClick={handleBookmark} style={{ background: 'none', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 4, padding: '0.3rem 0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', color: '#4a3828', fontFamily: 'Cinzel, serif' }}>
            <Bookmark size={12} /> Bookmark
          </button>
          <button onClick={() => setShowSettings(!showSettings)} style={{ background: showSettings ? 'rgba(0,0,0,0.08)' : 'none', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 4, padding: '0.3rem', cursor: 'pointer', color: '#4a3828' }}>
            <Settings size={14} />
          </button>
        </div>
      </div>

      {showSettings && (
        <div style={{ background: '#ede5d0', borderBottom: '1px solid rgba(0,0,0,0.1)', padding: '0.6rem 1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: '#6a5040', letterSpacing: '0.1em' }}>FONT SIZE</span>
          {[80, 90, 100, 115, 130].map(s => (
            <button key={s} onClick={() => changeFontSize(s)} style={{ background: fontSize === s ? '#8b1a2e' : 'transparent', color: fontSize === s ? 'white' : '#4a3828', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 4, padding: '0.2rem 0.5rem', cursor: 'pointer', fontFamily: 'Cinzel, serif', fontSize: '0.65rem' }}>
              {s}%
            </button>
          ))}
        </div>
      )}

      <div className="reader-frame">
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f3e8', zIndex: 10 }}>
            <div style={{ fontFamily: 'IM Fell English, serif', fontStyle: 'italic', color: '#8a7260', fontSize: '1.1rem' }}>
              Opening your book...
            </div>
          </div>
        )}
        <div ref={viewerRef} id="epub-viewer" />
      </div>

      <div className="reader-controls">
        <button onClick={() => renditionRef.current?.prev()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6a5040', padding: '0.3rem' }}>
          <ChevronLeft size={20} />
        </button>
        <div className="reader-progress">
          <div className="reader-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="reader-page-info">{progress}%</div>
        <button onClick={() => renditionRef.current?.next()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6a5040', padding: '0.3rem' }}>
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  )
}
