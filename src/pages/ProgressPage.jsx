import { useState } from 'react'
import GoalsPage from './GoalsPage'
import StatsPage from './StatsPage'
import BadgesPage from './BadgesPage'
import WrappedPage from './WrappedPage'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'badges',   label: 'Badges' },
  { id: 'wrapped',  label: 'Wrapped' },
]

export default function ProgressPage() {
  const [tab, setTab] = useState('overview')

  return (
    <div className="lib">
      <header className="lib-header">
        <h2>Progress</h2>
      </header>

      <div className="lib-chips">
        {TABS.map(t => (
          <button key={t.id} className={`lib-chip ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <GoalsPage />
          <div style={{ height: '1.25rem' }} />
          <StatsPage />
        </>
      )}
      {tab === 'badges' && <BadgesPage />}
      {tab === 'wrapped' && <WrappedPage />}
    </div>
  )
}
