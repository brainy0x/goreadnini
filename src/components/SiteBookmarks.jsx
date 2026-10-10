import { useState, useMemo } from 'react'
import { Plus, ExternalLink, Pencil, Trash2, Upload, X } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import { useToast } from '../contexts/ToastContext'
import { coverGradient } from '../lib/bookDisplay'

const SUGGESTED = [
  { name: 'Project Gutenberg', url: 'https://www.gutenberg.org' },
  { name: 'Standard Ebooks', url: 'https://standardebooks.org' },
  { name: 'Open Library', url: 'https://openlibrary.org' },
  { name: 'Internet Archive Books', url: 'https://archive.org/details/texts' },
  { name: 'Wikisource', url: 'https://wikisource.org' },
]

// Accepts "example.com" or a full URL; returns a normalized https URL or null
function normalizeUrl(raw) {
  const text = raw.trim()
  if (!text) return null
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
    return url.hostname.includes('.') ? url.href : null
  } catch { return null }
}

const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url } }

export default function SiteBookmarks({ onNavigate }) {
  const { siteBookmarks, addSiteBookmark, updateSiteBookmark, deleteSiteBookmark } = useBooks()
  const toast = useToast()
  const [form, setForm] = useState({ name: '', url: '' })
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const sorted = useMemo(
    () => [...siteBookmarks].sort((a, b) => (a.created_at || '') > (b.created_at || '') ? 1 : -1),
    [siteBookmarks]
  )
  const savedHosts = new Set(sorted.map(b => hostOf(b.url)))
  const suggestions = SUGGESTED.filter(s => !savedHosts.has(hostOf(s.url)))

  const reset = () => { setForm({ name: '', url: '' }); setEditingId(null); setShowForm(false) }

  const save = async () => {
    const url = normalizeUrl(form.url)
    if (!url) { toast('Enter a valid website address, like example.com', 'error'); return }
    const name = form.name.trim() || hostOf(url)
    if (editingId) await updateSiteBookmark(editingId, { name, url })
    else await addSiteBookmark({ name, url })
    toast(editingId ? 'Bookmark updated' : `Saved ${name}`, 'success')
    reset()
  }

  const startEdit = (b) => { setForm({ name: b.name, url: b.url }); setEditingId(b.id); setShowForm(true) }

  const remove = async (b) => {
    if (!confirm(`Remove "${b.name}" from your bookmarks?`)) return
    await deleteSiteBookmark(b.id)
  }

  return (
    <div>
      <div className="lib-section-head">
        <h3>Saved sites</h3>
        {!showForm && (
          <button className="sr-link" onClick={() => setShowForm(true)}><Plus size={14} /> Add site</button>
        )}
      </div>

      {showForm && (
        <div className="sr-form">
          <input className="input" placeholder="Name (optional)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input className="input" placeholder="Website address, e.g. gutenberg.org" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} onKeyDown={e => e.key === 'Enter' && save()} autoFocus />
          <div className="sr-form-actions">
            <button className="sr-btn sr-btn-ghost" onClick={reset}><X size={14} /> Cancel</button>
            <button className="sr-btn" onClick={save}>{editingId ? 'Save changes' : 'Save site'}</button>
          </div>
        </div>
      )}

      {sorted.length === 0 && !showForm ? (
        <div className="lib-empty">No saved sites yet. Add one below or save your own.</div>
      ) : (
        <div className="sr-sites">
          {sorted.map(b => (
            <div key={b.id} className="sr-site">
              <div className="sr-site-icon" style={{ background: coverGradient(hostOf(b.url)) }}>{(b.name || '?').charAt(0).toUpperCase()}</div>
              <div className="sr-site-info">
                <div className="sr-site-name">{b.name}</div>
                <div className="sr-site-host">{hostOf(b.url)}</div>
              </div>
              <a className="sr-icon" href={b.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${b.name}`}><ExternalLink size={16} /></a>
              <button className="sr-icon" onClick={() => startEdit(b)} aria-label="Edit"><Pencil size={15} /></button>
              <button className="sr-icon sr-icon-danger" onClick={() => remove(b)} aria-label="Delete"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <>
          <div className="lib-section-head" style={{ marginTop: '1.5rem' }}><h3>Suggested</h3></div>
          <div className="lib-chips" style={{ flexWrap: 'wrap' }}>
            {suggestions.map(s => (
              <button key={s.url} className="lib-chip" onClick={() => addSiteBookmark(s)}>
                <Plus size={13} /> {s.name}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="sr-tip">
        <div>
          <strong>Downloaded a book from a site?</strong>
          <span>Upload the file and the summary and cover fill in automatically.</span>
        </div>
        <button className="sr-btn" onClick={() => onNavigate?.('upload')}><Upload size={14} /> Upload</button>
      </div>
    </div>
  )
}
