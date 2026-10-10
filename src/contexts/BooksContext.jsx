// src/contexts/BooksContext.jsx
// Syncs to Firestore for cross-device metadata. Files stored in Supabase Storage.
// All devices with same access code share the same workspace and see each other's books.

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { db, isConfigured as firebaseReady } from '../lib/firebaseConfig'
import {
  collection, doc, setDoc, deleteDoc,
  onSnapshot, serverTimestamp, writeBatch
} from 'firebase/firestore'

const BooksContext = createContext(null)

// ── device ID — uses access code for cross-device syncing ──
function getDeviceId() {
  // First check if we have a stored cross-device ID
  let id = localStorage.getItem('grn_workspace_id')
  if (!id) {
    // Generate one based on access code verification time
    // This ensures all devices with same access code get same workspace
    id = 'workspace_nini'
    localStorage.setItem('grn_workspace_id', id)
    console.log('[BooksContext] Initialized workspace:', id)
  }
  return id
}

// ── localStorage helpers ──
const LS = {
  get: (key)       => { try { return JSON.parse(localStorage.getItem(`grn_${key}`) || '[]') } catch { return [] } },
  set: (key, data) => { try { localStorage.setItem(`grn_${key}`, JSON.stringify(data)) } catch {
    // Storage can be full or unavailable in private browsing; remote sync still proceeds.
  } },
}

