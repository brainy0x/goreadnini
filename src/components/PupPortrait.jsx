import { useEffect, useState } from 'react'
import Anabelle from './Anabelle'

// Anabelle's face as a small 3D picture. Until it is ready (or if 3D isn't available) the flat drawing shows.
export default function PupPortrait({ mood = 'idle', size = 46 }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    let alive = true
    import('../lib/pupPortrait')
      .then((m) => { const picture = m.renderPortrait(mood); if (alive) setUrl(picture) })
      .catch(() => { /* no 3D here: keep the drawing */ })
    return () => { alive = false }
  }, [mood])

  if (!url) return <Anabelle mood={mood} size={size} variant="face" />
  return <img className="pup-portrait" src={url} width={size} height={size} alt="Anabelle" draggable={false} />
}
