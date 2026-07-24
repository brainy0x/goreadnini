export const READER_THEMES = {
  light: {
    bg: '#f8f3e8',
    text: '#1e1508',
    toolbar: '#ede5d0',
    border: 'rgba(0,0,0,0.12)',
    btnColor: '#4a3820',
    link: '#9b5030',
  },
  sepia: {
    bg: '#efe3c8',
    text: '#3d2b0e',
    toolbar: '#e4d4b0',
    border: 'rgba(0,0,0,0.12)',
    btnColor: '#5a3a10',
    link: '#9b5030',
  },
  dark: {
    bg: '#14100c',
    text: '#ddd0b8',
    toolbar: '#1e1810',
    border: 'rgba(212,168,67,.18)',
    btnColor: '#c4a068',
    link: '#d48a62',
  },
}

export function getReaderTheme(themeName) {
  return READER_THEMES[themeName] || READER_THEMES.light
}

export function buildReaderCss(themeName, fontSize = 100) {
  const theme = getReaderTheme(themeName)

  return `
    :root {
      --app-bg: ${theme.bg} !important;
      --app-text: ${theme.text} !important;
      --app-link: ${theme.link} !important;
    }

    html,
    body {
      background-color: var(--app-bg) !important;
      color: var(--app-text) !important;
      margin: 0 !important;
      padding: 0 !important;
      min-height: 100vh !important;
    }

    body {
      font-size: ${fontSize}% !important;
      line-height: 1.85 !important;
    }

    html,
    body,
    p,
    div,
    span,
    section,
    article,
    main,
    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      background-color: var(--app-bg) !important;
      color: var(--app-text) !important;
    }

    p {
      margin-bottom: 1.05em !important;
      text-indent: 1.3em !important;
    }

    h1,
    h2,
    h3 {
      font-family: "Cinzel", serif !important;
      text-indent: 0 !important;
    }

    img,
    svg,
    video {
      max-width: 100% !important;
      height: auto !important;
    }

    a {
      color: var(--app-link) !important;
    }
  `
}

export function applyReaderThemeToDocument(doc, themeName, fontSize = 100) {
  if (!doc) return

  const theme = getReaderTheme(themeName)
  const html = doc.documentElement
  const body = doc.body

  for (const node of [html, body]) {
    if (!node) continue
    node.style.setProperty('background-color', theme.bg, 'important')
    node.style.setProperty('color', theme.text, 'important')
    node.style.setProperty('margin', '0', 'important')
    node.style.setProperty('padding', '0', 'important')
    node.style.setProperty('min-height', '100vh', 'important')
  }

  let style = doc.getElementById('grn-injected-style')
  if (!style) {
    style = doc.createElement('style')
    style.id = 'grn-injected-style'
    doc.head?.appendChild(style)
  }

  if (style) {
    style.textContent = buildReaderCss(themeName, fontSize)
  }
}

export function applyReaderThemeToRendition(rendition, themeName, fontSize = 100) {
  const theme = getReaderTheme(themeName)
  if (!rendition?.themes) return

  rendition.themes.default({
    '*': {
      color: `${theme.text} !important`,
      background: `${theme.bg} !important`,
      'background-color': `${theme.bg} !important`,
    },
    html: {
      background: `${theme.bg} !important`,
      'background-color': `${theme.bg} !important`,
      color: `${theme.text} !important`,
      margin: '0 !important',
      padding: '0 !important',
      'min-height': '100vh !important',
    },
    body: {
      background: `${theme.bg} !important`,
      'background-color': `${theme.bg} !important`,
      color: `${theme.text} !important`,
      'font-family': '"Cormorant Garamond", Georgia, serif !important',
      'font-size': `${fontSize}% !important`,
      'line-height': '1.85 !important',
      padding: '2rem 2.25rem !important',
      'max-width': '100% !important',
      margin: '0 !important',
      'min-height': '100vh !important',
    },
    p: {
      'margin-bottom': '1.05em !important',
      'text-indent': '1.3em !important',
    },
    'h1, h2, h3': {
      'font-family': '"Cinzel", serif !important',
      color: `${theme.text} !important`,
      'text-indent': '0 !important',
    },
    a: {
      color: `${theme.link} !important`,
    },
    img: {
      'max-width': '100% !important',
      height: 'auto !important',
    },
  })

  rendition.themes.override('body', {
    background: `${theme.bg} !important`,
    'background-color': `${theme.bg} !important`,
    color: `${theme.text} !important`,
    'font-size': `${fontSize}% !important`,
    'line-height': '1.85 !important',
  })
}
