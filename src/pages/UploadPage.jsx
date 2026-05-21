import { useState, useRef } from 'react'
import { Upload } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import { useToast } from '../contexts/ToastContext'
import { saveFile } from '../lib/fileStorage'
import { isConfigured as supabaseConfigured } from '../lib/supabase'

export default function UploadPage({ onRead }) {
  const { addBook, updateBook } = useBooks()
  const toast = useToast()
  const fileRef = useRef()
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [form, setForm] = useState({ title: '', author: '', shelf: 'reading' })

  const handleFile = async (file) => {
    if (!file) return
    if (!supabaseConfigured) {
      toast('Supabase storage not configured. Please set up your Supabase project and update the credentials in supabase.js', 'error')
      return
    }
    const isEpub = file.name.toLowerCase().endsWith('.epub')
    const isPdf  = file.name.toLowerCase().endsWith('.pdf')
    if (!isEpub && !isPdf) { toast('Please upload an .epub or .pdf file', 'error'); return }

    const autoTitle = file.name.replace(/\.(epub|pdf)$/i, '').replace(/[-_]/g, ' ').trim()
    setUploading(true)
    setProgress(10)

    try {
      // Create the book entry first to get an ID
      const bookData = {
        title:     form.title.trim() || autoTitle,
        author:    form.author.trim(),
        shelf:     form.shelf,
        file_name: file.name,
        file_type: isEpub ? 'epub' : 'pdf',
        has_file:  false,
      }

      setProgress(30)
      const book = await addBook(bookData)
      setProgress(60)

      // Save actual file bytes to Supabase Storage
      const filePath = await saveFile(book.id, file)
      console.log('[UploadPage] File uploaded to Supabase:', filePath)
      await updateBook(book.id, { file_path: filePath, has_file: true })
      console.log('[UploadPage] Firestore updated with file_path')
      setProgress(100)

      const updatedBook = { ...book, file_path: filePath, has_file: true }
      toast(`"${bookData.title}" added ✦`, 'success')
      setForm({ title: '', author: '', shelf: 'reading' })

      if (isEpub) onRead(updatedBook)

    } catch (e) {
      console.error('Upload error:', e)
      const errorMessage = e?.message || (typeof e === 'string' ? e : JSON.stringify(e))
      toast('Upload failed — ' + errorMessage, 'error')
    }

    setUploading(false)
    setProgress(0)
  }

  const onDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Upload a Book</h2>
          <p className="page-subtitle">Add your personal ebook files to the library</p>
        </div>
      </div>

      <div className="page-body" style={{ maxWidth: 580 }}>
        {/* Details form */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="form-label" style={{ marginBottom: '1rem', display: 'block' }}>Book Details (optional — auto-fills from filename)</div>
          <div className="book-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group" style={{ gridColumn: '1/-1', margin: 0 }}>
              <label className="form-label">Title</label>
              <input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Auto-detected from filename" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Author</label>
              <input className="input" value={form.author} onChange={e => setForm(p => ({ ...p, author: e.target.value }))} placeholder="Author name" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Shelf</label>
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
          onClick={() => !uploading && fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? 'var(--gold)' : 'var(--border)'}`,
            borderRadius: 8,
            padding: '3rem 2rem',
            textAlign: 'center',
            cursor: uploading ? 'default' : 'pointer',
            background: dragging ? 'rgba(212,168,67,0.05)' : 'transparent',
            transition: 'all 0.2s',
          }}
        >
          <input ref={fileRef} type="file" accept=".epub,.pdf" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />

          {uploading ? (
            <div>
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📚</div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'var(--gold)', letterSpacing: '0.06em', marginBottom: '1rem' }}>
                Storing your book...
              </div>
              <div style={{ height: 4, background: 'var(--bg-card)', borderRadius: 2, overflow: 'hidden', maxWidth: 200, margin: '0 auto' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--crimson), var(--gold))', borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
            </div>
          ) : (
            <div>
              <Upload size={38} style={{ color: 'var(--gold-dim)', opacity: 0.5, margin: '0 auto 1rem', display: 'block' }} />
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                Tap to choose a file
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                .epub and .pdf • stored locally, no account needed
              </div>
            </div>
          )}
        </div>

        {/* Info box */}
        <div style={{ marginTop: '1.25rem', padding: '1rem 1.25rem', border: '1px solid var(--border)', borderRadius: 6, lineHeight: 1.7 }}>
          <div className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>How file storage works</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            📱 Files are uploaded to <strong>Supabase Storage</strong> — secure cloud storage with no size limit.
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            They are accessible from any device with your account. No need to re-upload on different devices.
          </p>
        </div>
      </div>
    </div>
  )
}
