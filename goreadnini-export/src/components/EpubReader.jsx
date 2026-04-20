import { useEffect, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Bookmark, Highlighter, Type, Settings, BookOpen } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import { useToast } from '../contexts/ToastContext'

export default function EpubReader({ book, onClose }) {
  const { updateBook, addHighlight, addBookmark } = useBooks()
  const toast = useToast()
  const viewerRef = useRef()
  const renditionRef = useRef()
  const bookRef = useRef()
  const [progress, setProgress] = useState(0)
  const [location, setLocation] = useState(null)
  const [fontSize, setFontSize] = useState(100)
  const [showSettings, setShowSettings] = useState(false)
  const [currentCfi, setCurrentCfi] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true

    const initEpub = async () => {
      try {
        // Dynamically import epub.js
        const Epub = (await import('epubjs')).default

        let epubSrc
        if (book.file_data) {
          // base64 data URL
          epubSrc = book.file_data
        } else if (book.epub_path) {
          // Supabase URL
          const { createClient } = await import('@supabase/supabase-js')
          const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
          const { data } = await supabase.storage.from('epubs').createSignedUrl(book.epub_path, 3600)
          epubSrc = data?.signedUrl
        }

        if (!epubSrc) { setError('No epub file found for this book.'); return }
        if (!mounted) return

        const epubBook = Epub(epubSrc)
        bookRef.current = epubBook

        const rendition = epubBook.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          spread: 'none',
        })

        renditionRef.current = rendition

        // Theme
        rendition.themes.default({
          body: { background: '#f8f3e8 !important', color: '#2a1f10 !important', fontFamily: '"Cormorant Garamond", Georgia, serif !important', fontSize: `${fontSize}%`, lineHeight: '1.8' },
          p: { margin: '0 0 1em !important' },
          a: { color: '#8b1a2e !important' },
        })

        if (book.progress) {
          const savedLoc = localStorage.getItem(`grn_loc_${book.id}`)
          if (savedLoc) rendition.display(savedLoc)
          else rendition.display()
        } else {
          rendition.display()
        }

        rendition.on('rendered', () => { if (mounted) setLoading(false) })

        rendition.on('relocated', (loc) => {
          if (!mounted) return
          const cfi = loc.start.cfi
          setCurrentCfi(cfi)
          localStorage.setItem(`grn_loc_${book.id}`, cfi)

          epubBook.locations.percentageFromCfi(cfi).then(pct => {
            if (!mounted) return
            const p = Math.round(pct * 100)
            setProgress(p)
            updateBook(book.id, { progress: p })
          })
        })

        // Generate locations for progress
        await epubBook.locations.generate(1024)
        setLoading(false)

      } catch (e) {
        console.error('Epub error:', e)
        if (mounted) { setError('Could not open this epub file.'); setLoading(false) }
      }
    }

    initEpub()

    return () => {
      mounted = false
      if (bookRef.current) bookRef.current.destroy()
    }
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
    addBookmark({ book_id: book.id, cfi: currentCfi, label: `Page at ${progress}%`, page_info: `${progress}%` })
    toast('Bookmark saved ✦', 'success')
  }

  if (error) return (
    <div className="reader-container" style={{ alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
      <BookOpen size={48} style={{ color: 'var(--gold-dim)', opacity: 0.4 }} />
      <div style={{ fontFamily: 'Cinzel, serif', color: 'var(--text-secondary)' }}>{error}</div>
      <button className="btn btn-ghost" onClick={onClose}>Go Back</button>
    </div>
  )

  return (
    <div className="reader-container">
      {/* Toolbar */}
      <div className="reader-toolbar">
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#4a3828', fontFamily: 'Cinzel, serif', fontSize: '0.7rem' }}
        >
          <X size={14} /> Close
        </button>

        <div className="reader-toolbar-title">{book.title}</div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={handleHighlight}
            title="Highlight selection"
            style={{ background: 'none', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 4, padding: '0.3rem 0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', color: '#4a3828', fontFamily: 'Cinzel, serif' }}
          >
            <Highlighter size={12} /> Highlight
          </button>
          <button
            onClick={handleBookmark}
            title="Add bookmark"
            style={{ background: 'none', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 4, padding: '0.3rem 0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', color: '#4a3828', fontFamily: 'Cinzel, serif' }}
          >
            <Bookmark size={12} /> Bookmark
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
            style={{ background: showSettings ? 'rgba(0,0,0,0.08)' : 'none', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 4, padding: '0.3rem', cursor: 'pointer', color: '#4a3828' }}
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Font size settings panel */}
      {showSettings && (
        <div style={{ background: '#ede5d0', borderBottom: '1px solid rgba(0,0,0,0.1)', padding: '0.6rem 1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: '#6a5040', letterSpacing: '0.1em' }}>FONT SIZE</span>
          {[80, 90, 100, 115, 130].map(s => (
            <button
              key={s}
              onClick={() => changeFontSize(s)}
              style={{ background: fontSize === s ? '#8b1a2e' : 'transparent', color: fontSize === s ? 'white' : '#4a3828', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 4, padding: '0.2rem 0.5rem', cursor: 'pointer', fontFamily: 'Cinzel, serif', fontSize: '0.65rem' }}
            >
              {s}%
            </button>
          ))}
        </div>
      )}

      {/* Reader frame */}
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

      {/* Navigation */}
      <div className="reader-controls">
        <button
          onClick={() => renditionRef.current?.prev()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6a5040', padding: '0.3rem' }}
        >
          <ChevronLeft size={20} />
        </button>

        <div className="reader-progress">
          <div className="reader-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="reader-page-info">{progress}%</div>

        <button
          onClick={() => renditionRef.current?.next()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6a5040', padding: '0.3rem' }}
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  )
}
