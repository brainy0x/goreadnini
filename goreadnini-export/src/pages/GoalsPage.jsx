import { useState } from 'react'
import { useBooks } from '../contexts/BooksContext'
import { useToast } from '../contexts/ToastContext'

function Ring({ pct, size = 72, stroke = 6 }) {
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const dash = (Math.min(pct, 100) / 100) * circ
  const color = pct >= 100 ? 'var(--gold)' : pct >= 60 ? 'var(--crimson-light)' : 'var(--crimson)'
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-deep)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.7s ease' }} />
    </svg>
  )
}

export default function GoalsPage() {
  const { books, goals, saveGoal } = useBooks()
  const toast = useToast()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const [yearlyTarget, setYearlyTarget] = useState(
    goals.find(g => g.type === 'yearly' && g.year === year)?.target || 12
  )
  const [monthlyTarget, setMonthlyTarget] = useState(
    goals.find(g => g.type === 'monthly' && g.year === year && g.month === month)?.target || 2
  )
  const [saving, setSaving] = useState(false)

  const finishedThisYear = books.filter(b => {
    if (b.shelf !== 'finished' || !b.date_finished) return false
    return new Date(b.date_finished).getFullYear() === year
  }).length

  const finishedThisMonth = books.filter(b => {
    if (b.shelf !== 'finished' || !b.date_finished) return false
    const d = new Date(b.date_finished)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  }).length

  // Fallback: count all finished if no date_finished data
  const effectiveYearlyRead = finishedThisYear || books.filter(b => b.shelf === 'finished').length
  const yearlyPct = yearlyTarget > 0 ? Math.round((effectiveYearlyRead / yearlyTarget) * 100) : 0
  const monthlyPct = monthlyTarget > 0 ? Math.round((finishedThisMonth / monthlyTarget) * 100) : 0

  const handleSave = async () => {
    setSaving(true)
    await Promise.all([
      saveGoal({ type: 'yearly', target: Number(yearlyTarget), year, month: null }),
      saveGoal({ type: 'monthly', target: Number(monthlyTarget), year, month }),
    ])
    toast('Goals saved ✦', 'success')
    setSaving(false)
  }

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Reading Goals</h2>
          <p className="page-subtitle">Set your intentions, track your progress</p>
        </div>
      </div>

      <div className="page-body" style={{ maxWidth: 680 }}>
        {/* Goal cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
          {[
            {
              label: `${year} Yearly Goal`,
              current: effectiveYearlyRead,
              target: yearlyTarget,
              pct: yearlyPct,
              unit: 'books',
              desc: yearlyPct >= 100 ? '🎉 Goal achieved!' : `${yearlyTarget - effectiveYearlyRead} more to reach your goal`,
            },
            {
              label: `${monthNames[month-1]} Goal`,
              current: finishedThisMonth,
              target: monthlyTarget,
              pct: monthlyPct,
              unit: 'books',
              desc: monthlyPct >= 100 ? '🎉 Month conquered!' : `${monthlyTarget - finishedThisMonth} more this month`,
            }
          ].map((g, i) => (
            <div key={i} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', letterSpacing: '0.15em', color: 'var(--gold-dim)' }}>{g.label.toUpperCase()}</div>
              <div style={{ position: 'relative', width: 72, height: 72 }}>
                <Ring pct={g.pct} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'var(--gold-light)', fontWeight: 600, lineHeight: 1 }}>{g.pct}%</span>
                </div>
              </div>
              <div>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                  {g.current} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ {g.target}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.2rem' }}>{g.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Edit goals */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', letterSpacing: '0.15em', color: 'var(--gold-dim)', marginBottom: '1rem' }}>SET YOUR GOALS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Books to read in {year}</label>
              <input className="input" type="number" min="1" max="365" value={yearlyTarget} onChange={e => setYearlyTarget(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Books to read in {monthNames[month-1]}</label>
              <input className="input" type="number" min="1" max="100" value={monthlyTarget} onChange={e => setMonthlyTarget(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Goals'}
            </button>
          </div>
        </div>

        {/* Currently reading progress */}
        {books.filter(b => b.shelf === 'reading').length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', letterSpacing: '0.15em', color: 'var(--gold-dim)', marginBottom: '1rem' }}>IN PROGRESS</div>
            {books.filter(b => b.shelf === 'reading').map(b => (
              <div key={b.id} className="card" style={{ padding: '1rem 1.25rem', marginBottom: '0.75rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {b.cover_url
                  ? <img src={b.cover_url} alt={b.title} style={{ width: 40, height: 56, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} />
                  : <div style={{ width: 40, height: 56, background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 3, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📖</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: '0.3rem' }}>{b.title}</div>
                  <div style={{ height: 4, background: 'var(--bg-deep)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${b.progress || 0}%`, background: 'linear-gradient(90deg, var(--crimson), var(--gold))', borderRadius: 2, transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem', fontStyle: 'italic' }}>{b.progress || 0}% complete</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
