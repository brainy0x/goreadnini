// pupStats.js — today's reading minutes and the day streak, worked out from reading sessions.
// Dates use the same format the app already saves sessions with (YYYY-MM-DD).

export const DEFAULT_DAILY_GOAL = 20

const dayKey = (date) => date.toISOString().split('T')[0]

export function readingStats(sessions = []) {
  const today = dayKey(new Date())
  const minutesToday = sessions
    .filter(s => s.date === today)
    .reduce((total, s) => total + (s.minutes || 0), 0)

  // A streak is the run of days with reading. Today doesn't break it before you've had a chance to read.
  const days = new Set(sessions.map(s => s.date))
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    if (days.has(dayKey(d))) streak += 1
    else if (i === 0) continue
    else break
  }

  return { minutesToday, streak }
}
