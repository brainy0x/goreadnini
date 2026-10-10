import { useEffect, useState } from 'react'
import PupView from './PupView'
import { celebrationLine } from '../lib/pupLines'

const CONFETTI = ['💜', '✨', '🐾', '📚']

// Anabelle cheers when a book is finished. Anything can trigger it:
//   window.dispatchEvent(new CustomEvent('grn:celebrate', { detail: { title: 'Book title' } }))
export default function Celebration() {
  const [cele, setCele] = useState(null)

  useEffect(() => {
    const onCelebrate = (e) => setCele({ title: e.detail?.title || '', line: celebrationLine() })
    window.addEventListener('grn:celebrate', onCelebrate)
    return () => window.removeEventListener('grn:celebrate', onCelebrate)
  }, [])

  useEffect(() => {
    if (!cele) return undefined
    const id = setTimeout(() => setCele(null), 6500)
    return () => clearTimeout(id)
  }, [cele])

  if (!cele) return null

  return (
    <div className="cele" role="status">
      <div className="cele-confetti" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 5.7 + 3) % 100}%`, animationDelay: `${(i % 9) * 0.14}s`, animationDuration: `${2.4 + (i % 5) * 0.3}s` }}>
            {CONFETTI[i % CONFETTI.length]}
          </i>
        ))}
      </div>
      <div className="cele-card" onClick={() => setCele(null)}>
        <PupView mood="cheer" size={120} />
        <div className="cele-text">
          <strong>{cele.title ? `You finished “${cele.title}”!` : 'You finished it!'}</strong>
          <span>{cele.line}</span>
        </div>
      </div>
    </div>
  )
}
