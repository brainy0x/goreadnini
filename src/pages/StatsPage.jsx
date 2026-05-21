import { useState } from 'react'
import { useBooks } from '../contexts/BooksContext'

function GoalRing({ pct, size = 64, stroke = 5, color = 'var(--gold)' }) {
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-deep)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
    </svg>
  )
}

function Heatmap({ sessions }) {
  const today = new Date()
  const cells = []
  for (let i = 363; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    const daySessions = sessions.filter(s => s.date === key)
    const mins = daySessions.reduce((acc, s) => acc + (s.minutes || 0), 0)
    let level = 0
    if (mins > 0) level = 1
    if (mins >= 20) level = 2
    if (mins >= 45) level = 3
    if (mins >= 90) level = 4
    cells.push({ key, level, mins })
  }

  return (
    <div>
      <div className="heatmap-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(52, 1fr)', gap: 2 }}>
        {cells.map(c => (
          <div
            key={c.key}
            title={`${c.key}: ${c.mins} min`}
            style={{
              aspectRatio: '1',
              borderRadius: 2,
              background: c.level === 0 ? 'var(--bg-card)' :
                c.level === 1 ? 'rgba(139,26,46,0.3)' :
                c.level === 2 ? 'rgba(139,26,46,0.6)' :
                c.level === 3 ? 'var(--crimson)' : 'var(--gold-dim)',
            }}
          />
        ))}
      </div>
      <div className="heatmap-legend" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        <span>Less</span>
        {[0,1,2,3,4].map(l => (
          <div key={l} style={{ width: 10, height: 10, borderRadius: 2, background: l === 0 ? 'var(--bg-card)' : l === 1 ? 'rgba(139,26,46,0.3)' : l === 2 ? 'rgba(139,26,46,0.6)' : l === 3 ? 'var(--crimson)' : 'var(--gold-dim)' }} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}

export default function StatsPage() {
  const { books, sessions, highlights, quotes } = useBooks()
  const [logMins, setLogMins] = useState(30)
  const [logBookId, setLogBookId] = useState('')
  const { addSession } = useBooks()

  const finished = books.filter(b => b.shelf === 'finished').length
  const reading = books.filter(b => b.shelf === 'reading').length
  const totalPages = books.reduce((a, b) => a + (b.pages_read || 0), 0)
  const totalMins = sessions.reduce((a, s) => a + (s.minutes || 0), 0)
  const totalHours = Math.round(totalMins / 60)

  // Streak calculation
  const today = new Date().toISOString().split('T')[0]
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    if (sessions.some(s => s.date === key)) streak++
    else break
  }

  // Genre breakdown
  const genres = {}
  books.forEach(b => { if (b.genre) { const g = b.genre.split(',')[0].trim(); genres[g] = (genres[g] || 0) + 1 } })
  const topGenres = Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const handleLog = async () => {
    if (!logBookId) return
    await addSession({ book_id: logBookId, minutes: Number(logMins), pages_read: 0 })
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Stats & History</h2>
          <p className="page-subtitle">Your reading journey at a glance</p>
        </div>
      </div>

      <div className="page-body">
        {/* Stats grid */}
        <div className="stats-grid">
          {[
            { value: books.length, label: 'Books in Library' },
            { value: finished, label: 'Books Finished' },
            { value: reading, label: 'Currently Reading' },
            { value: totalPages.toLocaleString(), label: 'Pages Read' },
            { value: totalHours, label: 'Hours Reading' },
            { value: `${streak}d`, label: 'Current Streak' },
            { value: highlights.length, label: 'Highlights Saved' },
            { value: quotes.length, label: 'Quotes Collected' },
          ].map((s, i) => (
            <div key={i} className="stat-card">
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Reading heatmap */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', letterSpacing: '0.15em', color: 'var(--gold-dim)', marginBottom: '1rem' }}>READING ACTIVITY — PAST YEAR</div>
          <Heatmap sessions={sessions} />
        </div>

        {/* Genre breakdown */}
        {topGenres.length > 0 && (
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', letterSpacing: '0.15em', color: 'var(--gold-dim)', marginBottom: '1rem' }}>TOP GENRES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {topGenres.map(([g, count]) => (
                <div key={g}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    <span style={{ fontStyle: 'italic' }}>{g}</span>
                    <span style={{ fontFamily: 'Cinzel, serif', color: 'var(--gold-dim)' }}>{count}</span>
                  </div>
                  <div style={{ height: 3, background: 'var(--bg-deep)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(count / books.length) * 100}%`, background: 'linear-gradient(90deg, var(--crimson), var(--gold))', borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Log a session */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', letterSpacing: '0.15em', color: 'var(--gold-dim)', marginBottom: '1rem' }}>LOG A READING SESSION</div>
          <div className="session-form" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label className="form-label">Book</label>
              <select className="select" value={logBookId} onChange={e => setLogBookId(e.target.value)}>
                <option value="">Select a book...</option>
                {books.filter(b => b.shelf === 'reading').map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
              </select>
            </div>
            <div style={{ width: 120 }}>
              <label className="form-label">Minutes</label>
              <input className="input" type="number" value={logMins} onChange={e => setLogMins(e.target.value)} min={1} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleLog} disabled={!logBookId} style={{ marginBottom: 2 }}>
              Log Session
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
