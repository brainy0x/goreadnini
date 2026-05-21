import { useRef } from 'react'
import { useBooks } from '../contexts/BooksContext'

export default function WrappedPage() {
  const { books, highlights, quotes, sessions } = useBooks()
  const cardRef = useRef()

  const year = new Date().getFullYear()
  const finished = books.filter(b => b.shelf === 'finished')
  const totalPages = books.reduce((a, b) => a + (b.pages_read || 0), 0)
  const totalMins = sessions.reduce((a, s) => a + (s.minutes || 0), 0)
  const totalHours = Math.round(totalMins / 60)

  const genres = {}
  books.forEach(b => { if (b.genre) { const g = b.genre.split(',')[0].trim(); genres[g] = (genres[g] || 0) + 1 } })
  const topGenre = Object.entries(genres).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Mystery'

  const topRated = [...books].filter(b => b.rating).sort((a, b) => b.rating - a.rating)[0]

  // Reading personality
  const personality = (() => {
    if (finished.length >= 20) return { title: 'Voracious Devourer', desc: 'You consume stories like others breathe air.' }
    if (finished.length >= 10) return { title: 'The Devoted Reader', desc: 'Books are not a hobby — they are a way of being.' }
    if (finished.length >= 5) return { title: 'The Story Seeker', desc: 'Every book is a new world waiting to be found.' }
    if (finished.length >= 1) return { title: 'The Beginning', desc: 'Every great library started with a single book.' }
    return { title: 'The Dreamer', desc: 'Your shelf is full of promises. Turn the first page.' }
  })()

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Reading Wrapped</h2>
          <p className="page-subtitle">Your story of {year}, in numbers</p>
        </div>
      </div>

      <div className="page-body">
        <div className="wrapped-layout" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2.5rem', alignItems: 'start', flexWrap: 'wrap' }}>
          {/* The wrapped card */}
          <div ref={cardRef} className="wrapped-card" style={{
            background: 'linear-gradient(160deg, #0f0a0d 0%, #1a0c14 40%, #0d0f1c 100%)',
            border: '1px solid var(--border-bright)',
            borderRadius: 16,
            padding: '2.5rem 2rem',
            width: 320,
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            {/* Decorative glows */}
            <div style={{ position: 'absolute', top: -60, left: -60, width: 200, height: 200, background: 'radial-gradient(circle, rgba(139,26,46,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -60, right: -60, width: 200, height: 200, background: 'radial-gradient(circle, rgba(201,168,76,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', letterSpacing: '0.35em', color: 'var(--gold-dim)', marginBottom: '0.4rem' }}>GOREADNINI</div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '2.5rem', fontWeight: 700, color: 'var(--gold-light)', lineHeight: 1, marginBottom: '0.25rem' }}>{year}</div>
              <div style={{ fontFamily: 'IM Fell English, serif', fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>Reading Wrapped</div>

              {/* Big stat */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '4rem', fontWeight: 700, color: 'white', lineHeight: 1, letterSpacing: '-0.02em' }}>{finished.length}</div>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.75rem', letterSpacing: '0.2em', color: 'var(--text-muted)', marginTop: '0.3rem' }}>BOOKS FINISHED</div>
              </div>

              {/* Stats row */}
              <div className="wrapped-stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '2rem' }}>
                {[
                  { val: totalPages.toLocaleString(), label: 'Pages Read' },
                  { val: `${totalHours}h`, label: 'Hours Reading' },
                  { val: highlights.length, label: 'Highlights' },
                  { val: quotes.length, label: 'Quotes Saved' },
                ].map((s, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 8, padding: '0.75rem 0.5rem' }}>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: 'var(--gold-light)', fontWeight: 600 }}>{s.val}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', marginTop: '0.15rem' }}>{s.label.toUpperCase()}</div>
                  </div>
                ))}
              </div>

              {/* Top genre */}
              {topGenre && (
                <div style={{ marginBottom: '1.25rem', padding: '0.75rem', background: 'rgba(139,26,46,0.2)', border: '1px solid rgba(139,26,46,0.3)', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.62rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.15em', color: 'var(--crimson-light)', marginBottom: '0.25rem' }}>TOP GENRE</div>
                  <div style={{ fontFamily: 'IM Fell English, serif', fontStyle: 'italic', color: 'var(--text-primary)', fontSize: '1.1rem' }}>{topGenre}</div>
                </div>
              )}

              {/* Top rated */}
              {topRated && (
                <div style={{ marginBottom: '1.25rem', padding: '0.75rem', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.62rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.15em', color: 'var(--gold-dim)', marginBottom: '0.25rem' }}>FAVOURITE BOOK</div>
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 500 }}>{topRated.title}</div>
                  <div style={{ color: 'var(--gold)', fontSize: '0.85rem', marginTop: '0.2rem' }}>{'★'.repeat(topRated.rating)}</div>
                </div>
              )}

              {/* Personality */}
              <div style={{ borderTop: '1px solid rgba(201,168,76,0.15)', paddingTop: '1.25rem' }}>
                <div style={{ fontSize: '0.62rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>YOUR READING SPIRIT</div>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'var(--gold-light)', marginBottom: '0.3rem', fontWeight: 600 }}>{personality.title}</div>
                <div style={{ fontFamily: 'IM Fell English, serif', fontStyle: 'italic', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{personality.desc}</div>
              </div>

              <div style={{ marginTop: '1.5rem', fontFamily: 'Cinzel, serif', fontSize: '0.55rem', letterSpacing: '0.25em', color: 'var(--text-muted)', opacity: 0.5 }}>GOREADNINI • {year}</div>
            </div>
          </div>

          {/* Right side explanations */}
          <div className="wrapped-details" style={{ minWidth: 240 }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', letterSpacing: '0.15em', color: 'var(--gold-dim)', marginBottom: '1.25rem' }}>YOUR {year} IN READING</div>

            {[
              { icon: '📚', title: 'Books Finished', value: `${finished.length} books`, detail: finished.length > 0 ? `Last: "${finished[finished.length-1]?.title}"` : 'Start your first book!' },
              { icon: '📄', title: 'Pages Turned', value: totalPages.toLocaleString(), detail: `That's roughly ${Math.round(totalPages / 250)} novels worth` },
              { icon: '⏰', title: 'Time Reading', value: `${totalHours} hours`, detail: `${Math.round(totalMins / 60 / 24 * 10) / 10} days of your life, beautifully spent` },
              { icon: '✨', title: 'Moments Saved', value: `${highlights.length + quotes.length}`, detail: `${highlights.length} highlights + ${quotes.length} quotes` },
              { icon: '🌹', title: 'Reading Spirit', value: personality.title, detail: personality.desc },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.5rem', flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
                <div>
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.15rem' }}>{item.title}</div>
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'var(--gold-light)', fontWeight: 600 }}>{item.value}</div>
                  <div style={{ fontFamily: 'IM Fell English, serif', fontStyle: 'italic', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4, marginTop: '0.15rem' }}>{item.detail}</div>
                </div>
              </div>
            ))}

            <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)' }}>
              <div style={{ fontFamily: 'IM Fell English, serif', fontStyle: 'italic', fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                "A reader lives a thousand lives before she dies. The man who never reads lives only one."
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>— George R.R. Martin</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
