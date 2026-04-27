// src/contexts/BooksContext.jsx
// Syncs to Firebase Firestore when configured, falls back to localStorage.
// Files (epub/pdf) always stay in IndexedDB — they're per-device by nature.

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { db, isConfigured as firebaseReady } from '../lib/firebaseConfig'
import {
  collection, doc, setDoc, deleteDoc,
  onSnapshot, serverTimestamp, writeBatch
} from 'firebase/firestore'

const BooksContext = createContext(null)

// ── device ID — stable across sessions, identifies this browser ──
function getDeviceId() {
  let id = localStorage.getItem('grn_device_id')
  if (!id) {
    id = 'device_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem('grn_device_id', id)
  }
  return id
}

// ── localStorage helpers ──
const LS = {
  get: (key)       => { try { return JSON.parse(localStorage.getItem(`grn_${key}`) || '[]') } catch { return [] } },
  set: (key, data) => { try { localStorage.setItem(`grn_${key}`, JSON.stringify(data)) } catch {} },
}

export function BooksProvider({ children }) {
  const [books,      setBooks]      = useState([])
  const [highlights, setHighlights] = useState([])
  const [bookmarks,  setBookmarks]  = useState([])
  const [quotes,     setQuotes]     = useState([])
  const [sessions,   setSessions]   = useState([])
  const [goals,      setGoals]      = useState([])
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
      setBooks(LS.get('books'))
      setHighlights(LS.get('highlights'))
      setBookmarks(LS.get('bookmarks'))
      setQuotes(LS.get('quotes'))
      setSessions(LS.get('sessions'))
      setGoals(LS.get('goals'))
      setLoading(false)
      return
    }

    // Firebase real-time subscriptions
    setSyncStatus('syncing')
    const unsubs = []

    const subscribe = (name, setter) => {
      const unsub = onSnapshot(
        col(name),
        (snap) => {
          const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          // sort books newest first
          if (name === 'books') docs.sort((a, b) => (b.created_at || '') > (a.created_at || '') ? 1 : -1)
          setter(docs)
          // Mirror to localStorage for offline fallback
          LS.set(name, docs)
        },
        (err) => {
          console.error(`Firebase ${name} error:`, err)
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
    const updated = { ...updates, updated_at: new Date().toISOString() }
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

  return (
    <BooksContext.Provider value={{
      books, highlights, bookmarks, quotes, sessions, goals,
      loading, syncing, syncStatus,
      addBook, updateBook, deleteBook,
      addHighlight, deleteHighlight,
      addBookmark, deleteBookmark,
      addQuote, deleteQuote,
      addSession, saveGoal,
    }}>
      {children}
    </BooksContext.Provider>
  )
}

export const useBooks = () => useContext(BooksContext)
