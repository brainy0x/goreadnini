import { X, Download, Minus, Plus, RotateCcw } from 'lucide-react'
import { PRESETS } from '../../lib/readerPrefs'
import { PDF_THEMES } from '../../lib/pdfThemes'


function Slider({ label, value, min, max, step, onChange, format }) {
  return (
    <div className="rd-row">
      <div className="rd-row-head">
        <span>{label}</span>
        <strong>{format ? format(value) : value}</strong>
      </div>
      <input type="range" className="rd-range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
    </div>
  )
}

export default function PdfSettings({ prefs, onChange, zoom, onZoom, onDownload, onClose }) {
  return (
    <div className="rd-sheet-wrap" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rd-sheet" role="dialog" aria-label="Document settings">
        <div className="rd-sheet-head">
          <h3>Document settings</h3>
          <button className="rd-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="rd-sheet-body">
          <div className="rd-group">
            <div className="rd-label">Page color</div>
            <div className="rd-swatches pdf-swatches">
              {Object.entries(PDF_THEMES).map(([id, t]) => {
                const colors = PRESETS[t.preset]
                return (
                  <button
                    key={id}
                    type="button"
                    className={`rd-swatch ${prefs.theme === id ? 'active' : ''}`}
                    style={{ background: colors.bg, color: colors.text }}
                    onClick={() => onChange({ theme: id })}
                  >
                    <span>Aa</span>
                    <small>{t.label}</small>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rd-group">
            <div className="rd-label">Zoom</div>
            <div className="rd-size">
              <button className="rd-step" onClick={() => onZoom(zoom - 0.1)} aria-label="Zoom out"><Minus size={16} /></button>
              <input type="range" className="rd-range" min={0.5} max={4} step={0.05} value={zoom} onChange={e => onZoom(Number(e.target.value))} />
              <button className="rd-step" onClick={() => onZoom(zoom + 0.1)} aria-label="Zoom in"><Plus size={16} /></button>
              <strong className="rd-size-val">{Math.round(zoom * 100)}%</strong>
            </div>
            <button type="button" className="rd-btn-ghost" onClick={() => onZoom(1)}><RotateCcw size={15} /> Fit to width</button>
          </div>

          <div className="rd-group">
            <div className="rd-label">Eye comfort</div>
            <Slider label="Brightness dimmer" value={prefs.dim} min={0} max={60} step={2} onChange={v => onChange({ dim: v })} format={v => (v === 0 ? 'Off' : `${v}%`)} />
            <Slider label="Warm filter" value={prefs.warmth} min={0} max={100} step={5} onChange={v => onChange({ warmth: v })} format={v => (v === 0 ? 'Off' : `${v}%`)} />
          </div>

          <div className="rd-group">
            <div className="rd-actions">
              <button type="button" className="rd-btn-ghost" onClick={onDownload}><Download size={15} /> Download file</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
