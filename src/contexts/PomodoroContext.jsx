// PomodoroContext.jsx — a study timer that works across the whole app (so it keeps going when you
// close the reader). Focus, short break, long break; breaks start by themselves, focus waits for you.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useBooks } from './BooksContext'
import { useToast } from './ToastContext'

const DEFAULT_PREFS = { focus: 25, short: 5, long: 15, every: 4 }
const LABELS = { focus: 'Focus', short: 'Short break', long: 'Long break' }

const PomodoroContext = createContext(null)

const phaseTotal = (phase, prefs) => (phase === 'focus' ? prefs.focus : phase === 'long' ? prefs.long : prefs.short) * 60000

const dayKey = () => new Date().toISOString().split('T')[0]

function readLocalPrefs() {
  try { return JSON.parse(localStorage.getItem('grn_pomo_prefs') || '{}') } catch { return {} }
}

// A soft double beep (works after you have tapped start once on the page)
function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ;[0, 0.24].forEach((delay, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = i ? 880 : 660
      const t = ctx.currentTime + delay
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.24)
    })
    setTimeout(() => ctx.close(), 900)
  } catch { /* sound is optional */ }
}

const pad = (n) => String(n).padStart(2, '0')

export function PomodoroProvider({ children }) {
  const { profile, saveProfile } = useBooks()
  const toast = useToast()

  const [prefs, setPrefsState] = useState(() => ({ ...DEFAULT_PREFS, ...readLocalPrefs() }))
  const [phase, setPhase] = useState('focus')
  const [running, setRunning] = useState(false)
  const [remainingMs, setRemainingMs] = useState(() => phaseTotal('focus', DEFAULT_PREFS))   // while paused
  const [endAt, setEndAt] = useState(0)                                          // while running
  const [now, setNow] = useState(0)
  const [cycle, setCycle] = useState(0)

  // the newest values, for the timer callback
  const latest = useRef({})
  useEffect(() => {
    latest.current = { phase, cycle, prefs, profile, saveProfile, toast }
  })

  // pick up durations saved on another device
  const remotePrefs = profile?.pomodoroPrefs
  useEffect(() => {
    if (remotePrefs) setPrefsState(prev => ({ ...prev, ...remotePrefs }))
  }, [remotePrefs])

  const remaining = running ? Math.max(0, endAt - now) : remainingMs

  // one tick every quarter second while running
  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [running])

  const beginPhase = useCallback((nextPhase, pr, autoStart) => {
    setPhase(nextPhase)
    const ms = phaseTotal(nextPhase, pr)
    if (autoStart) {
      const t = Date.now()
      setNow(t)
      setEndAt(t + ms)
      setRunning(true)
    } else {
      setRunning(false)
      setRemainingMs(ms)
    }
  }, [])

  const complete = useCallback(() => {
    const { phase: p, cycle: c, prefs: pr, profile: prof, saveProfile: save, toast: say } = latest.current
    beep()
    try { navigator.vibrate?.([220, 110, 220]) } catch { /* not supported */ }

    if (p === 'focus') {
      const counts = { ...(prof?.pomodoros || {}) }
      const day = dayKey()
      counts[day] = (counts[day] || 0) + 1
      save({ pomodoros: counts })
      const nextCycle = c + 1
      const long = nextCycle % pr.every === 0
      setCycle(nextCycle)
      beginPhase(long ? 'long' : 'short', pr, true)
      say(long ? 'Great work! Time for a long break ☕' : 'Focus session done. Take a short break ☕', 'success')
    } else {
      beginPhase('focus', pr, false)
      say('Break over. Ready for the next focus?', 'success')
    }
  }, [beginPhase])

  // time is up
  useEffect(() => {
    if (running && endAt && now >= endAt) complete()
  }, [now, running, endAt, complete])

  const start = useCallback(() => {
    const t = Date.now()
    setNow(t)
    setEndAt(t + remainingMs)
    setRunning(true)
  }, [remainingMs])

  const pause = useCallback(() => {
    setRemainingMs(Math.max(0, endAt - Date.now()))
    setRunning(false)
  }, [endAt])

  const toggle = useCallback(() => (running ? pause() : start()), [running, pause, start])

  // skip: focus -> the break, break -> focus (a skipped focus session isn't counted)
  const skip = useCallback(() => {
    const { phase: p, cycle: c, prefs: pr } = latest.current
    if (p === 'focus') {
      const nextCycle = c + 1
      setCycle(nextCycle)
      beginPhase(nextCycle % pr.every === 0 ? 'long' : 'short', pr, true)
    } else {
      beginPhase('focus', pr, false)
    }
  }, [beginPhase])

  const reset = useCallback(() => {
    setCycle(0)
    beginPhase('focus', latest.current.prefs, false)
  }, [beginPhase])

  const setPrefs = useCallback((patch) => {
    const next = { ...latest.current.prefs, ...patch }
    setPrefsState(next)
    try { localStorage.setItem('grn_pomo_prefs', JSON.stringify(next)) } catch { /* storage full */ }
    latest.current.saveProfile({ pomodoroPrefs: next })
    if (!running) setRemainingMs(phaseTotal(latest.current.phase, next))
  }, [running])

  const total = phaseTotal(phase, prefs)
  const seconds = Math.ceil(remaining / 1000)
  const clock = `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`
  const active = running || remaining !== total
  const todayCount = profile?.pomodoros?.[new Date().toISOString().split('T')[0]] || 0

  const value = useMemo(() => ({
    prefs, setPrefs, phase, running, active, cycle, clock, todayCount,
    label: LABELS[phase],
    mini: `${LABELS[phase]} ${clock}`,
    progress: total ? 1 - remaining / total : 0,
    start, pause, toggle, skip, reset,
  }), [prefs, setPrefs, phase, running, active, cycle, clock, todayCount, total, remaining, start, pause, toggle, skip, reset])

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>
}

export const usePomodoro = () => useContext(PomodoroContext)
