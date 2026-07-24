import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const DEFAULT_THEME = 'light'
const THEMES = ['light', 'sepia', 'dark']

const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  themes: THEMES,
})

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(DEFAULT_THEME)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem('grn_theme')
    if (saved && THEMES.includes(saved)) {
      setThemeState(saved)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('grn_theme', theme)
    document.body.classList.remove('theme-light', 'theme-sepia', 'theme-dark')
    document.body.classList.add(`theme-${theme}`)
    document.documentElement.dataset.theme = theme
  }, [theme])

  const value = useMemo(() => ({ theme, setTheme: setThemeState, themes: THEMES }), [theme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
