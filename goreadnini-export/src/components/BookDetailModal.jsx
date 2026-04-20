import { useState } from 'react'
import { X, BookOpen, Trash2, Edit2, BookMarked, Star } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import { useToast } from '../contexts/ToastContext'

const SHELVES = ['reading', 'finished', 'wishlist', 'paused']

export default function BookDetailModal({ book, onClose, onRead }) {
  const { updateBook, deleteBook, addQuote } = useBooks()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    title: book.title,
    author: book.author || '',
    shelf: book.shelf || 'reading',
    progress: book.progress || 0,
    pages_total: book.pages_total || 0,
    pages_read: book.pages_read || 0,
    rating: book.rating || 0,
    review: book.review || '',
    genre: book.genre || '',
  })
  const [quoteText, setQuoteText] = useState('')
  const [savingQuote, setSavingQuote] = useState(false)

  const handleSave = async () => {
    await updateBook(book.id, form)
    toast('Book updated', 'success')
    setEditing(false)
  }

  const handleDelete = async () => {
    if (!confirm('Remove this book from your library?')) return
    await deleteBook(book.id)
    toast('Book removed from library')
    onClose()
  }

  const handleAddQuote = async () => {
    if (!quoteText.trim()) return
    setSavingQuote(true)
    await addQuote({ book_id: book.id, text: quoteText, book_title: book.title, author: book.author })
    setQuoteText('')
    setSavingQuote(false)
    toast('Quote saved to journal ✦', 'success')
  }

  const f = (field, val) => setForm(p => ({ ...p, [field]: val }))

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <div>
            <div className="modal-title">{book.title}</div>
            {book.author && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.2rem' }}>by {book.author}</div>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button className="btn-icon" onClick={() => setEditing(!editing)} title="Edit">
              <Edit2 size={14} />
            </button>
            <button className="btn-icon" onClick={handleDelete} title="Delete" style={{ color: '#e87090', borderColor: 'rgba(139,26,46,0.4)' }}>
              <Trash2 size={14} />
            </button>
            <button className="btn-icon" onClick={onClose}><X size={14} /></button>
          </div>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Cover */}
            <div style={{ flexShrink: 0 }}>
              {book.cover_url ? (
                <img src={book.cover_url} alt={book.title} style={{ width: 100, height: 150, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }} />
              ) : (
                <div style={{ width: 100, height: 150, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={32} style={{ color: 'var(--gold-dim)', opacity: 0.5 }} />
                </div>
              )}
            </div>

            {/* Details / Edit form */}
            <div style={{ flex: 1 }}>
              {editing ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Title</label>
                    <input className="input" value={form.title} onChange={e => f('title', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Author</label>
                    <input className="input" value={form.author} onChange={e => f('author', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Genre</label>
                    <input className="input" value={form.genre} onChange={e => f('genre', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Shelf</label>
                    <select className="select" value={form.shelf} onChange={e => f('shelf', e.target.value)}>
                      {SHELVES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Progress %</label>
                    <input className="input" type="number" min="0" max="100" value={form.progress} onChange={e => f('progress', Number(e.target.value))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Total Pages</label>
                    <input className="input" type="number" value={form.pages_total} onChange={e => f('pages_total', Number(e.target.value))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pages Read</label>
                    <input className="input" type="number" value={form.pages_read} onChange={e => f('pages_read', Number(e.target.value))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Rating (1–5)</label>
                    <input className="input" type="number" min="0" max="5" value={form.rating} onChange={e => f('rating', Number(e.target.value))} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Review</label>
                    <textarea className="input" value={form.review} onChange={e => f('review', e.target.value)} rows={3} />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {book.genre && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Genre: <em>{book.genre}</em></div>}
                  <div><span className={`shelf-badge ${book.shelf}`}>{book.shelf}</span></div>
                  {book.shelf === 'reading' && (
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Progress: {book.progress || 0}%</div>
                      <div className="book-progress-bar" style={{ height: 4 }}>
                        <div className="book-progress-fill" style={{ width: `${book.progress || 0}%` }} />
                      </div>
                    </div>
                  )}
                  {book.pages_total > 0 && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {book.pages_read} / {book.pages_total} pages
                    </div>
                  )}
                  {book.rating > 0 && (
                    <div style={{ color: 'var(--gold)', fontSize: '1rem' }}>
                      {'★'.repeat(book.rating)}{'☆'.repeat(5 - book.rating)}
                    </div>
                  )}
                  {book.review && (
                    <div style={{ font: 'italic 0.9rem/1.5 "IM Fell English", serif', color: 'var(--text-secondary)', borderLeft: '2px solid var(--gold-dim)', paddingLeft: '0.75rem', marginTop: '0.5rem' }}>
                      {book.review}
                    </div>
                  )}
                  {book.description && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6, marginTop: '0.5rem' }}>
                      {book.description.slice(0, 300)}{book.description.length > 300 ? '...' : ''}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Save quote section */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <label className="form-label">Save a quote from this book</label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <textarea
                className="input"
                value={quoteText}
                onChange={e => setQuoteText(e.target.value)}
                placeholder="A beautiful passage that stayed with you..."
                rows={2}
                style={{ flex: 1 }}
              />
              <button className="btn btn-ghost btn-sm" onClick={handleAddQuote} disabled={savingQuote} style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap' }}>
                Save Quote
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          {editing ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave}>Save Changes</button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
              {(book.epub_path || book.file_data) && (
                <button className="btn btn-primary btn-sm" onClick={() => onRead(book)}>
                  <BookOpen size={13} /> Open Reader
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
