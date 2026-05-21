import { useState } from 'react'
import { X, BookOpen, Trash2, Edit2 } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import { useToast } from '../contexts/ToastContext'
import { deleteFile } from '../lib/fileStorage'

const SHELVES = ['reading', 'finished', 'wishlist', 'paused']

export default function BookDetailModal({ book, onClose, onRead }) {
  const { updateBook, deleteBook, addQuote } = useBooks()
  const toast = useToast()
  const [editing, setEditing]     = useState(false)
  const [form, setForm]           = useState({
    title:       book.title,
    author:      book.author || '',
    shelf:       book.shelf || 'reading',
    progress:    book.progress || 0,
    pages_total: book.pages_total || 0,
    pages_read:  book.pages_read || 0,
    rating:      book.rating || 0,
    review:      book.review || '',
    genre:       book.genre || '',
  })
  const [quoteText, setQuoteText] = useState('')
  const [savingQuote, setSavingQuote] = useState(false)

  // The reader needs a real Supabase Storage path, not just a saved filename.
  const canOpenReader = Boolean(book.file_path)

  const handleSave = async () => {
    await updateBook(book.id, form)
    toast('Book updated', 'success')
    setEditing(false)
  }

  const handleDelete = async () => {
    if (!confirm(`Remove "${book.title}" from your library?`)) return
    await deleteBook(book.id)
    // Also remove file from Supabase Storage if present
    if (book.file_path) {
      try { await deleteFile(book.file_path) } catch (e) { console.error('Failed to delete file from storage:', e) }
    }
    toast('Book removed')
    onClose()
  }

  const handleAddQuote = async () => {
    if (!quoteText.trim()) return
    setSavingQuote(true)
    await addQuote({ book_id: book.id, text: quoteText, book_title: book.title, author: book.author })
    setQuoteText('')
    setSavingQuote(false)
    toast('Quote saved ✦', 'success')
  }

  const f = (field, val) => setForm(p => ({ ...p, [field]: val }))

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <div style={{ minWidth: 0 }}>
            <div className="modal-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.title}</div>
            {book.author && <div style={{ fontSize: '.85rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '.2rem' }}>by {book.author}</div>}
          </div>
          <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center', flexShrink: 0 }}>
            <button className="btn-icon" onClick={() => setEditing(!editing)} title="Edit"><Edit2 size={14} /></button>
            <button className="btn-icon" onClick={handleDelete} title="Delete" style={{ color: '#f09090', borderColor: 'rgba(155,31,53,.4)' }}><Trash2 size={14} /></button>
            <button className="btn-icon" onClick={onClose}><X size={14} /></button>
          </div>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {/* Cover */}
            <div style={{ flexShrink: 0 }}>
              {book.cover_url
                ? <img src={book.cover_url} alt={book.title} style={{ width: 90, height: 135, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }} />
                : <div style={{ width: 90, height: 135, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BookOpen size={28} style={{ color: 'var(--gold-dim)', opacity: .5 }} />
                  </div>
              }
            </div>

            {/* Details */}
            <div style={{ flex: 1, minWidth: 200 }}>
              {editing ? (
                <div className="book-edit-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.65rem' }}>
                  <div className="form-group" style={{ gridColumn: '1/-1', margin: 0 }}>
                    <label className="form-label">Title</label>
                    <input className="input" value={form.title} onChange={e => f('title', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Author</label>
                    <input className="input" value={form.author} onChange={e => f('author', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Genre</label>
                    <input className="input" value={form.genre} onChange={e => f('genre', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Shelf</label>
                    <select className="select" value={form.shelf} onChange={e => f('shelf', e.target.value)}>
                      {SHELVES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Progress %</label>
                    <input className="input" type="number" min="0" max="100" value={form.progress} onChange={e => f('progress', Number(e.target.value))} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Total Pages</label>
                    <input className="input" type="number" value={form.pages_total} onChange={e => f('pages_total', Number(e.target.value))} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Pages Read</label>
                    <input className="input" type="number" value={form.pages_read} onChange={e => f('pages_read', Number(e.target.value))} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Rating (1–5)</label>
                    <input className="input" type="number" min="0" max="5" value={form.rating} onChange={e => f('rating', Number(e.target.value))} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1', margin: 0 }}>
                    <label className="form-label">Review</label>
                    <textarea className="input" value={form.review} onChange={e => f('review', e.target.value)} rows={2} />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.55rem' }}>
                  {book.genre && <div style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}><em>{book.genre}</em></div>}
                  <div><span className={`shelf-badge ${book.shelf}`}>{book.shelf}</span></div>
                  {book.shelf === 'reading' && (
                    <div>
                      <div style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginBottom: '.3rem' }}>Progress: {book.progress || 0}%</div>
                      <div className="book-progress-bar" style={{ height: 4 }}>
                        <div className="book-progress-fill" style={{ width: `${book.progress || 0}%` }} />
                      </div>
                    </div>
                  )}
                  {book.pages_total > 0 && <div style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>{book.pages_read || 0} / {book.pages_total} pages</div>}
                  {book.rating > 0 && <div style={{ color: 'var(--gold)', fontSize: '1rem' }}>{'★'.repeat(book.rating)}{'☆'.repeat(5 - book.rating)}</div>}
                  {book.review && <div style={{ font: 'italic .88rem/1.5 "IM Fell English", serif', color: 'var(--text-secondary)', borderLeft: '2px solid var(--gold-dim)', paddingLeft: '.75rem' }}>{book.review}</div>}
                  {book.description && <div style={{ fontSize: '.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{book.description.slice(0, 280)}{book.description.length > 280 ? '...' : ''}</div>}
                  {canOpenReader && (
                    <div style={{ marginTop: '.25rem' }}>
                      <span style={{ fontSize: '.75rem', color: 'var(--gold-dim)', fontFamily: 'Cinzel, serif', letterSpacing: '.05em' }}>
                        📁 {book.file_type?.toUpperCase() || 'FILE'} attached
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quote input */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <label className="form-label">Save a quote from this book</label>
            <div className="quote-inline-form" style={{ display: 'flex', gap: '.75rem' }}>
              <textarea
                className="input"
                value={quoteText}
                onChange={e => setQuoteText(e.target.value)}
                placeholder="A beautiful passage that stayed with you..."
                rows={2}
                style={{ flex: 1, fontFamily: '"IM Fell English", serif', fontStyle: 'italic' }}
              />
              <button className="btn btn-ghost btn-sm" onClick={handleAddQuote} disabled={savingQuote} style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap' }}>
                Save
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
              {canOpenReader && (
                <button className="btn btn-primary btn-sm" onClick={() => { onRead(book); onClose() }}>
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
