import { useState, useEffect } from 'react'
import { ChevronLeft, BookOpen, Trash2, Edit2, Star, Loader } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import { useToast } from '../contexts/ToastContext'
import { deleteFile } from '../lib/fileStorage'
import { displayBook, CATEGORIES, categoryOf, categoryLabel } from '../lib/bookDisplay'
import { languageName } from '../lib/bookLookup'
import { enrichBook, lazyFileLoader } from '../lib/bookEnrich'
import { shrinkCoverBlob } from '../lib/epubCover'
import { localizeCover } from '../lib/coverCache'
import BookCover from './BookCover'

const SHELVES = ['reading', 'finished']

export default function BookDetailModal({ book: initial, onClose, onRead }) {
  const { books, updateBook, deleteBook, addQuote } = useBooks()
  const toast = useToast()

  // Stay in sync with the library (the lookup below saves new fields onto the book)
  const book = books.find(b => b.id === initial.id) || initial
  const { title, author } = displayBook(book)

  const [editing, setEditing]       = useState(false)
  const [coverBusy, setCoverBusy] = useState('')
  const [coverLink, setCoverLink]   = useState('')
  const [looking, setLooking]       = useState(false)
  const [quoteText, setQuoteText]   = useState('')
  const [savingQuote, setSavingQuote] = useState(false)
  const [form, setForm] = useState({
    title,
    author,
    shelf:       book.shelf || 'reading',
    category:    categoryOf(book),
    progress:    book.progress || 0,
    pages_total: book.pages_total || 0,
    pages_read:  book.pages_read || 0,
    rating:      book.rating || 0,
    review:      book.review || '',
    genre:       book.genre || '',
  })

  const canOpenReader = Boolean(book.file_path)

  // First time a book is opened, make sure its summary/cover are filled in (best effort, never blocks)
  useEffect(() => {
    if (initial.lookup_done) return
    let alive = true
    setLooking(true)
    enrichBook(initial, updateBook, { loadFile: lazyFileLoader(initial) }).finally(() => { if (alive) setLooking(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id])

  // ── cover controls (saved straight away, not with "Save changes") ──
  const setCover = (url) => updateBook(book.id, { cover_url: url, cover_checked: true, ...(book.updated_at ? { updated_at: book.updated_at } : {}) })

  const pickCoverFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCoverBusy('Saving…')
    try {
      await setCover(await shrinkCoverBlob(file))
      toast('Cover updated', 'success')
    } catch {
      toast('Could not read that image', 'error')
    }
    setCoverBusy('')
  }

  const useCoverLink = async () => {
    const url = coverLink.trim()
    if (!/^https?:\/\//i.test(url)) { toast('Paste a full image link starting with http', 'error'); return }
    setCoverBusy('Saving…')
    await setCover(await localizeCover(url))
    setCoverBusy('')
    setCoverLink('')
    toast('Cover updated', 'success')
  }

  const refreshCover = async () => {
    setCoverBusy('Looking…')
    const result = await enrichBook({ ...book, cover_url: '' }, updateBook, { coverOnly: true, loadFile: lazyFileLoader(book) })
    setCoverBusy('')
    if (!result) toast('Still working on it, try again in a moment')
    else if (result.cover_url) toast('Found a cover ✦', 'success')
    else toast('No cover found for this book', 'error')
  }

  const removeCover = async () => {
    await setCover('')
    toast('Cover removed')
  }

  const handleSave = async () => {
    await updateBook(book.id, form)
    toast('Book updated', 'success')
    setEditing(false)
  }

  const handleDelete = async () => {
    if (!confirm(`Remove "${title}" from your library?`)) return
    await deleteBook(book.id)
    if (book.file_path) {
      try { await deleteFile(book.file_path) } catch (e) { console.error('Failed to delete file from storage:', e) }
    }
    toast('Book removed')
    onClose()
  }

  const handleAddQuote = async () => {
    if (!quoteText.trim()) return
    setSavingQuote(true)
    await addQuote({ book_id: book.id, text: quoteText, book_title: title, author })
    setQuoteText('')
    setSavingQuote(false)
    toast('Quote saved ✦', 'success')
  }

  const f = (field, val) => setForm(p => ({ ...p, [field]: val }))
  const rating = book.public_rating || book.rating

  return (
    <div className="bd-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bd">
        <div className="bd-scroll">
          <div className="bd-top">
            <button className="bd-round" onClick={onClose} aria-label="Back"><ChevronLeft size={20} /></button>
            <div className="bd-top-right">
              <button className="bd-round" onClick={() => setEditing(e => !e)} aria-label="Edit"><Edit2 size={16} /></button>
              <button className="bd-round bd-danger" onClick={handleDelete} aria-label="Delete"><Trash2 size={16} /></button>
            </div>
          </div>

          <div className="bd-hero">
            <BookCover book={book} className="bd-cover" />
            <h2 className="bd-title">{title}</h2>
            <div className="bd-author">{author || 'Unknown author'}</div>
            <div className="bd-badges">
              <span className={`shelf-badge ${book.shelf}`}>{book.shelf}</span>
              <span className="bd-cat">{categoryLabel(categoryOf(book))}</span>
            </div>
          </div>

          <div className="bd-stats">
            <div>
              <span>Rating</span>
              <strong>{rating ? <><Star size={14} fill="currentColor" /> {Number(rating).toFixed(1)}</> : '—'}</strong>
            </div>
            <div>
              <span>Pages</span>
              <strong>{book.pages_total > 0 ? book.pages_total : '—'}</strong>
            </div>
            <div>
              <span>Language</span>
              <strong>{languageName(book.language)}</strong>
            </div>
          </div>

          {book.shelf === 'reading' && book.progress > 0 && (
            <div className="bd-progress">
              <div className="bd-progress-label"><span>Progress</span><span>{book.progress}%</span></div>
              <div className="bk-bar" style={{ height: 5 }}><div style={{ width: `${book.progress}%` }} /></div>
            </div>
          )}

          {editing ? (
            <div className="bd-section">
              <h3>Edit details</h3>
              <div className="bd-edit-grid">
                <div className="form-group bd-wide"><label className="form-label">Cover</label>
                  <div className="bd-cover-edit">
                    <div className="bd-cover-thumb"><BookCover book={book} /></div>
                    <div className="bd-cover-actions">
                      <div className="bd-cover-buttons">
                        <label className="bd-mini-btn">
                          Choose image
                          <input type="file" accept="image/*" hidden onChange={pickCoverFile} />
                        </label>
                        <button type="button" className="bd-mini-btn" onClick={refreshCover} disabled={!!coverBusy}>Find automatically</button>
                        {book.cover_url && <button type="button" className="bd-mini-btn bd-mini-danger" onClick={removeCover}>Remove</button>}
                      </div>
                      {coverBusy && <span className="bd-muted">{coverBusy}</span>}
                      <div className="bd-cover-link">
                        <input className="input" value={coverLink} onChange={e => setCoverLink(e.target.value)} placeholder="…or paste an image link" />
                        <button type="button" className="bd-mini-btn" onClick={useCoverLink} disabled={!coverLink.trim()}>Use</button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="form-group bd-wide"><label className="form-label">Title</label>
                  <input className="input" value={form.title} onChange={e => f('title', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Author</label>
                  <input className="input" value={form.author} onChange={e => f('author', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Genre</label>
                  <input className="input" value={form.genre} onChange={e => f('genre', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Shelf</label>
                  <select className="select" value={form.shelf} onChange={e => f('shelf', e.target.value)}>
                    {SHELVES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select></div>
                <div className="form-group"><label className="form-label">Category</label>
                  <select className="select" value={form.category} onChange={e => f('category', e.target.value)}>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.single}</option>)}
                  </select></div>
                <div className="form-group"><label className="form-label">Progress %</label>
                  <input className="input" type="number" min="0" max="100" value={form.progress} onChange={e => f('progress', Number(e.target.value))} /></div>
                <div className="form-group"><label className="form-label">Total Pages</label>
                  <input className="input" type="number" value={form.pages_total} onChange={e => f('pages_total', Number(e.target.value))} /></div>
                <div className="form-group"><label className="form-label">Pages Read</label>
                  <input className="input" type="number" value={form.pages_read} onChange={e => f('pages_read', Number(e.target.value))} /></div>
                <div className="form-group"><label className="form-label">My Rating (0–5)</label>
                  <input className="input" type="number" min="0" max="5" value={form.rating} onChange={e => f('rating', Number(e.target.value))} /></div>
                <div className="form-group bd-wide"><label className="form-label">Review</label>
                  <textarea className="input" rows={3} value={form.review} onChange={e => f('review', e.target.value)} /></div>
              </div>
            </div>
          ) : (
            <>
              <div className="bd-section">
                <h3>Overview</h3>
                {book.description ? (
                  <p className="bd-text">{book.description}</p>
                ) : looking ? (
                  <p className="bd-muted"><Loader size={14} className="bd-spin" /> Finding the summary…</p>
                ) : (
                  <p className="bd-muted">No summary found for this book. Use Edit to add details.</p>
                )}
              </div>

              {book.review && (
                <div className="bd-section">
                  <h3>My review</h3>
                  <p className="bd-text bd-review">{book.review}</p>
                </div>
              )}

              <div className="bd-section">
                <h3>Save a quote</h3>
                <div className="bd-quote">
                  <textarea
                    className="input"
                    value={quoteText}
                    onChange={e => setQuoteText(e.target.value)}
                    placeholder="A passage that stayed with you..."
                    rows={2}
                  />
                  <button className="btn btn-ghost btn-sm" onClick={handleAddQuote} disabled={savingQuote}>Save</button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bd-bar">
          {editing ? (
            <>
              <button className="bd-btn bd-btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              <button className="bd-btn" onClick={handleSave}>Save changes</button>
            </>
          ) : canOpenReader ? (
            <>
              <div className="bd-bar-info">
                <span>{book.file_type?.toUpperCase() || 'FILE'}</span>
                <strong>{book.progress > 0 ? `${book.progress}% read` : 'Ready to read'}</strong>
              </div>
              <button className="bd-btn" onClick={() => { onRead(book); onClose() }}>
                <BookOpen size={16} /> {book.progress > 0 ? 'Continue reading' : 'Open Reader'}
              </button>
            </>
          ) : (
            <div className="bd-bar-info"><strong>No file attached</strong><span>Upload one to read this book</span></div>
          )}
        </div>
      </div>
    </div>
  )
}
