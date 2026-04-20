import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import { ToastProvider } from './contexts/ToastContext'
import { BooksProvider } from './contexts/BooksContext'
import AccessGate from './components/AccessGate'
import Sidebar from './components/Sidebar'
import EpubReader from './components/EpubReader'
import ShelfPage from './pages/ShelfPage'
import SearchPage from './pages/SearchPage'
import UploadPage from './pages/UploadPage'
import HighlightsPage from './pages/HighlightsPage'
import QuotesPage from './pages/QuotesPage'
import StatsPage from './pages/StatsPage'
import GoalsPage from './pages/GoalsPage'
import BadgesPage from './pages/BadgesPage'
import WrappedPage from './pages/WrappedPage'

const ACCESS_CODE_KEY = 'grn_access'

function AppShell() {
  const [page, setPage] = useState('shelf')
  const [readingBook, setReadingBook] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const navigate = (p) => { setPage(p); setMobileOpen(false) }

  const renderPage = () => {
    switch (page) {
      case 'shelf':      return <ShelfPage onRead={setReadingBook} />
      case 'search':     return <SearchPage />
      case 'upload':     return <UploadPage onRead={setReadingBook} />
      case 'highlights': return <HighlightsPage />
      case 'quotes':     return <QuotesPage />
      case 'stats':      return <StatsPage />
      case 'goals':      return <GoalsPage />
      case 'badges':     return <BadgesPage />
      case 'wrapped':    return <WrappedPage />
      default:           return <ShelfPage onRead={setReadingBook} />
    }
  }

  return (
    <div className="app-shell">
      {readingBook && <EpubReader book={readingBook} onClose={() => setReadingBook(null)} />}
      <Sidebar activePage={page} onNavigate={navigate} isMobile={isMobile} isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="main-content">
        {isMobile && (
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-panel)', position: 'sticky', top: 0, zIndex: 50 }}>
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'var(--gold-light)', letterSpacing: '0.06em' }}>📚 GoreadNini</span>
            <button onClick={() => setMobileOpen(!mobileOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.3rem' }}>
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        )}
        {renderPage()}
      </main>
    </div>
  )
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem(ACCESS_CODE_KEY) === 'true')

  if (!unlocked) {
    return (
      <ToastProvider>
        <AccessGate onUnlock={() => setUnlocked(true)} />
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
      <BooksProvider userId={null}>
        <AppShell />
      </BooksProvider>
    </ToastProvider>
  )
}
