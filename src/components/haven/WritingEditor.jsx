import { useEffect, useRef, useState, useCallback } from 'react'
import { ChevronLeft, Trash2 } from 'lucide-react'
import { useBooks } from '../../contexts/BooksContext'
import { ensurePageFonts } from '../../lib/readerFonts'

export const KINDS = [
  { id: 'poem',    label: 'Poem' },
  { id: 'story',   label: 'Story' },
  { id: 'journal', label: 'Journal' },
  { id: 'note',    label: 'Note' },
]

const wordCount = (text) => (text.trim() ? text.trim().split(/\s+/).length : 0)

// Full-screen writing. It saves by itself a moment after you stop typing (and when you leave), so nothing is lost.
export default function WritingEditor({ writing, defaultKind = 'poem', onClose }) {
  const { addWriting, updateWriting, deleteWriting } = useBooks()
  const [title, setTitle] = useState(writing?.title || '')
  const [body, setBody] = useState(writing?.body || '')
  const [kind, setKind] = useState(writing?.kind || defaultKind)
  const [status, setStatus] = useState('')
  const [started, setStarted] = useState(Boolean(writing?.id))   // true once there is something to delete

  const idRef = useRef(writing?.id || null)
  const queue = useRef(Promise.resolve())      // saves run one after another, so a new piece is created only once
  const timer = useRef(null)
  const latest = useRef({ title, body, kind })
  const dirty = useRef(false)
  const areaRef = useRef(null)

  useEffect(() => { ensurePageFonts() }, [])
  useEffect(() => { latest.current = { title, body, kind } })

  // grow the writing area with the text
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [body])

  const save = useCallback(() => {
    queue.current = queue.current.then(async () => {
      if (!dirty.current) return
      dirty.current = false
      const { title: t, body: b, kind: k } = latest.current
      if (!t.trim() && !b.trim()) return
      setStatus('Saving…')
      try {
        if (!idRef.current) {
          const created = await addWriting({ title: t, body: b, kind: k })
          idRef.current = created.id
          setStarted(true)
        } else {
          await updateWriting(idRef.current, { title: t, body: b, kind: k })
        }
        setStatus('Saved ✓')
      } catch {
        setStatus('Could not save')
      }
    })
    return queue.current
  }, [addWriting, updateWriting])

  const change = (setter) => (value) => {
    setter(value)
    dirty.current = true
    setStatus('')
    clearTimeout(timer.current)
    timer.current = setTimeout(save, 700)
  }

  const close = async () => {
    clearTimeout(timer.current)
    await save()
    onClose()
  }

  const remove = async () => {
    if (!confirm('Delete this piece? This cannot be undone.')) return
    clearTimeout(timer.current)
    dirty.current = false
    await queue.current
    if (idRef.current) await deleteWriting(idRef.current)
    onClose()
  }

  // make sure unsaved words are saved if she navigates away some other way
  useEffect(() => () => { clearTimeout(timer.current) }, [])

  return (
    <div className="hv-editor">
      <header className="hv-editor-top">
        <button className="hv-round" onClick={close} aria-label="Back"><ChevronLeft size={20} /></button>
        <span className="hv-status">{status || `${wordCount(body)} words`}</span>
        {(started || title || body) && (
          <button className="hv-round hv-danger" onClick={remove} aria-label="Delete"><Trash2 size={17} /></button>
        )}
      </header>

      <div className="hv-editor-body">
        <div className="hv-kinds">
          {KINDS.map(k => (
            <button key={k.id} type="button" className={kind === k.id ? 'active' : ''} onClick={() => change(setKind)(k.id)}>{k.label}</button>
          ))}
        </div>
        <input
          className="hv-title"
          value={title}
          onChange={e => change(setTitle)(e.target.value)}
          placeholder="Title"
          maxLength={120}
        />
        <textarea
          ref={areaRef}
          className="hv-text"
          value={body}
          onChange={e => change(setBody)(e.target.value)}
          placeholder={kind === 'poem' ? 'Write your poem…' : kind === 'journal' ? 'Dear diary…' : 'Start writing…'}
          autoFocus={!writing}
        />
      </div>
    </div>
  )
}
