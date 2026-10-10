import { useEffect, useRef, useState } from 'react'
import { Delete } from 'lucide-react'

const DEFAULT_LENGTH = 6
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back']

// A 6-digit keypad. It calls onComplete(pin) once six digits are in; the parent changes `resetSignal` to clear it.
export default function PinPad({ icon, title, hint, error, resetSignal, disabled, length = DEFAULT_LENGTH, onComplete, children, onTitleClick }) {
  const [digits, setDigits] = useState([])
  const fired = useRef(false)
  const completeRef = useRef(onComplete)

  useEffect(() => { completeRef.current = onComplete })

  useEffect(() => {
    fired.current = false
    setDigits([])
  }, [resetSignal])

  useEffect(() => {
    if (digits.length !== length || fired.current) return undefined
    fired.current = true
    const id = setTimeout(() => completeRef.current(digits.join('')), 140)
    return () => clearTimeout(id)
  }, [digits, length])

  const add = (d) => setDigits(prev => (prev.length >= length || disabled ? prev : [...prev, d]))
  const remove = () => setDigits(prev => prev.slice(0, -1))

  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return
      if (/^[0-9]$/.test(e.key)) add(e.key)
      else if (e.key === 'Backspace') remove()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="hv-pin">
      {icon && <div className="hv-pin-icon">{icon}</div>}
      <h2 onClick={onTitleClick}>{title}</h2>
      {hint && <p className="hv-pin-hint">{hint}</p>}

      <div className={`hv-dots ${error ? 'shake' : ''}`} key={error || 'ok'}>
        {Array.from({ length }, (_, i) => <i key={i} className={i < digits.length ? 'on' : ''} />)}
      </div>
      <p className="hv-pin-error" role="alert">{error || ' '}</p>

      <div className="hv-keys">
        {KEYS.map((k, i) => (
          k === '' ? <span key={i} /> : (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => (k === 'back' ? remove() : add(k))}
              aria-label={k === 'back' ? 'Delete' : k}
            >
              {k === 'back' ? <Delete size={20} /> : k}
            </button>
          )
        ))}
      </div>
      {children}
    </div>
  )
}
