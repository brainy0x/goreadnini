// How each page colour looks for PDFs: the page filter and the colour behind the pages.
export const PDF_THEMES = {
  light: { label: 'Paper', preset: 'paper', filter: 'none',                                           stage: '#d9d7d1' },
  sepia: { label: 'Sepia', preset: 'sepia', filter: 'sepia(0.5) saturate(0.9) brightness(0.96)',      stage: '#cbbd94' },
  night: { label: 'Night', preset: 'night', filter: 'invert(0.92) hue-rotate(180deg) contrast(0.95)', stage: '#101230' },
  black: { label: 'Black', preset: 'black', filter: 'invert(1) hue-rotate(180deg) brightness(0.88)',  stage: '#000000' },
}
