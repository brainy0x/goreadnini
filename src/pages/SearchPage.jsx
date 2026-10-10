import { useState } from 'react'
import CatalogImport from '../components/CatalogImport'
import SiteBookmarks from '../components/SiteBookmarks'

const TABS = [
  { id: 'free',      label: 'Free Books' },
  { id: 'bookmarks', label: 'Bookmarks' },
]

export default function SearchPage({ onRead, onNavigate }) {
  const [tab, setTab] = useState('free')

  return (
    <div className="lib">
      <header className="lib-header">
        <h2>Find Books</h2>
      </header>

      <div className="lib-chips sr-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`lib-chip ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'free' && <CatalogImport onRead={onRead} />}
      {tab === 'bookmarks' && <SiteBookmarks onNavigate={onNavigate} />}
    </div>
  )
}
