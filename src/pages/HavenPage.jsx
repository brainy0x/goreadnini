import { useEffect, useMemo, useRef, useState } from 'react'
import { Lock, Plus, Feather, ShieldCheck, KeyRound } from 'lucide-react'
import { collection, query as fsQuery, where, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebaseConfig'
import { useBooks } from '../contexts/BooksContext'
import { useToast } from '../contexts/ToastContext'
import { checkPin, makePinRecord } from '../lib/pin'
import PinPad from '../components/haven/PinPad'
import WritingEditor, { KINDS } from '../components/haven/WritingEditor'

// The PIN fingerprint as last seen on this device, so the right screen shows straight away
function cachedHaven() {
  try {
    return JSON.parse(localStorage.getItem('grn_settings') || '[]').find(x => x.id === 'profile')?.haven || null
  } catch { return null }
}

const preview = (text) => text.trim().replace(/\n{2,}/g, '\n').slice(0, 170)

// A private place for her own writing, behind a PIN. It locks again when she leaves, or after a minute in the background.
export default function HavenPage() {
  const { profile, saveProfile, writings } = useBooks()
  const toast = useToast()

  const [cached, setCached] = useState(cachedHaven)
  const haven = profile?.haven || cached
  const hasPin = Boolean(haven?.hash)

  const [settled, setSettled] = useState(false)         // brief wait so a synced PIN is noticed before we offer to create one
  const [unlocked, setUnlocked] = useState(false)
  const [firstPin, setFirstPin] = useState(null)
  const [error, setError] = useState('')
  const [reset, setReset] = useState(0)
  const [forgot, setForgot] = useState(false)
  const [accessCode, setAccessCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [shownPin, setShownPin] = useState('')
  const [taps, setTaps] = useState(0)                  // tapping the title 7 times reveals the hidden "Show my PIN"
  const [editing, setEditing] = useState(undefined)     // undefined: closed, null: a new piece, object: an existing one
  const [filter, setFilter] = useState('all')
  const fails = useRef({ count: 0, until: 0 })

  useEffect(() => {
    if (hasPin) return undefined
    const id = setTimeout(() => setSettled(true), 900)
    return () => clearTimeout(id)
  }, [hasPin])

  // lock again after a minute away from the app
  useEffect(() => {
    let hiddenAt = 0
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt > 60000) { setUnlocked(false); setEditing(undefined) }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const wrong = (message) => { setError(message); setReset(n => n + 1) }

  const tryUnlock = async (pin) => {
    const now = Date.now()
    if (now < fails.current.until) { wrong('Too many tries. Please wait a moment.'); return }
    if (await checkPin(pin, haven)) {
      fails.current.count = 0
      setError('')
      setUnlocked(true)
      return
    }
    fails.current.count += 1
    if (fails.current.count >= 5) {
      fails.current = { count: 0, until: now + 30000 }
      wrong('Too many tries. Try again in 30 seconds.')
    } else {
      wrong('That PIN is not right.')
    }
  }

  const createPin = async (pin) => {
    if (!firstPin) {
      setFirstPin(pin)
      setError('')
      setReset(n => n + 1)
    } else if (pin === firstPin) {
      await saveProfile({ haven: await makePinRecord(pin) })
      setUnlocked(true)
      setFirstPin(null)
    } else {
      setFirstPin(null)
      wrong('Those did not match. Let us start again.')
    }
  }

  // forgot the PIN: the app's access code proves it is really her. Her writing is kept.
  const verifyCode = async () => {
    const snap = await getDocs(fsQuery(collection(db, 'access_codes'), where('code', '==', accessCode.trim())))
    if (snap.empty) { toast('That access code is not right', 'error'); return false }
    return true
  }

  const resetPin = async (action) => {
    if (!accessCode.trim() || checking) return
    setChecking(true)
    try {
      if (await verifyCode()) {
        if (action === 'show') {
          if (haven?.pin) setShownPin(haven.pin)
          else toast('This PIN was set before it could be shown. Use Reset PIN.', 'error')
        } else {
          await saveProfile({ haven: null })
          setCached(null)
          toast('PIN cleared. Choose a new one.', 'success')
          setForgot(false)
          setAccessCode('')
          setShownPin('')
          setUnlocked(false)
        }
      }
    } catch {
      toast('Could not check right now. Check your connection.', 'error')
    }
    setChecking(false)
  }

  // change the PIN while unlocked
  const changePin = async () => {
    if (!confirm('Choose a new PIN? Your writing is kept.')) return
    await saveProfile({ haven: null })
    setCached(null)
    setFirstPin(null)
    setError('')
    setUnlocked(false)
  }

  const items = useMemo(
    () => [...writings]
      .filter(w => filter === 'all' || w.kind === filter)
      .sort((a, b) => (b.updated_at || '') > (a.updated_at || '') ? 1 : -1),
    [writings, filter]
  )
  const kindCounts = useMemo(() => {
    const counts = { all: writings.length }
    KINDS.forEach(k => { counts[k.id] = writings.filter(w => w.kind === k.id).length })
    return counts
  }, [writings])

  // ── locked, or no PIN yet ──
  if (!unlocked) {
    if (!hasPin && !settled) return <div className="lib"><div className="hv-wait">Opening your haven…</div></div>

    if (!hasPin) {
      return (
        <div className="lib hv-lock">
          <PinPad
            icon={<ShieldCheck size={30} />}
            title={firstPin ? 'Confirm your PIN' : 'Make your haven private'}
            hint={firstPin ? 'Enter the same 6 digits again.' : 'Choose a 6-digit PIN. Only you will open this space.'}
            error={error}
            resetSignal={reset}
            onComplete={createPin}
          />
        </div>
      )
    }

    return (
      <div className="lib hv-lock">
        <PinPad
          icon={<Lock size={28} />}
          title="Your haven"
          hint="Enter your PIN"
          length={haven?.len || 4}
          onTitleClick={() => setTaps(n => n + 1)}
          error={error}
          resetSignal={reset}
          onComplete={tryUnlock}
        >
          {!forgot ? (
            <button type="button" className="hv-link" onClick={() => setForgot(true)}>Forgot your PIN?</button>
          ) : (
            <form className="hv-forgot" onSubmit={e => { e.preventDefault(); resetPin('reset') }}>
              <p>Enter the access code you use to open GoreadNini.</p>
              <input type="password" className="input" value={accessCode} onChange={e => setAccessCode(e.target.value)} placeholder="Access code" />
              {shownPin && <p>Your PIN is <strong style={{ letterSpacing: '.2em' }}>{shownPin}</strong></p>}
              <div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setForgot(false); setShownPin('') }}>Cancel</button>
                {taps >= 7 && <button type="button" className="btn btn-ghost btn-sm" disabled={checking || !accessCode.trim()} onClick={() => resetPin('show')}>Show my PIN</button>}
                <button type="submit" className="btn btn-primary btn-sm" disabled={checking || !accessCode.trim()}>{checking ? 'Checking…' : 'Reset PIN'}</button>
              </div>
            </form>
          )}
        </PinPad>
      </div>
    )
  }

  // ── open ──
  return (
    <div className="lib">
      <header className="lib-header">
        <h2>Haven</h2>
        <div className="lib-actions">
          <button className="lib-icon" onClick={changePin} aria-label="Change PIN" title="Change PIN"><KeyRound size={18} /></button>
          <button className="lib-icon" onClick={() => { setUnlocked(false); setEditing(undefined) }} aria-label="Lock the haven"><Lock size={18} /></button>
          <button className="lib-icon lib-icon-accent" onClick={() => setEditing(null)} aria-label="Write something new"><Plus size={20} /></button>
        </div>
      </header>

      <div className="lib-chips">
        {[{ id: 'all', label: 'All' }, ...KINDS].map(k => (
          <button key={k.id} className={`lib-chip ${filter === k.id ? 'active' : ''}`} onClick={() => setFilter(k.id)}>
            {k.label}<small>{kindCounts[k.id]}</small>
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="empty-state hv-empty">
          <Feather size={44} />
          <h3>{writings.length === 0 ? 'Your haven is quiet' : 'Nothing here yet'}</h3>
          <p>{writings.length === 0 ? 'Tap + to write your first poem, story or thought.' : 'Nothing written in this kind yet.'}</p>
        </div>
      ) : (
        <div className="hv-list">
          {items.map(w => (
            <button key={w.id} className="hv-card" onClick={() => setEditing(w)}>
              <div className="hv-card-top">
                <span className="hv-kind">{KINDS.find(k => k.id === w.kind)?.label || 'Note'}</span>
                <span className="hv-date">{w.updated_at ? new Date(w.updated_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
              </div>
              <div className="hv-card-title">{w.title || 'Untitled'}</div>
              {w.body && <div className="hv-card-preview">{preview(w.body)}</div>}
            </button>
          ))}
        </div>
      )}

      {editing !== undefined && (
        <WritingEditor
          key={editing?.id || 'new'}
          writing={editing}
          defaultKind={filter === 'all' ? 'poem' : filter}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  )
}
