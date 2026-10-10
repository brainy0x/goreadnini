import { useState, useEffect } from 'react'
import { Library, Search, Feather, Bookmark, BarChart2 } from 'lucide-react'
import { ToastProvider } from './contexts/ToastContext'
import { BooksProvider, useBooks } from './contexts/BooksContext'
import { ThemeProvider } from './contexts/ThemeContext'
import AccessGate from './components/AccessGate'
import Sidebar from './components/Sidebar'
import EpubReader from './components/EpubReader'
import PdfReader from './components/PdfReader'
import PomodoroFloat from './components/PomodoroFloat'
import GlitterBackground from './components/GlitterBackground'
import { PomodoroProvider } from './contexts/PomodoroContext'
import { AppThemeProvider } from './contexts/AppThemeContext'
import ShelfPage from './pages/ShelfPage'
import SearchPage from './pages/SearchPage'
import UploadPage from './pages/UploadPage'
import NotesPage from './pages/NotesPage'
import ProgressPage from './pages/ProgressPage'
import HavenPage from './pages/HavenPage'

const ACCESS_CODE_KEY = 'grn_access'

const isPdfBook = (b) => b.file_type === 'pdf' || /\.pdf$/i.test(b.file_name || '')

const MOBILE_TABS = [
  { id: 'shelf',    label: 'Library',  icon: Library },
  { id: 'search',   label: 'Find',     icon: Search },
  { id: 'notes',    label: 'Notes',    icon: Bookmark },
  { id: 'haven',    label: 'Haven',    icon: Feather },
  { id: 'progress', label: 'Progress', icon: BarChart2 },
]

function AppShell() {
  const { loading, profile } = useBooks()
  const [page, setPage]               = useState('shelf')
  const [readingBook, setReadingBook] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile]       = useState(
    typeof window !== 'undefined' && window.innerWidth < 768
  )

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setSidebarOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  const navigate = (p) => {
    setPage(p)
    setSidebarOpen(false)
  }

  // The launch splash (in index.html) fades away once the library is ready
  useEffect(() => {
    if (!loading) window.__grnSplashDone?.()
  }, [loading])

  // Keep this device's greeting names in step with the synced list, for the next launch's splash
  useEffect(() => {
    if (Array.isArray(profile?.names) && profile.names.length) {
      try { localStorage.setItem('grn_greeting_names', JSON.stringify(profile.names)) } catch { /* storage full */ }
    }
  }, [profile])

  const renderPage = () => {
    switch (page) {
      case 'shelf':      return <ShelfPage onRead={setReadingBook} onNavigate={navigate} isMobile={isMobile} />
      case 'search':     return <SearchPage onRead={setReadingBook} onNavigate={navigate} />
      case 'upload':     return <UploadPage onRead={setReadingBook} />
      case 'notes':      return <NotesPage />
      case 'progress':   return <ProgressPage />
      case 'haven':      return <HavenPage />
      default:           return <ShelfPage onRead={setReadingBook} onNavigate={navigate} isMobile={isMobile} />
    }
  }

  return (
    <div className="app-shell">
      <GlitterBackground />
      {!readingBook && <PomodoroFloat />}
      {readingBook && (
        isPdfBook(readingBook)
          ? <PdfReader book={readingBook} onClose={() => setReadingBook(null)} />
          : <EpubReader book={readingBook} onClose={() => setReadingBook(null)} />
      )}

      {/* Sidebar + backdrop */}
      <Sidebar
        activePage={page}
        onNavigate={navigate}
        isMobile={isMobile}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onToggle={() => setSidebarOpen(o => !o)}
      />

      {/* Touch-blocking backdrop — sits ABOVE main content, below sidebar */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 98,        // sidebar is 100, this is 98
            touchAction: 'none',
            WebkitOverflowScrolling: 'unset',
          }}
        />
      )}

      <main
        className="main-content"
        style={sidebarOpen
          ? { pointerEvents: 'none', userSelect: 'none' }
          : undefined
        }
      >
        {renderPage()}
      </main>

      {isMobile && (
        <nav className="bottom-nav">
          {MOBILE_TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={page === id ? 'active' : ''} onClick={() => navigate(id)}>
              <span className="bn-icon"><Icon size={18} /></span>
              {label}
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}

export default function App() {
  const [unlocked, setUnlocked] = useState(
    () => localStorage.getItem(ACCESS_CODE_KEY) === 'true'
  )

  // Nothing to load before the login screen, so let the splash go
  useEffect(() => {
    if (!unlocked) window.__grnSplashDone?.()
  }, [unlocked])

  if (!unlocked) {
    return (
      <ToastProvider>
        <AccessGate onUnlock={() => setUnlocked(true)} />
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
      <ThemeProvider>
        <BooksProvider userId={null}>
          <AppThemeProvider>
            <PomodoroProvider>
              <AppShell />
            </PomodoroProvider>
          </AppThemeProvider>
        </BooksProvider>
      </ThemeProvider>
    </ToastProvider>
  )
}




