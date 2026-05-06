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
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isMobile, sidebarOpen])

  const navigate = (p) => {
    setPage(p)
    setSidebarOpen(false)
  }

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
      {readingBook && (
        <EpubReader book={readingBook} onClose={() => setReadingBook(null)} />
      )}

      {/* Sidebar + backdrop */}
      <Sidebar
        activePage={page}
        onNavigate={navigate}
        isMobile={isMobile}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Touch-blocking backdrop — sits ABOVE main content, below sidebar */}
      {isMobile && sidebarOpen && (
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
        style={isMobile && sidebarOpen
          ? { pointerEvents: 'none', userSelect: 'none' }
          : undefined
        }
      >
        {/* Mobile top bar */}
        {isMobile && (
          <div style={{
            padding: '0.7rem 1rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-panel)',
            position: 'sticky',
            top: 0,
            zIndex: 50,
          }}>
            <span style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '1rem',
              color: 'var(--gold-light)',
              letterSpacing: '0.06em',
            }}>
              📚 GoreadNini
            </span>
            <button
              onClick={() => setSidebarOpen(o => !o)}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 6,
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                padding: '0.35rem 0.45rem',
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="Toggle menu"
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        )}

        {renderPage()}
      </main>
    </div>
  )
}

export default function App() {
  const [unlocked, setUnlocked] = useState(
    () => localStorage.getItem(ACCESS_CODE_KEY) === 'true'
  )

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



import { db } from './lib/firebaseConfig'
import { collection, addDoc } from 'firebase/firestore'

// Simple test function
async function testFirebase() {
  try {
    const docRef = await addDoc(collection(db, "test_connection"), {
      status: "It works!",
      time: new Date()
    });
    console.log("Document written with ID: ", docRef.id);
    alert("Firebase is working! Check your Firestore dashboard.");
  } catch (e) {
    console.error("Error adding document: ", e);
  }
}

// Run it
if (db) {
  testFirebase();
}

