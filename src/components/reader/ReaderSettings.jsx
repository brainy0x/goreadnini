import { useState } from 'react'
import { X, Download, RotateCcw, Palette, Minus, Plus, Trash2 } from 'lucide-react'
import { PRESETS, FONTS } from '../../lib/readerPrefs'

const SAMPLE = 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.'

function Slider({ label, value, min, max, step, onChange, format }) {
  return (
    <div className="rd-row">
      <div className="rd-row-head">
        <span>{label}</span>
        <strong>{format ? format(value) : value}</strong>
      </div>
      <input
        type="range"
        className="rd-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <button type="button" className="rd-toggle" onClick={() => onChange(!checked)} aria-pressed={checked}>
      <span className="rd-toggle-text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
      <span className={`rd-switch ${checked ? 'on' : ''}`}><span /></span>
    </button>
  )
}

export default function ReaderSettings({
  prefs, resolved, onChange, onReset,
  profiles, onSaveProfile, onApplyProfile, onDeleteProfile,
  bookOnly, onToggleBookOnly, onDownload, onClose,
}) {
  const [profileName, setProfileName] = useState('')

  const goodContrast = resolved.contrast >= 4.5
  const nudge = (key, delta, min, max) => onChange({ [key]: Math.min(max, Math.max(min, prefs[key] + delta)) })

  const saveProfile = () => {
    const name = profileName.trim()
    if (!name) return
    onSaveProfile(name)
    setProfileName('')
  }

  return (
    <div className="rd-sheet-wrap" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rd-sheet" role="dialog" aria-label="Reading settings">
        <div className="rd-sheet-head">
          <h3>Reading settings</h3>
          <button className="rd-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="rd-sheet-body">
          {/* Live preview */}
          <div
            className="rd-preview"
            style={{
              background: resolved.bg,
              color: resolved.text,
              fontFamily: resolved.fontStack || 'Georgia, serif',
              fontSize: `${resolved.size / 100}rem`,
              lineHeight: resolved.lineHeight,
              textAlign: resolved.align === 'justify' ? 'justify' : 'left',
              hyphens: resolved.hyphens ? 'auto' : 'manual',
              padding: `0.9rem ${Math.round(Math.min(resolved.margin, 56) / 2)}px`,
            }}
          >
            {SAMPLE}
          </div>

          {/* Background */}
          <div className="rd-group">
            <div className="rd-label">Background</div>
            <div className="rd-swatches">
              {Object.entries(PRESETS).map(([id, p]) => (
                <button
                  key={id}
                  type="button"
                  className={`rd-swatch ${prefs.preset === id ? 'active' : ''}`}
                  style={{ background: p.bg, color: p.text }}
                  onClick={() => onChange({ preset: id })}
                  aria-label={p.label}
                >
                  <span>Aa</span>
                  <small>{p.label}</small>
                </button>
              ))}
              <button
                type="button"
                className={`rd-swatch rd-swatch-custom ${prefs.preset === 'custom' ? 'active' : ''}`}
                onClick={() => onChange({ preset: 'custom', bg: resolved.bg, text: resolved.text })}
                aria-label="Custom colors"
              >
                <Palette size={18} />
                <small>Custom</small>
              </button>
            </div>

            {prefs.preset === 'custom' && (
              <div className="rd-custom">
                <label>
                  <span>Page</span>
                  <input type="color" value={prefs.bg} onChange={e => onChange({ preset: 'custom', bg: e.target.value })} />
                </label>
                <label>
                  <span>Text</span>
                  <input type="color" value={prefs.text} onChange={e => onChange({ preset: 'custom', text: e.target.value })} />
                </label>
              </div>
            )}

            <div className={`rd-contrast ${goodContrast ? 'ok' : 'warn'}`}>
              Contrast {resolved.contrast.toFixed(1)}:1 · {goodContrast ? 'Comfortable to read' : 'Low contrast — may strain your eyes'}
            </div>
          </div>

          {/* Font */}
          <div className="rd-group">
            <div className="rd-label">Font</div>
            <div className="rd-fonts">
              {FONTS.map(f => (
                <button
                  key={f.id}
                  type="button"
                  className={`rd-font ${prefs.font === f.id ? 'active' : ''}`}
                  style={{ fontFamily: f.stack || 'inherit' }}
                  onClick={() => onChange({ font: f.id })}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Size + spacing */}
          <div className="rd-group">
            <div className="rd-label">Text</div>
            <div className="rd-size">
              <button className="rd-step" onClick={() => nudge('size', -5, 70, 200)} aria-label="Smaller text"><Minus size={16} /></button>
              <input
                type="range"
                className="rd-range"
                min={70}
                max={200}
                step={5}
                value={prefs.size}
                onChange={e => onChange({ size: Number(e.target.value) })}
              />
              <button className="rd-step" onClick={() => nudge('size', 5, 70, 200)} aria-label="Larger text"><Plus size={16} /></button>
              <strong className="rd-size-val">{prefs.size}%</strong>
            </div>
            <Slider label="Line spacing" value={prefs.lineHeight} min={1.2} max={2.4} step={0.05} onChange={v => onChange({ lineHeight: v })} format={v => v.toFixed(2)} />
            <Slider label="Paragraph spacing" value={prefs.paraSpacing} min={0} max={2} step={0.1} onChange={v => onChange({ paraSpacing: v })} format={v => `${v.toFixed(1)}em`} />
            <Slider label="Side margins" value={prefs.margin} min={8} max={80} step={4} onChange={v => onChange({ margin: v })} format={v => `${v}px`} />

            <div className="rd-seg">
              <button type="button" className={prefs.align === 'left' ? 'active' : ''} onClick={() => onChange({ align: 'left' })}>Left aligned</button>
              <button type="button" className={prefs.align === 'justify' ? 'active' : ''} onClick={() => onChange({ align: 'justify' })}>Justified</button>
            </div>
            <Toggle label="Hyphenation" hint="Break long words at line ends" checked={prefs.hyphens} onChange={v => onChange({ hyphens: v })} />
          </div>

          {/* Comfort */}
          <div className="rd-group">
            <div className="rd-label">Eye comfort</div>
            <Slider label="Brightness dimmer" value={prefs.dim} min={0} max={60} step={2} onChange={v => onChange({ dim: v })} format={v => (v === 0 ? 'Off' : `${v}%`)} />
            <Slider label="Warm filter" value={prefs.warmth} min={0} max={100} step={5} onChange={v => onChange({ warmth: v })} format={v => (v === 0 ? 'Off' : `${v}%`)} />
            <Toggle label="Follow system dark mode" hint="Switch to Night when your device is in dark mode" checked={prefs.autoNight} onChange={v => onChange({ autoNight: v })} />
          </div>

          {/* Profiles */}
          <div className="rd-group">
            <div className="rd-label">Saved looks</div>
            {profiles.length > 0 && (
              <div className="rd-profiles">
                {profiles.map(p => (
                  <span key={p.id} className="rd-profile">
                    <button type="button" onClick={() => onApplyProfile(p)}>{p.name}</button>
                    <button type="button" className="rd-profile-x" onClick={() => onDeleteProfile(p.id)} aria-label={`Delete ${p.name}`}><Trash2 size={12} /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="rd-save-profile">
              <input
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveProfile()}
                placeholder="Name this look, e.g. Bedtime"
                maxLength={24}
              />
              <button type="button" onClick={saveProfile} disabled={!profileName.trim()}>Save</button>
            </div>
          </div>

          {/* Scope + actions */}
          <div className="rd-group">
            <Toggle
              label="Only for this book"
              hint="Keep these settings just for this book"
              checked={bookOnly}
              onChange={onToggleBookOnly}
            />
            <div className="rd-actions">
              <button type="button" className="rd-btn-ghost" onClick={onReset}><RotateCcw size={15} /> Reset to defaults</button>
              <button type="button" className="rd-btn-ghost" onClick={onDownload}><Download size={15} /> Download file</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
