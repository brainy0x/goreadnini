import { useState } from 'react'
import { useBooks } from '../contexts/BooksContext'
import HighlightsPage from './HighlightsPage'
import QuotesPage from './QuotesPage'

export default function NotesPage() {
  const { highlights, quotes, bookmarks } = useBooks()
  const [tab, setTab] = useState('highlights')

  const tabs = [
    { id: 'highlights', label: 'Highlights', count: highlights.length },
    { id: 'quotes',     label: 'Quotes',     count: quotes.length },
    { id: 'bookmarks',  label: 'Bookmarks',  count: bookmarks.length },
  ]

  return (
    <div className="lib">
      <header className="lib-header">
        <h2>Notes</h2>
      </header>

      <div className="lib-chips">
        {tabs.map(t => (
          <button key={t.id} className={`lib-chip ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            <small>{t.count}</small>
          </button>
        ))}
      </div>

      {tab === 'quotes' ? <QuotesPage /> : <HighlightsPage view={tab} />}
    </div>
  )
}
