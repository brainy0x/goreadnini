import { useState } from 'react'
import { Timer, Play, Pause, SkipForward, RotateCcw, Minus, Plus } from 'lucide-react'
import { usePomodoro } from '../contexts/PomodoroContext'

function Stepper({ label, value, min, max, onChange }) {
  return (
    <div className="pomo-step">
      <span>{label}</span>
      <div>
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label={`Less ${label}`}><Minus size={13} /></button>
        <strong>{value} min</strong>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label={`More ${label}`}><Plus size={13} /></button>
      </div>
    </div>
  )
}

export function PomodoroPanel({ onClose }) {
  const p = usePomodoro()
  const isBreak = p.phase !== 'focus'

  return (
    <>
      <div className="pomo-scrim" onClick={onClose} />
      <div className={`pomo-panel ${isBreak ? 'break' : ''}`} role="dialog" aria-label="Study timer">
        <div className="pomo-phase">{p.label}</div>
        <div className="pomo-clock">{p.clock}</div>
        <div className="pomo-bar"><div style={{ width: `${Math.round(p.progress * 100)}%` }} /></div>
        <div className="pomo-dots" aria-label={`${p.cycle % p.prefs.every} of ${p.prefs.every} focus sessions before the long break`}>
          {Array.from({ length: p.prefs.every }, (_, i) => <i key={i} className={i < p.cycle % p.prefs.every ? 'on' : ''} />)}
        </div>

        <div className="pomo-actions">
          <button type="button" className="pomo-main" onClick={p.toggle}>
            {p.running ? <><Pause size={16} /> Pause</> : <><Play size={16} /> {p.active ? 'Resume' : 'Start'}</>}
          </button>
          <button type="button" className="pomo-ghost" onClick={p.skip} aria-label="Skip"><SkipForward size={16} /></button>
          <button type="button" className="pomo-ghost" onClick={p.reset} aria-label="Reset"><RotateCcw size={16} /></button>
        </div>

        <div className="pomo-settings">
          <Stepper label="Focus" value={p.prefs.focus} min={5} max={90} onChange={v => p.setPrefs({ focus: v })} />
          <Stepper label="Short break" value={p.prefs.short} min={1} max={30} onChange={v => p.setPrefs({ short: v })} />
          <Stepper label="Long break" value={p.prefs.long} min={5} max={60} onChange={v => p.setPrefs({ long: v })} />
        </div>
        <div className="pomo-today">{p.todayCount} focus {p.todayCount === 1 ? 'session' : 'sessions'} today</div>
      </div>
    </>
  )
}

// The small timer button in a reader's top bar
export default function PomodoroChip() {
  const p = usePomodoro()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={`pomo-chip ${p.phase !== 'focus' ? 'break' : ''} ${p.running ? 'running' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={`Study timer, ${p.label} ${p.clock}`}
      >
        <Timer size={15} />
        <span>{p.clock}</span>
      </button>
      {open && <PomodoroPanel onClose={() => setOpen(false)} />}
    </>
  )
}
