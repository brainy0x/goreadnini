import { BookOpen, Library, Bookmark, Quote, BarChart2, Target, Award, Sparkles, Search, Upload, Star, Moon } from 'lucide-react'

const NAV = [
  { section: 'Library' },
  { id: 'shelf', label: 'My Bookshelf', icon: Library },
  { id: 'search', label: 'Search & Import', icon: Search },
  { id: 'upload', label: 'Upload Epub/PDF', icon: Upload },

  { section: 'Reading' },
  { id: 'highlights', label: 'Highlights', icon: Bookmark },
  { id: 'quotes', label: 'Quotes Journal', icon: Quote },

  { section: 'Progress' },
  { id: 'stats', label: 'Stats & Heatmap', icon: BarChart2 },
  { id: 'goals', label: 'Reading Goals', icon: Target },

  { section: 'Delights' },
  { id: 'badges', label: 'Badges', icon: Award },
  { id: 'wrapped', label: 'Reading Wrapped', icon: Sparkles },
]

export default function Sidebar({ activePage, onNavigate, isMobile, isOpen, onClose }) {
  return (
    <>
      {isMobile && isOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 99 }}
          onClick={onClose}
        />
      )}
      <aside className={`sidebar ${isMobile && isOpen ? 'open' : ''}`}>
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
          <Moon size={12} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'middle', opacity: 0.5 }} />
          "One more chapter..."
        </div>
      </aside>
    </>
  )
}
