// src/components/Sidebar.jsx
import { BookOpen, Library, Bookmark, Quote, BarChart2, Target, Award, Sparkles, Search, Upload, Moon, Wifi, WifiOff, Loader, Cloud } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'

const NAV = [
  { section: 'Library' },
  { id: 'shelf',      label: 'My Bookshelf',    icon: Library  },
  { id: 'search',     label: 'Search & Import', icon: Search   },
  { id: 'upload',     label: 'Upload Book',     icon: Upload   },

  { section: 'Reading' },
  { id: 'highlights', label: 'Highlights',      icon: Bookmark },
  { id: 'quotes',     label: 'Quotes Journal',  icon: Quote    },

  { section: 'Progress' },
  { id: 'stats',      label: 'Stats & Heatmap', icon: BarChart2 },
  { id: 'goals',      label: 'Reading Goals',   icon: Target   },

  { section: 'Delights' },
  { id: 'badges',     label: 'Badges',          icon: Award    },
  { id: 'wrapped',    label: 'Reading Wrapped', icon: Sparkles },
]

function SyncBadge({ status }) {
  if (status === 'local') return (
    <div title="Running locally — set up Firebase for multi-device sync" style={{ display: 'flex', alignItems: 'center', gap: '.35rem', fontSize: '.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
      <WifiOff size={11} /> Local only
    </div>
  )
  if (status === 'syncing') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '.35rem', fontSize: '.72rem', color: 'var(--gold-dim)' }}>
      <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> Syncing...
    </div>
  )
  if (status === 'offline') return (
    <div title="Firebase offline — changes saved locally" style={{ display: 'flex', alignItems: 'center', gap: '.35rem', fontSize: '.72rem', color: '#e87060' }}>
      <WifiOff size={11} /> Offline
    </div>
  )
  // synced
  return (
    <div title="Synced across all your devices" style={{ display: 'flex', alignItems: 'center', gap: '.35rem', fontSize: '.72rem', color: '#6ab87a' }}>
      <Cloud size={11} /> Synced
    </div>
  )
}

export default function Sidebar({ activePage, onNavigate, isMobile, isOpen, onClose }) {
  const { syncStatus } = useBooks()

  return (
    <>
      <aside className={`sidebar ${isMobile ? (isOpen ? 'open' : '') : ''}`}>
        <div className="sidebar-logo">
          <h1>📚 GoreadNini</h1>
          <p>Her books, her pace, her realm.</p>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item, i) => {
            if (item.section) return (
              <div key={i} className="nav-section-label">{item.section}</div>
            )
            const Icon = item.icon
            return (
              <div
                key={item.id}
                className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                onClick={() => { onNavigate(item.id); if (isMobile) onClose() }}
              >
                <Icon size={15} />
                {item.label}
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
            <SyncBadge status={syncStatus} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '.35rem', color: 'var(--text-muted)', fontSize: '.8rem', fontStyle: 'italic' }}>
              <Moon size={11} style={{ opacity: .5 }} />
              "One more chapter..."
            </div>
          </div>
        </div>
      </aside>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  )
}
