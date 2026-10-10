import { useEffect, useRef, useState } from 'react'

// One PDF page. It only draws itself while it is near the screen, and frees its memory when it isn't,
// so a 500-page book costs about as much as a handful of pages.
export default function PdfPage({ pdfjs, doc, num, scale, width, height, root, filter }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const textRef = useRef(null)
  const [near, setNear] = useState(false)

  // Is this page close to the visible area?
  useEffect(() => {
    const el = wrapRef.current
    if (!el || !root) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      { root, rootMargin: '1200px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [root])

  // Draw (or free) the page
  useEffect(() => {
    const canvas = canvasRef.current
    const textDiv = textRef.current
    if (!canvas || !textDiv) return undefined

    if (!near) {
      canvas.width = 0
      canvas.height = 0
      textDiv.replaceChildren()
      return undefined
    }

    let cancelled = false
    let renderTask = null
    let textLayer = null

    ;(async () => {
      const page = await doc.getPage(num)
      if (cancelled) return

      const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
      const cssViewport = page.getViewport({ scale })
      const viewport = page.getViewport({ scale: scale * dpr })
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)

      renderTask = page.render({ canvas, viewport })
      await renderTask.promise
      if (cancelled) return

      // selectable / copyable text on top of the picture
      textDiv.replaceChildren()
      textLayer = new pdfjs.TextLayer({
        textContentSource: page.streamTextContent(),
        container: textDiv,
        viewport: cssViewport,
      })
      await textLayer.render()
    })().catch((e) => {
      if (!cancelled && e?.name !== 'RenderingCancelledException') console.warn(`[Pdf] page ${num} failed:`, e)
    })

    return () => {
      cancelled = true
      try { renderTask?.cancel() } catch { /* finished already */ }
      try { textLayer?.cancel() } catch { /* finished already */ }
    }
  }, [near, scale, doc, num, pdfjs])

  return (
    <div
      ref={wrapRef}
      className="pdf-page"
      data-page={num}
      style={{
        width,
        height,
        '--total-scale-factor': scale,
        '--scale-round-x': '1px',
        '--scale-round-y': '1px',
        filter: filter === 'none' ? undefined : filter,
      }}
    >
      <canvas ref={canvasRef} />
      <div ref={textRef} className="textLayer" />
    </div>
  )
}
