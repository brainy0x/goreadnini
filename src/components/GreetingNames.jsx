import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import { useToast } from '../contexts/ToastContext'

const DEFAULT_GREETING_NAMES = ['Nini', 'Semo', 'iyawo mii']

// What the launch splash will pick from: the synced list, else what this device last saved, else the defaults
function currentNames(profile) {
  if (Array.isArray(profile?.names) && profile.names.length) return profile.names
  try {
    const local = JSON.parse(localStorage.getItem('grn_greeting_names') || 'null')
    if (Array.isArray(local) && local.length) return local
  } catch { /* fall through */ }
  return DEFAULT_GREETING_NAMES
}

export default function GreetingNames({ onClose }) {
  const { profile, saveProfile } = useBooks()
  const toast = useToast()
  const [names, setNames] = useState(() => currentNames(profile))
  const [draft, setDraft] = useState('')

  const add = () => {
    const name = draft.trim()
    if (!name) return
    if (names.some(n => n.toLowerCase() === name.toLowerCase())) { setDraft(''); return }
    setNames([...names, name])
    setDraft('')
  }

  const remove = (name) => setNames(names.filter(n => n !== name))

  const save = async () => {
    // pressing Save with a name still typed in the box counts as adding it
    const pending = draft.trim()
    const finalNames = pending && !names.some(n => n.toLowerCase() === pending.toLowerCase()) ? [...names, pending] : names
    if (finalNames.length === 0) { toast('Keep at least one name', 'error'); return }
    try { localStorage.setItem('grn_greeting_names', JSON.stringify(finalNames)) } catch { /* storage full */ }
    await saveProfile({ names: finalNames })
    toast('Greeting names saved ✦', 'success')
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Greeting names</div>
            <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: '.2rem' }}>
              When the app opens, it says “Welcome back” with one of these.
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="modal-body">
          <div className="gn-chips">
            {names.map(n => (
              <span key={n} className="gn-chip">
                {n}
                <button type="button" onClick={() => remove(n)} aria-label={`Remove ${n}`}><X size={13} /></button>
              </span>
            ))}
          </div>

          <div className="gn-add">
            <input
              className="input"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && add()}
              placeholder="Add a name, e.g. Baby"
              maxLength={24}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={add} disabled={!draft.trim()}>
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
