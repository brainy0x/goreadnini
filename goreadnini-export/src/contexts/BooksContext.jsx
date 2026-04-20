import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const BooksContext = createContext(null)

export function BooksProvider({ children, userId }) {
  const [books, setBooks] = useState([])
  const [highlights, setHighlights] = useState([])
  const [bookmarks, setBookmarks] = useState([])
  const [quotes, setQuotes] = useState([])
  const [sessions, setSessions] = useState([])
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)

  // Use localStorage as fallback when Supabase not configured
  const isSupabaseConfigured = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  )

  const loadFromLocal = () => {
    try {
      return {
        books: JSON.parse(localStorage.getItem('grn_books') || '[]'),
        highlights: JSON.parse(localStorage.getItem('grn_highlights') || '[]'),
        bookmarks: JSON.parse(localStorage.getItem('grn_bookmarks') || '[]'),
        quotes: JSON.parse(localStorage.getItem('grn_quotes') || '[]'),
        sessions: JSON.parse(localStorage.getItem('grn_sessions') || '[]'),
        goals: JSON.parse(localStorage.getItem('grn_goals') || '[]'),
      }
    } catch { return { books: [], highlights: [], bookmarks: [], quotes: [], sessions: [], goals: [] } }
  }

  const saveLocal = (key, data) => {
    localStorage.setItem(`grn_${key}`, JSON.stringify(data))
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      if (isSupabaseConfigured && userId) {
        const [b, h, bm, q, s, g] = await Promise.all([
          supabase.from('books').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
          supabase.from('highlights').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
          supabase.from('bookmarks').select('*').eq('user_id', userId),
          supabase.from('quotes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
          supabase.from('reading_sessions').select('*').eq('user_id', userId),
          supabase.from('reading_goals').select('*').eq('user_id', userId),
        ])
        setBooks(b.data || [])
        setHighlights(h.data || [])
        setBookmarks(bm.data || [])
        setQuotes(q.data || [])
        setSessions(s.data || [])
        setGoals(g.data || [])
      } else {
        const local = loadFromLocal()
        setBooks(local.books)
        setHighlights(local.highlights)
        setBookmarks(local.bookmarks)
        setQuotes(local.quotes)
        setSessions(local.sessions)
        setGoals(local.goals)
      }
      setLoading(false)
    }
    load()
  }, [userId, isSupabaseConfigured])

  // ── BOOKS ──
  const addBook = useCallback(async (bookData) => {
    const newBook = { ...bookData, id: crypto.randomUUID(), user_id: userId, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), progress: 0, shelf: bookData.shelf || 'reading' }
    if (isSupabaseConfigured && userId) {
      const { data, error } = await supabase.from('books').insert([{ ...newBook }]).select().single()
      if (!error) { setBooks(prev => [data, ...prev]); return data }
    }
    const updated = [newBook, ...books]
    setBooks(updated); saveLocal('books', updated)
    return newBook
  }, [books, userId, isSupabaseConfigured])

  const updateBook = useCallback(async (id, updates) => {
    const updated = { ...updates, updated_at: new Date().toISOString() }
    if (isSupabaseConfigured && userId) {
      await supabase.from('books').update(updated).eq('id', id)
    }
    setBooks(prev => {
      const next = prev.map(b => b.id === id ? { ...b, ...updated } : b)
      if (!isSupabaseConfigured) saveLocal('books', next)
      return next
    })
  }, [userId, isSupabaseConfigured])

  const deleteBook = useCallback(async (id) => {
    if (isSupabaseConfigured && userId) {
      await supabase.from('books').delete().eq('id', id)
    }
    setBooks(prev => {
      const next = prev.filter(b => b.id !== id)
      if (!isSupabaseConfigured) saveLocal('books', next)
      return next
    })
  }, [userId, isSupabaseConfigured])

  // ── HIGHLIGHTS ──
  const addHighlight = useCallback(async (data) => {
    const item = { ...data, id: crypto.randomUUID(), user_id: userId, created_at: new Date().toISOString() }
    if (isSupabaseConfigured && userId) {
      await supabase.from('highlights').insert([item])
    }
    setHighlights(prev => {
      const next = [item, ...prev]
      if (!isSupabaseConfigured) saveLocal('highlights', next)
      return next
    })
  }, [userId, isSupabaseConfigured])

  const deleteHighlight = useCallback(async (id) => {
    if (isSupabaseConfigured && userId) await supabase.from('highlights').delete().eq('id', id)
    setHighlights(prev => { const next = prev.filter(h => h.id !== id); if (!isSupabaseConfigured) saveLocal('highlights', next); return next })
  }, [userId, isSupabaseConfigured])

  // ── BOOKMARKS ──
  const addBookmark = useCallback(async (data) => {
    const item = { ...data, id: crypto.randomUUID(), user_id: userId, created_at: new Date().toISOString() }
    if (isSupabaseConfigured && userId) await supabase.from('bookmarks').insert([item])
    setBookmarks(prev => { const next = [item, ...prev]; if (!isSupabaseConfigured) saveLocal('bookmarks', next); return next })
  }, [userId, isSupabaseConfigured])

  const deleteBookmark = useCallback(async (id) => {
    if (isSupabaseConfigured && userId) await supabase.from('bookmarks').delete().eq('id', id)
    setBookmarks(prev => { const next = prev.filter(b => b.id !== id); if (!isSupabaseConfigured) saveLocal('bookmarks', next); return next })
  }, [userId, isSupabaseConfigured])

  // ── QUOTES ──
  const addQuote = useCallback(async (data) => {
    const item = { ...data, id: crypto.randomUUID(), user_id: userId, created_at: new Date().toISOString() }
    if (isSupabaseConfigured && userId) await supabase.from('quotes').insert([item])
    setQuotes(prev => { const next = [item, ...prev]; if (!isSupabaseConfigured) saveLocal('quotes', next); return next })
  }, [userId, isSupabaseConfigured])

  const deleteQuote = useCallback(async (id) => {
    if (isSupabaseConfigured && userId) await supabase.from('quotes').delete().eq('id', id)
    setQuotes(prev => { const next = prev.filter(q => q.id !== id); if (!isSupabaseConfigured) saveLocal('quotes', next); return next })
  }, [userId, isSupabaseConfigured])

  // ── SESSIONS ──
  const addSession = useCallback(async (data) => {
    const item = { ...data, id: crypto.randomUUID(), user_id: userId, date: new Date().toISOString().split('T')[0], created_at: new Date().toISOString() }
    if (isSupabaseConfigured && userId) await supabase.from('reading_sessions').insert([item])
    setSessions(prev => { const next = [item, ...prev]; if (!isSupabaseConfigured) saveLocal('sessions', next); return next })
  }, [userId, isSupabaseConfigured])

  // ── GOALS ──
  const saveGoal = useCallback(async (data) => {
    const existing = goals.find(g => g.type === data.type && g.year === data.year && g.month === data.month)
    if (existing) {
      if (isSupabaseConfigured && userId) await supabase.from('reading_goals').update(data).eq('id', existing.id)
      setGoals(prev => { const next = prev.map(g => g.id === existing.id ? { ...g, ...data } : g); if (!isSupabaseConfigured) saveLocal('goals', next); return next })
    } else {
      const item = { ...data, id: crypto.randomUUID(), user_id: userId, created_at: new Date().toISOString() }
      if (isSupabaseConfigured && userId) await supabase.from('reading_goals').insert([item])
      setGoals(prev => { const next = [item, ...prev]; if (!isSupabaseConfigured) saveLocal('goals', next); return next })
    }
  }, [goals, userId, isSupabaseConfigured])

  return (
    <BooksContext.Provider value={{
      books, highlights, bookmarks, quotes, sessions, goals, loading,
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