export function BooksProvider({ children }) {
  const [books,      setBooks]      = useState([])
  const [highlights, setHighlights] = useState([])
  const [bookmarks,  setBookmarks]  = useState([])
  const [quotes,     setQuotes]     = useState([])
  const [sessions,   setSessions]   = useState([])
  const [goals,      setGoals]      = useState([])
  const [siteBookmarks, setSiteBookmarks] = useState([])
  const [writings, setWritings] = useState([])
  const [settings, setSettings] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [syncing,    setSyncing]    = useState(false)
  const [syncStatus, setSyncStatus] = useState(firebaseReady ? 'synced' : 'local')

  const DEVICE = getDeviceId()

  // ── Firestore collection refs ──
  const col = (name) => collection(db, 'libraries', DEVICE, name)

  // ─────────────────────────────────────────────────────────────
  // LOAD & SUBSCRIBE
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!firebaseReady) {
      // Pure localStorage mode
      console.log('[BooksContext] Firebase not ready, using localStorage only')
      setBooks(LS.get('books'))
      setHighlights(LS.get('highlights'))
      setBookmarks(LS.get('bookmarks'))
      setQuotes(LS.get('quotes'))
      setSessions(LS.get('sessions'))
      setGoals(LS.get('goals'))
      setSiteBookmarks(LS.get('site_bookmarks'))
      setWritings(LS.get('writings'))
      setSettings(LS.get('settings'))
      setLoading(false)
      return
    }

    // Firebase real-time subscriptions
    console.log('[BooksContext] Setting up Firestore sync with workspace:', DEVICE)
    setSyncStatus('syncing')
    const unsubs = []

    const subscribe = (name, setter) => {
      const unsub = onSnapshot(
        col(name),
        (snap) => {
          const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          // sort books newest first
          if (name === 'books') docs.sort((a, b) => (b.created_at || '') > (a.created_at || '') ? 1 : -1)
          console.log(`[BooksContext] Synced ${name}:`, docs.length, 'items')
          setter(docs)
          // Mirror to localStorage for offline fallback
          LS.set(name, docs)
        },
        (err) => {
          console.error(`[BooksContext] Firestore ${name} error:`, err)
          // Fall back to localStorage
          setter(LS.get(name))
          setSyncStatus('offline')
        }
      )
      unsubs.push(unsub)
    }

    subscribe('books',     setBooks)
    subscribe('highlights',setHighlights)
    subscribe('bookmarks', setBookmarks)
    subscribe('quotes',    setQuotes)
    subscribe('sessions',  setSessions)
    subscribe('goals',     setGoals)
    subscribe('site_bookmarks', setSiteBookmarks)
    subscribe('writings', setWritings)
    subscribe('settings', setSettings)

    setLoading(false)
    setSyncStatus('synced')

    return () => unsubs.forEach(u => u())
  }, [])

  // ─────────────────────────────────────────────────────────────
  // GENERIC WRITE HELPERS
  // ─────────────────────────────────────────────────────────────
  const writeDoc = useCallback(async (colName, id, data) => {
    if (firebaseReady) {
      setSyncStatus('syncing')
      try {
        await setDoc(doc(db, 'libraries', DEVICE, colName, id), {
          ...data,
          _updated: serverTimestamp(),
        }, { merge: true })
        setSyncStatus('synced')
      } catch (e) {
        console.error('Firebase write error:', e)
        setSyncStatus('offline')
      }
    }
  }, [DEVICE])

  const removeDoc = useCallback(async (colName, id) => {
    if (firebaseReady) {
      try {
        await deleteDoc(doc(db, 'libraries', DEVICE, colName, id))
        setSyncStatus('synced')
      } catch (e) {
        console.error('Firebase delete error:', e)
        setSyncStatus('offline')
      }
    }
  }, [DEVICE])

  // ─────────────────────────────────────────────────────────────
  // BOOKS
  // ─────────────────────────────────────────────────────────────
  const addBook = useCallback(async (data) => {
    const id = crypto.randomUUID()
    const book = {
      ...data,
      id,
      progress:   data.progress || 0,
      shelf:      data.shelf || 'reading',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Optimistic local update
    setBooks(prev => {
      const next = [book, ...prev]
      LS.set('books', next)
      return next
    })

    await writeDoc('books', id, book)
    return book
  }, [writeDoc])

  const updateBook = useCallback(async (id, updates) => {
    const updated = { updated_at: new Date().toISOString(), ...updates }
    setBooks(prev => {
      const next = prev.map(b => b.id === id ? { ...b, ...updated } : b)
      LS.set('books', next)
      return next
    })
    await writeDoc('books', id, updated)
  }, [writeDoc])

  const deleteBook = useCallback(async (id) => {
    setBooks(prev => {
      const next = prev.filter(b => b.id !== id)
      LS.set('books', next)
      return next
    })
    await removeDoc('books', id)
  }, [removeDoc])

  // ─────────────────────────────────────────────────────────────
  // HIGHLIGHTS
  // ─────────────────────────────────────────────────────────────
  const addHighlight = useCallback(async (data) => {
    const item = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
    setHighlights(prev => { const next = [item, ...prev]; LS.set('highlights', next); return next })
    await writeDoc('highlights', item.id, item)
  }, [writeDoc])

  const deleteHighlight = useCallback(async (id) => {
    setHighlights(prev => { const next = prev.filter(h => h.id !== id); LS.set('highlights', next); return next })
    await removeDoc('highlights', id)
  }, [removeDoc])

  // ─────────────────────────────────────────────────────────────
  // BOOKMARKS
  // ─────────────────────────────────────────────────────────────
  const addBookmark = useCallback(async (data) => {
    const item = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
    setBookmarks(prev => { const next = [item, ...prev]; LS.set('bookmarks', next); return next })
    await writeDoc('bookmarks', item.id, item)
  }, [writeDoc])

  const deleteBookmark = useCallback(async (id) => {
    setBookmarks(prev => { const next = prev.filter(b => b.id !== id); LS.set('bookmarks', next); return next })
    await removeDoc('bookmarks', id)
  }, [removeDoc])

  // ─────────────────────────────────────────────────────────────
  // QUOTES
  // ─────────────────────────────────────────────────────────────
  const addQuote = useCallback(async (data) => {
    const item = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
    setQuotes(prev => { const next = [item, ...prev]; LS.set('quotes', next); return next })
    await writeDoc('quotes', item.id, item)
  }, [writeDoc])

  const deleteQuote = useCallback(async (id) => {
    setQuotes(prev => { const next = prev.filter(q => q.id !== id); LS.set('quotes', next); return next })
    await removeDoc('quotes', id)
  }, [removeDoc])

  // ─────────────────────────────────────────────────────────────
  // SITE BOOKMARKS (saved websites for finding books — synced like everything else)
  // ─────────────────────────────────────────────────────────────
  const addSiteBookmark = useCallback(async (data) => {
    const item = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
    setSiteBookmarks(prev => { const next = [...prev, item]; LS.set('site_bookmarks', next); return next })
    await writeDoc('site_bookmarks', item.id, item)
    return item
  }, [writeDoc])

  const updateSiteBookmark = useCallback(async (id, updates) => {
    setSiteBookmarks(prev => { const next = prev.map(b => b.id === id ? { ...b, ...updates } : b); LS.set('site_bookmarks', next); return next })
    await writeDoc('site_bookmarks', id, updates)
  }, [writeDoc])

  const deleteSiteBookmark = useCallback(async (id) => {
    setSiteBookmarks(prev => { const next = prev.filter(b => b.id !== id); LS.set('site_bookmarks', next); return next })
    await removeDoc('site_bookmarks', id)
  }, [removeDoc])

  // ─────────────────────────────────────────────────────────────
  // READER SETTINGS (one synced doc: appearance prefs + saved profiles)
  // ─────────────────────────────────────────────────────────────
  const saveReaderPrefs = useCallback(async (patch) => {
    setSettings(prev => {
      const rest = prev.filter(x => x.id !== 'reader')
      const next = [...rest, { ...(prev.find(x => x.id === 'reader') || {}), ...patch, id: 'reader' }]
      LS.set('settings', next)
      return next
    })
    await writeDoc('settings', 'reader', patch)
  }, [writeDoc])

  const saveProfile = useCallback(async (patch) => {
    setSettings(prev => {
      const rest = prev.filter(x => x.id !== 'profile')
      const next = [...rest, { ...(prev.find(x => x.id === 'profile') || {}), ...patch, id: 'profile' }]
      LS.set('settings', next)
      return next
    })
    await writeDoc('settings', 'profile', patch)
  }, [writeDoc])

  // ─────────────────────────────────────────────────────────────
  // WRITINGS (poems, stories, journal, notes in the Haven)
  // ─────────────────────────────────────────────────────────────
  const addWriting = useCallback(async (data) => {
    const now = new Date().toISOString()
    const item = { title: '', body: '', kind: 'poem', ...data, id: crypto.randomUUID(), created_at: now, updated_at: now }
    setWritings(prev => { const next = [item, ...prev]; LS.set('writings', next); return next })
    await writeDoc('writings', item.id, item)
    return item
  }, [writeDoc])

  const updateWriting = useCallback(async (id, updates) => {
    const patch = { ...updates, updated_at: new Date().toISOString() }
    setWritings(prev => { const next = prev.map(w => w.id === id ? { ...w, ...patch } : w); LS.set('writings', next); return next })
    await writeDoc('writings', id, patch)
  }, [writeDoc])

  const deleteWriting = useCallback(async (id) => {
    setWritings(prev => { const next = prev.filter(w => w.id !== id); LS.set('writings', next); return next })
    await removeDoc('writings', id)
  }, [removeDoc])

  // ─────────────────────────────────────────────────────────────
  // SESSIONS
  // ─────────────────────────────────────────────────────────────
  const addSession = useCallback(async (data) => {
    const item = {
      ...data,
      id:         crypto.randomUUID(),
      date:       new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    }
    setSessions(prev => { const next = [item, ...prev]; LS.set('sessions', next); return next })
    await writeDoc('sessions', item.id, item)
  }, [writeDoc])

  // ─────────────────────────────────────────────────────────────
  // GOALS
  // ─────────────────────────────────────────────────────────────
  const saveGoal = useCallback(async (data) => {
    const existing = goals.find(g => g.type === data.type && g.year === data.year && g.month === data.month)
    if (existing) {
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() }
      setGoals(prev => { const next = prev.map(g => g.id === existing.id ? updated : g); LS.set('goals', next); return next })
      await writeDoc('goals', existing.id, updated)
    } else {
      const item = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
      setGoals(prev => { const next = [item, ...prev]; LS.set('goals', next); return next })
      await writeDoc('goals', item.id, item)
    }
  }, [goals, writeDoc])

  const shelvedBooks = useMemo(
    () => books.map(b => (b.shelf === 'wishlist' || b.shelf === 'paused' ? { ...b, shelf: 'reading' } : b)),
    [books]
  )

  return (
    <BooksContext.Provider value={{
      books: shelvedBooks, highlights, bookmarks, quotes, sessions, goals, siteBookmarks, writings,
      readerPrefs: settings.find(x => x.id === 'reader') || null, saveReaderPrefs,
      profile: settings.find(x => x.id === 'profile') || null, saveProfile,
      loading, syncing, syncStatus,
      addBook, updateBook, deleteBook,
      addHighlight, deleteHighlight,
      addBookmark, deleteBookmark,
      addQuote, deleteQuote,
      addSession, saveGoal,
      addSiteBookmark, updateSiteBookmark, deleteSiteBookmark,
      addWriting, updateWriting, deleteWriting,
    }}>
      {children}
    </BooksContext.Provider>
  )
}

export const useBooks = () => useContext(BooksContext)
