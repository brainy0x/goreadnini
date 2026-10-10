// AppThemeContext.jsx — the app's colour theme and glitter setting: applied live, saved on this device
// (so it is right from the first frame) and synced to your other devices.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useBooks } from './BooksContext'
import {
  DEFAULT_APP_THEME, applyAppTheme, buildThemeVars, readStoredAppTheme, storeAppTheme,
} from '../lib/appThemes'

const AppThemeContext = createContext(null)

export function AppThemeProvider({ children }) {
  const { profile, saveProfile } = useBooks()
  const [prefs, setPrefsState] = useState(readStoredAppTheme)

  // adopt a theme chosen on another device
  const remote = profile?.appTheme
  useEffect(() => {
    if (!remote) return
    setPrefsState((prev) => {
      const next = { ...DEFAULT_APP_THEME, ...remote }
      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next
    })
  }, [remote])

  // paint it
  useEffect(() => {
    applyAppTheme(prefs)
    storeAppTheme(prefs)
  }, [prefs])

  const setPrefs = useCallback((patch) => {
    const next = { ...prefs, ...patch }
    setPrefsState(next)
    saveProfile({ appTheme: next })
  }, [prefs, saveProfile])

  const glitterColors = useMemo(() => buildThemeVars(prefs).glitterColors, [prefs])
  const value = useMemo(() => ({ prefs, setPrefs, glitterColors }), [prefs, setPrefs, glitterColors])

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>
}

export const useAppTheme = () => useContext(AppThemeContext)
