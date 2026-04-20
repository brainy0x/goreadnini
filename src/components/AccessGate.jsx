import { useState } from 'react'

const ACCESS_CODE = '092811' // Change this to whatever you want!

export default function AccessGate({ onUnlock }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [shaking, setShaking] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (code.trim().toUpperCase() === ACCESS_CODE) {
      localStorage.setItem('grn_access', 'true')
      onUnlock()
    } else {
      setError('The realm does not recognise this key. Try again.')
      setShaking(true)
      setTimeout(() => setShaking(false), 500)
      setCode('')
    }
  }

  return (
    <div className="access-gate">
      <div className="access-panel" style={{ animation: shaking ? 'shake 0.4s ease' : 'none' }}>
        <style>{`
          @keyframes shake {
            0%,100%{transform:translateX(0)}
            25%{transform:translateX(-8px)}
            75%{transform:translateX(8px)}
          }
          .flicker {
            animation: flicker 3s infinite;
          }
          @keyframes flicker {
            0%,90%,100%{opacity:1}
            92%{opacity:0.6}
            95%{opacity:1}
            97%{opacity:0.7}
          }
        `}</style>

        <div style={{ color: 'var(--gold-dim)', fontSize: '0.75rem', letterSpacing: '0.4rem', marginBottom: '1.5rem', opacity: 0.6 }}>✦ ✦ ✦</div>

        <span className="access-crest flicker">🏰</span>

        <h1 className="access-title">GoreadNini</h1>
        <p className="access-subtitle">Her books, her pace, her realm.</p>

        <div style={{ margin: '0 0 1.5rem', padding: '1rem', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          <p style={{ font: 'italic 0.9rem/1.6 "IM Fell English", serif', color: 'var(--text-muted)' }}>
            "She is too fond of books, and it has turned her brain."<br/>
            <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>— Louisa May Alcott</span>
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Enter your access code</label>
            <input
              className="input"
              type="password"
              value={code}
              onChange={e => { setCode(e.target.value); setError('') }}
              placeholder="Your secret key..."
              autoFocus
              style={{ textAlign: 'center', letterSpacing: '0.2em', fontSize: '1.1rem' }}
            />
          </div>
          {error && <p className="access-error">{error}</p>}
          <button className="btn btn-primary" type="submit" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}>
            Enter the Library
          </button>
        </form>

        <p style={{ marginTop: '1.5rem', fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          A private sanctuary for one reader only.
        </p>
      </div>
    </div>
  )
}
