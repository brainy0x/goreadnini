import { useMemo, useState } from 'react'
import { Minus, Plus, Flame } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import PupView from './PupView'
import { readingStats, DEFAULT_DAILY_GOAL } from '../lib/pupStats'
import { pupLine } from '../lib/pupLines'

const RADIUS = 26
const CIRC = 2 * Math.PI * RADIUS

// Anabelle, what she is saying, today's reading, the streak, and the daily goal.
export default function AnabelleStatus({ studying = false, compact = false }) {
  const { sessions, profile, saveProfile } = useBooks()
  const goal = profile?.dailyGoal || DEFAULT_DAILY_GOAL
  const { minutesToday, streak } = useMemo(() => readingStats(sessions), [sessions])
  const reached = minutesToday >= goal
  const mood = reached ? 'cheer' : studying ? 'studying' : minutesToday > 0 ? 'reading' : 'idle'

  // she says one thing each time this opens
  const [line] = useState(() => pupLine({ reachedGoal: reached, studying, minutesToday }))

  const fill = Math.min(1, minutesToday / goal)
  const changeGoal = (delta) => saveProfile({ dailyGoal: Math.min(240, Math.max(5, goal + delta)) })

  return (
    <div className={`pup-card ${compact ? 'compact' : ''}`}>
      <div className="pup-top">
        <PupView mood={mood} size={compact ? 118 : 150} />
        <div className="pup-bubble">{line}</div>
      </div>

      <div className="pup-stats">
        <div className="pup-stat">
          <div className="bk-ring pup-ring">
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r={RADIUS} className="bk-ring-bg" />
              <circle
                cx="32" cy="32" r={RADIUS} className="bk-ring-fg"
                strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - fill)}
                transform="rotate(-90 32 32)"
              />
            </svg>
            <span>{minutesToday}</span>
          </div>
          <small>of {goal} min today</small>
        </div>

        <div className="pup-stat">
          <strong className="pup-streak"><Flame size={20} /> {streak}</strong>
          <small>{streak === 1 ? 'day' : 'days'} in a row</small>
        </div>
      </div>

      <div className="pup-goal">
        <span>Daily goal</span>
        <div className="pup-stepper">
          <button type="button" onClick={() => changeGoal(-5)} aria-label="Lower the goal"><Minus size={14} /></button>
          <strong>{goal} min</strong>
          <button type="button" onClick={() => changeGoal(5)} aria-label="Raise the goal"><Plus size={14} /></button>
        </div>
      </div>
    </div>
  )
}
