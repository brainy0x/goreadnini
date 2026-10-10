import { useState } from 'react'
import { Timer } from 'lucide-react'
import { usePomodoro } from '../contexts/PomodoroContext'
import { PomodoroPanel } from './PomodoroChip'

// While a study timer is going and no reader is open, a small pill keeps it in view.
export default function PomodoroFloat() {
  const p = usePomodoro()
  const [open, setOpen] = useState(false)
  if (!p.active) return null

  return (
    <>
      <button
        type="button"
        className={`pomo-float ${p.phase !== 'focus' ? 'break' : ''} ${p.running ? 'running' : ''}`}
        onClick={() => setOpen(true)}
        aria-label={`Study timer, ${p.label} ${p.clock}`}
      >
        <Timer size={16} />
        <span>{p.label}</span>
        <strong>{p.clock}</strong>
      </button>
      {open && <PomodoroPanel onClose={() => setOpen(false)} />}
    </>
  )
}
