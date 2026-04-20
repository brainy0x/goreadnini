import { useState } from 'react'
import { Trash2, Search } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import { useToast } from '../contexts/ToastContext'

const COLORS = {
  gold: '#c9a84c',
  crimson: '#c0394f',
  teal: '#2a8a7e',
  lavender: '#8888dd',
}

export default function HighlightsPage() {
  const { highlights, bookmarks, books, deleteHighlight, deleteBookmark } = useBooks()
  const toast = useToast()
  const [tab, setTab] = useState('highlights')
  const [query, setQuery] = useState('')
  const [filterBook, setFilterBook] = useState('all')

  const bookMap = Object.fromEntries(books.map(b => [b.id, b]))

  const filteredHighlights = highlights.filter(h => {
    const matchBook = filterBook === 'all' || h.book_id === filterBook
    const matchQuery = !query || h.text.toLowerCase().includes(query.toLowerCase())
    return matchBook && matchQuery
  })

  const filteredBookmarks = bookmarks.filter(b => {
    return filterBook === 'all' || b.book_id === filterBook
  })

  const handleDeleteHighlight = async (id) => {
    await deleteHighlight(id)
    toast('Highlight removed')
  }

  const handleDeleteBookmark = async (id) => {
    await deleteBookmark(id)
    toast('Bookmark removed')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Highlights & Bookmarks</h2>
          <p className="page-subtitle">Passages that spoke to your soul</p>
        </div>
      </div>

      <div className="page-body">
        <div className="tabs">
          <div className={`tab ${tab === 'highlights' ? 'active' : ''}`} onClick={() => setTab('highlights')}>
            Highlights ({highlights.length})
          </div>
          <div className={`tab ${tab === 'bookmarks' ? 'active' : ''}`} onClick={() => setTab('bookmarks')}>
            Bookmarks ({bookmarks.length})
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {tab === 'highlights' && (
            <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
              <Search />
              <input className="input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search highlights..." />
            </div>
          )}
          {books.length > 0 && (
            <select className="select" style={{ maxWidth: 220 }} value={filterBook} onChange={e => setFilterBook(e.target.value)}>
              <option value="all">All Books</option>
              {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
          )}
        </div>

        {tab === 'highlights' ? (
          filteredHighlights.length > 0 ? (
            filteredHighlights.map(h => {
              const book = bookMap[h.book_id]
              return (
                <div key={h.id} className="highlight-item">
                  <div className="highlight-text" style={{ borderColor: COLORS[h.color] || COLORS.gold }}>
                    {h.text}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      {book ? `${book.title}` : 'Unknown book'}
                      {h.page_info && ` · ${h.page_info}`}
                    </div>
                    <button
                      className="btn-icon"
                      onClick={() => handleDeleteHighlight(h.id)}
                      style={{ color: '#e87090', borderColor: 'rgba(139,26,46,0.3)' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              <h3>No highlights yet</h3>
              <p>Open an epub in the reader and select text to save passages that move you.</p>
            </div>
          )
        ) : (
          filteredBookmarks.length > 0 ? (
            filteredBookmarks.map(bm => {
              const book = bookMap[bm.book_id]
              return (
                <div key={bm.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem 1rem', border: '1px solid var(--border)', borderRadius: 6, marginBottom: '0.5rem', background: 'var(--bg-card)' }}>
                  <div style={{ fontSize: '1.2rem' }}>🔖</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                      {bm.label || 'Bookmark'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.2rem' }}>
                      {book?.title || 'Unknown book'} · {bm.page_info || ''}
                    </div>
                  </div>
                  <button className="btn-icon" onClick={() => handleDeleteBookmark(bm.id)} style={{ color: '#e87090', borderColor: 'rgba(139,26,46,0.3)' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              )
            })
          ) : (
            <div className="empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
              <h3>No bookmarks yet</h3>
              <p>Press the bookmark button while reading to save your place.</p>
            </div>
          )
        )}
      </div>
    </div>
  )
}
