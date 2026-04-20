import { useBooks } from '../contexts/BooksContext'

const BADGES = [
  { id: 'first_book', icon: '📖', name: 'First Page', desc: 'Add your first book', check: ({ books }) => books.length >= 1 },
  { id: 'five_books', icon: '📚', name: 'Bookworm', desc: 'Add 5 books', check: ({ books }) => books.length >= 5 },
  { id: 'ten_books', icon: '🗄️', name: 'Collector', desc: 'Add 10 books', check: ({ books }) => books.length >= 10 },
  { id: 'first_finish', icon: '🏁', name: 'The Last Page', desc: 'Finish your first book', check: ({ books }) => books.filter(b => b.shelf === 'finished').length >= 1 },
  { id: 'five_finish', icon: '🎖️', name: 'Scholar', desc: 'Finish 5 books', check: ({ books }) => books.filter(b => b.shelf === 'finished').length >= 5 },
  { id: 'ten_finish', icon: '👑', name: 'Sovereign Reader', desc: 'Finish 10 books', check: ({ books }) => books.filter(b => b.shelf === 'finished').length >= 10 },
  { id: 'first_highlight', icon: '✨', name: 'Illuminator', desc: 'Save your first highlight', check: ({ highlights }) => highlights.length >= 1 },
  { id: 'ten_highlights', icon: '🌟', name: 'Archivist', desc: 'Save 10 highlights', check: ({ highlights }) => highlights.length >= 10 },
  { id: 'first_quote', icon: '💬', name: 'Wordsmith', desc: 'Save your first quote', check: ({ quotes }) => quotes.length >= 1 },
  { id: 'ten_quotes', icon: '📜', name: 'Chronicler', desc: 'Save 10 quotes', check: ({ quotes }) => quotes.length >= 10 },
  { id: 'streak_3', icon: '🔥', name: 'Kindled', desc: 'Read 3 days in a row', check: ({ sessions }) => calcStreak(sessions) >= 3 },
  { id: 'streak_7', icon: '⚡', name: 'Devoted', desc: 'Read 7 days in a row', check: ({ sessions }) => calcStreak(sessions) >= 7 },
  { id: 'streak_30', icon: '💫', name: 'Eternal Flame', desc: 'Read 30 days in a row', check: ({ sessions }) => calcStreak(sessions) >= 30 },
  { id: 'night_reader', icon: '🌙', name: 'Night Owl', desc: 'Read after midnight (logged 5 late sessions)', check: () => false }, // fun placeholder
  { id: 'genre_collector', icon: '🗺️', name: 'Genre Explorer', desc: 'Read 3 different genres', check: ({ books }) => new Set(books.filter(b => b.genre).map(b => b.genre.split(',')[0].trim())).size >= 3 },
  { id: 'wishlist_20', icon: '⭐', name: 'Dreamer', desc: 'Add 20 books to wishlist', check: ({ books }) => books.filter(b => b.shelf === 'wishlist').length >= 20 },
  { id: 'reviewer', icon: '🖊️', name: 'Critic', desc: 'Write a review', check: ({ books }) => books.some(b => b.review?.trim()) },
  { id: 'five_stars', icon: '🌹', name: 'Beloved', desc: 'Give a book 5 stars', check: ({ books }) => books.some(b => b.rating === 5) },
]

function calcStreak(sessions) {
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    if (sessions.some(s => s.date === key)) streak++
    else break
  }
  return streak
}

export default function BadgesPage() {
  const { books, highlights, quotes, sessions } = useBooks()
  const data = { books, highlights, quotes, sessions }

  const earned = BADGES.filter(b => b.check(data))
  const locked = BADGES.filter(b => !b.check(data))

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Badges & Milestones</h2>
          <p className="page-subtitle">{earned.length} of {BADGES.length} earned</p>
        </div>
      </div>

      <div className="page-body">
        {earned.length > 0 && (
          <>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', letterSpacing: '0.2em', color: 'var(--gold)', marginBottom: '1rem' }}>✦ EARNED</div>
            <div className="badge-grid" style={{ marginBottom: '2rem' }}>
              {earned.map(b => (
                <div key={b.id} className="badge-item earned">
                  <span className="badge-icon">{b.icon}</span>
                  <div className="badge-name">{b.name}</div>
                  <div className="badge-desc">{b.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {locked.length > 0 && (
          <>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', letterSpacing: '0.2em', color: 'var(--text-muted)', marginBottom: '1rem' }}>LOCKED</div>
            <div className="badge-grid">
              {locked.map(b => (
                <div key={b.id} className="badge-item locked">
                  <span className="badge-icon">{b.icon}</span>
                  <div className="badge-name">{b.name}</div>
                  <div className="badge-desc">{b.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {earned.length === 0 && (
          <div className="empty-state" style={{ paddingTop: '1rem' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🏰</span>
            <h3>Begin your quest</h3>
            <p>Add your first book to earn the "First Page" badge and start your collection.</p>
          </div>
        )}
      </div>
    </div>
  )
}
