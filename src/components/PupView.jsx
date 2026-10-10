import { lazy, Suspense } from 'react'
import Anabelle from './Anabelle'

const Anabelle3D = lazy(() => import('./Anabelle3D'))

// Anabelle in 3D (loaded only when needed). While it loads, or if the device can't do 3D, the drawing shows.
export default function PupView({ mood = 'idle', size = 150 }) {
  const drawing = <Anabelle mood={mood} size={size} />
  return (
    <Suspense fallback={drawing}>
      <Anabelle3D mood={mood} size={size} fallback={drawing} />
    </Suspense>
  )
}
