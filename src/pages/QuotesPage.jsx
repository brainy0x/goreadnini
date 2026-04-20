import { useState } from 'react'
import { Plus, Trash2, Quote } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import { useToast } from '../contexts/ToastContext'

export default function QuotesPage() {
  const { quotes, books, addQuote, deleteQuote } = useBooks()
  const toast = useToast()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ text: '', book_id: '', book_title: '', author: '' })
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = quotes.filter(q =>
    !query || q.text.toLowerCase().includes(query.toLowerCase()) || (q.book_title || '').toLowerCase().includes(query.toLowerCase())
  )

  const handleSave = async () => {
    if (!form.text.trim()) { toast('Please enter a quote', 'error'); return }
    setSaving(true)
    const selectedBook = books.find(b => b.id === form.book_id)
    await addQuote({
      ...form,
      book_title: selectedBook?.title || form.book_title,
      author: selectedBook?.author || form.author,
    })
    toast('Quote saved to your journal ✦', 'success')
    setForm({ text: '', book_id: '', book_title: '', author: '' })
    setShowAdd(false)
    setSaving(false)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Quotes Journal</h2>
          <p className="page-subtitle">Words that found a home in you</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus size={13} /> Add Quote
        </button>
      </div>

      <div className="page-body">
        {/* Add form */}
        {showAdd && (
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', letterSpacing: '0.15em', color: 'var(--gold-dim)', marginBottom: '1rem' }}>NEW QUOTE</div>
            <div className="form-group">
              <label className="form-label">Quote *</label>
              <textarea className="input" value={form.text} onChange={e => setForm(p => ({ ...p, text: e.target.value }))} rows={4} placeholder="Enter the passage or quote..." style={{ fontFamily: '"IM Fell English", serif', fontStyle: 'italic', fontSize: '1.05rem', lineHeight: '1.7' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">From a book in your library</label>
                <select className="select" value={form.book_id} onChange={e => setForm(p => ({ ...p, book_id: e.target.value }))}>
                  <option value="">Select a book...</option>
                  {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Or enter book title manually</label>
                <input className="input" value={form.book_title} onChange={e => setForm(p => ({ ...p, book_title: e.target.value }))} placeholder="Book title" />
              </div>
              <div className="form-group">
                <label className="form-label">Author</label>
                <input className="input" value={form.author} onChange={e => setForm(p => ({ ...p, author: e.target.value }))} placeholder="Author name" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Quote'}
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        {quotes.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <input className="input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your quotes..." />
          </div>
        )}

        {/* Quotes list */}
        {filtered.length > 0 ? (
          filtered.map(q => (
            <div key={q.id} className="quote-card">
              <div style={{ fontSize: '1.5rem', color: 'var(--gold-dim)', opacity: 0.4, lineHeight: 1, marginBottom: '0.5rem', fontFamily: 'Georgia, serif' }}>"</div>
              <div className="quote-text">{q.text}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                <div className="quote-source">
                  {q.book_title && `— ${q.book_title}`}
                  {q.author && `, ${q.author}`}
                </div>
                <button className="btn-icon" onClick={() => deleteQuote(q.id)} style={{ color: '#e87090', borderColor: 'rgba(139,26,46,0.3)' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <Quote size={48} />
            <h3>Your journal awaits</h3>
            <p>
              {quotes.length === 0
                ? 'Save passages that moved you, lines that changed you, words you want to carry forever.'
                : 'No quotes match your search.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
