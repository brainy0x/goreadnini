import { X } from 'lucide-react'
import { useAppTheme } from '../contexts/AppThemeContext'
import { THEMES, THEME_ORDER, GLITTER_LEVELS, buildThemeVars } from '../lib/appThemes'

// Settings: pick a theme, an accent colour, and how much glitter. Changes show instantly and are saved.
export default function SettingsSheet({ onClose }) {
  const { prefs, setPrefs } = useAppTheme()
  const themeAccent = (THEMES[prefs.theme] || THEMES.indigo).accent
  const accent = prefs.accent || themeAccent

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal st-modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Settings</div>
            <div className="st-sub">Make the app yours</div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="modal-body">
          <h4 className="st-h">Theme</h4>
          <div className="st-themes">
            {THEME_ORDER.map(id => {
              const { vars } = buildThemeVars({ theme: id })
              return (
                <button
                  key={id}
                  type="button"
                  className={`st-theme ${prefs.theme === id ? 'active' : ''}`}
                  style={{ background: `linear-gradient(135deg, ${vars['--bg-g1']}, ${vars['--bg-g2']})` }}
                  onClick={() => setPrefs({ theme: id })}
                >
                  <span className="st-dot" style={{ background: vars['--accent'] }} />
                  <span className="st-theme-name">{THEMES[id].label}</span>
                </button>
              )
            })}
          </div>

          <h4 className="st-h">Accent color</h4>
          <div className="st-accent">
            <input type="color" value={accent} onChange={e => setPrefs({ accent: e.target.value })} aria-label="Accent color" />
            <span>{prefs.accent ? 'Your own color' : 'Theme color'}</span>
            {prefs.accent && (
              <button type="button" className="st-link" onClick={() => setPrefs({ accent: '' })}>Use the theme's color</button>
            )}
          </div>

          <h4 className="st-h">Glitter</h4>
          <div className="lib-seg st-glitter">
            {GLITTER_LEVELS.map(level => (
              <button
                key={level.id}
                type="button"
                className={prefs.glitter === level.id ? 'active' : ''}
                onClick={() => setPrefs({ glitter: level.id })}
              >
                {level.label}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary btn-sm" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
