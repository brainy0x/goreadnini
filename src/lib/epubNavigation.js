const EXTERNAL_HREF_RE = /^(?:https?:|mailto:|tel:|javascript:|data:|blob:)/i

export function flattenToc(items = [], depth = 0) {
  return items.reduce((acc, item) => {
    if (item?.label) {
      acc.push({
        label: item.label,
        href: item.href,
        id: item.id,
        depth,
      })
    }

    if (item?.subitems?.length) {
      acc.push(...flattenToc(item.subitems, depth + 1))
    }

    return acc
  }, [])
}

export function isInternalHref(href) {
  const normalized = href?.trim()
  return Boolean(normalized && !EXTERNAL_HREF_RE.test(normalized))
}

export function splitHref(href) {
  const normalized = href?.trim() || ''
  const hashIndex = normalized.indexOf('#')

  if (hashIndex === -1) {
    return { normalized, base: normalized, fragment: '' }
  }

  return {
    normalized,
    base: normalized.slice(0, hashIndex),
    fragment: normalized.slice(hashIndex + 1),
  }
}

export function findFragmentElement(doc, fragment) {
  if (!doc || !fragment) return null

  const decoded = safeDecode(fragment)
  return (
    doc.getElementById(fragment) ||
    doc.getElementById(decoded) ||
    findNamedAnchor(doc, fragment) ||
    findNamedAnchor(doc, decoded)
  )
}

export function scrollToFragmentInDocument(doc, fragment) {
  const target = findFragmentElement(doc, fragment)
  if (!target) return false

  target.scrollIntoView({ behavior: 'auto', block: 'center' })
  return true
}

export function scrollToFragmentInViewer(viewer, fragment) {
  const iframe = viewer?.querySelector('iframe')
  return scrollToFragmentInDocument(iframe?.contentDocument, fragment)
}

export function scrollToFragmentAfterRender(viewer, fragment, delay = 220) {
  window.setTimeout(() => {
    try {
      scrollToFragmentInViewer(viewer, fragment)
    } catch {
      // The frame can be mid-navigation; the next rendition event will re-apply routing hooks.
    }
  }, delay)
}

export async function displayEpubTarget({ book, rendition, viewer, href }) {
  if (!book || !rendition || !isInternalHref(href)) return false

  const { normalized, base, fragment } = splitHref(href)

  if (normalized.startsWith('#')) {
    return scrollToFragmentInViewer(viewer, fragment)
  }

  if (await tryDisplay(rendition, normalized)) return true

  if (base && await tryDisplay(rendition, base)) {
    if (fragment) scrollToFragmentAfterRender(viewer, fragment)
    return true
  }

  const manifestMatch = findManifestHref(book, normalized, base)
  if (manifestMatch && await tryDisplay(rendition, manifestMatch)) {
    if (fragment) scrollToFragmentAfterRender(viewer, fragment)
    return true
  }

  const spineMatch = findSpineHref(book, normalized, base)
  if (spineMatch && await tryDisplay(rendition, spineMatch)) {
    if (fragment) scrollToFragmentAfterRender(viewer, fragment)
    return true
  }

  if (fragment) {
    return displayCurrentFrameForFragment({ rendition, viewer, fragment })
  }

  // Last-resort attempts: try matching by filename segments, trimming ./ or ../ prefixes,
  // and trying a loose contains match against manifest/spine entries.
  const tryLooseMatch = async () => {
    const trim = (s) => (s || '').replace(/^\.\/?|^\.\.\//, '')
    const targetFile = trim(base || normalized)
    if (!targetFile) return false

    // try manifest entries
    const pkg = book?.package || book?.packaging || {}
    const manifest = pkg?.manifest || {}
    const entries = Array.isArray(manifest) ? manifest : Object.values(manifest)
    for (const item of entries) {
      const href = item?.href || ''
      if (!href) continue
      const candidate = href.split('/').pop()
      if (candidate === targetFile || candidate?.endsWith(targetFile) || candidate?.includes(targetFile)) {
        if (await tryDisplay(rendition, href)) {
          if (fragment) scrollToFragmentAfterRender(viewer, fragment)
          return true
        }
      }
    }

    // try spine items
    const items = book?.spine?.items || book?.spine?.spineItems || []
    for (const item of items) {
      const candidateHref = (item?.href || item?.idref || item?.url || '')
      const candidate = candidateHref.split('/').pop()
      if (candidate === targetFile || candidate?.endsWith(targetFile) || candidate?.includes(targetFile)) {
        if (await tryDisplay(rendition, candidateHref)) {
          if (fragment) scrollToFragmentAfterRender(viewer, fragment)
          return true
        }
      }
    }

    return false
  }

  if (await tryLooseMatch()) return true

  return false
}

async function displayCurrentFrameForFragment({ rendition, viewer, fragment }) {
  const iframes = viewer?.querySelectorAll('iframe') || []

  for (const iframe of iframes) {
    try {
      const doc = iframe.contentDocument
      const target = findFragmentElement(doc, fragment)
      const baseUri = doc?.baseURI || doc?.location?.href
      const fileName = baseUri?.split('/').pop()

      if (target && fileName && await tryDisplay(rendition, fileName)) {
        window.setTimeout(() => {
          try {
            target.scrollIntoView({ behavior: 'auto', block: 'center' })
          } catch {
            // Ignore stale nodes after iframe replacement.
          }
        }, 220)
        return true
      }
    } catch {
      // Ignore transient iframe access errors during epub.js rerenders.
    }
  }

  return false
}

async function tryDisplay(rendition, target) {
  if (!target) return false

  try {
    await rendition.display(target)
    return true
  } catch {
    return false
  }
}

function findManifestHref(book, normalized, base) {
  const pkg = book?.package || book?.packaging || {}
  const manifest = pkg?.manifest || {}
  const entries = Array.isArray(manifest) ? manifest : Object.values(manifest)
  const match = entries.find((item) => hrefMatches(item?.href, normalized, base))
  return match?.href || ''
}

function findSpineHref(book, normalized, base) {
  const items = book?.spine?.items || book?.spine?.spineItems || []
  const match = items.find((item) => hrefMatches(item?.href || item?.idref || item?.url, normalized, base))
  return match?.href || match?.idref || match?.url || ''
}

function hrefMatches(candidate, normalized, base) {
  return Boolean(
    candidate &&
    (
      candidate === normalized ||
      candidate === base ||
      (base && candidate.endsWith(base))
    )
  )
}

function findNamedAnchor(doc, name) {
  return Array.from(doc?.querySelectorAll('a[name]') || []).find((anchor) => (
    anchor.getAttribute('name') === name
  )) || null
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
