import { useState, useRef } from 'react'
import { Upload, FileText, BookOpen } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../lib/supabase'

export default function UploadPage({ onRead }) {
  const { addBook } = useBooks()
  const toast = useToast()
  const fileRef = useRef()
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ title: '', author: '', shelf: 'reading' })

  const isSupabaseConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

  const handleFile = async (file) => {
    if (!file) return
    const isEpub = file.name.endsWith('.epub')
    const isPdf = file.name.endsWith('.pdf')
    if (!isEpub && !isPdf) { toast('Please upload an .epub or .pdf file', 'error'); return }

    // Extract title from filename
    const autoTitle = file.name.replace(/\.(epub|pdf)$/, '').replace(/[-_]/g, ' ')
    setForm(p => ({ ...p, title: p.title || autoTitle }))

    setUploading(true)
    try {
      let bookData = {
        title: form.title || autoTitle,
        author: form.author,
        shelf: form.shelf,
        file_name: file.name,
        file_type: isEpub ? 'epub' : 'pdf',
      }

      if (isSupabaseConfigured) {
        // Upload to Supabase Storage
        const userId = (await supabase.auth.getUser()).data.user?.id
        if (userId) {
          const path = `${userId}/${Date.now()}_${file.name}`
          const { error } = await supabase.storage.from('epubs').upload(path, file)
          if (!error) bookData.epub_path = path
        }
      } else {
        // Store as base64 in localStorage (works for smaller files)
        if (file.size < 20 * 1024 * 1024) { // <20MB
          const reader = new FileReader()
          reader.readAsDataURL(file)
          bookData.file_data = await new Promise(res => { reader.onload = () => res(reader.result) })
        } else {
          toast('File too large for local storage. Please configure Supabase for larger files.', 'error')
          setUploading(false)
          return
        }
      }

      const book = await addBook(bookData)
      toast(`"${bookData.title}" added and ready to read ✦`, 'success')

      if (isEpub && book) onRead(book)
    } catch (e) {
      console.error(e)
      toast('Upload failed. Please try again.', 'error')
    }
    setUploading(false)
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Upload a Book</h2>
          <p className="page-subtitle">Add your personal ebook files to the library</p>
        </div>
      </div>

      <div className="page-body" style={{ maxWidth: 600 }}>
        {/* Form */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', letterSpacing: '0.15em', color: 'var(--gold-dim)', textTransform: 'uppercase', marginBottom: '1rem' }}>Book Details (Optional)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Title</label>
              <input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Will auto-detect from filename" />
            </div>
            <div className="form-group">
              <label className="form-label">Author</label>
              <input className="input" value={form.author} onChange={e => setForm(p => ({ ...p, author: e.target.value }))} placeholder="Author name" />
            </div>
            <div className="form-group">
              <label className="form-label">Add to Shelf</label>
              <select className="select" value={form.shelf} onChange={e => setForm(p => ({ ...p, shelf: e.target.value }))}>
                <option value="reading">Currently Reading</option>
                <option value="finished">Finished</option>
                <option value="wishlist">Want to Read</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? 'var(--gold)' : 'var(--border)'}`,
            borderRadius: 8,
            padding: '3rem 2rem',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? 'rgba(201,168,76,0.05)' : 'transparent',
            transition: 'all 0.2s',
          }}
        >
          <input ref={fileRef} type="file" accept=".epub,.pdf" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />

          {uploading ? (
            <div style={{ color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⏳</div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'var(--gold)', letterSpacing: '0.06em' }}>
                Adding to your library...
              </div>
            </div>
          ) : (
            <div>
              <Upload size={40} style={{ color: 'var(--gold-dim)', opacity: 0.5, margin: '0 auto 1rem' }} />
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.4rem', letterSpacing: '0.04em' }}>
                Drop your ebook here
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                or click to browse • .epub and .pdf supported
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', letterSpacing: '0.1em', color: 'var(--gold-dim)', marginBottom: '0.5rem' }}>Notes</div>
          <p>• <strong style={{ color: 'var(--text-secondary)' }}>ePub files</strong> open directly in the built-in reader with highlighting and bookmarks.</p>
          <p>• <strong style={{ color: 'var(--text-secondary)' }}>PDF files</strong> will be stored in your library. Reader support coming soon.</p>
          {!isSupabaseConfigured && <p>• Without Supabase configured, files under 20MB are stored in your browser. Configure Supabase for cloud storage.</p>}
        </div>
      </div>
    </div>
  )
}
