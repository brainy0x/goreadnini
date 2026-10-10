import { useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { HIGHLIGHT_COLORS } from '../../lib/highlightColors'


const TABS = [
  { id: 'toc', label: 'Contents' },
  { id: 'bookmarks', label: 'Bookmarks' },
  { id: 'highlights', label: 'Highlights' },
]

export default function ReaderDrawer({
  tocItems, currentChapter, bookmarks, highlights,
  onOpenToc, onOpenCfi, onDeleteBookmark, onDeleteHighlight, onClose,
}) {
  const [tab, setTab] = useState('toc')

  return (
    <div className="rd-drawer-wrap" onClick={e => e.target === e.currentTarget && onClose()}>
      <aside className="rd-drawer" role="dialog" aria-label="Book contents">
        <div className="rd-sheet-head">
          <h3>This book</h3>
          <button className="rd-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="rd-tabs">
          {TABS.map(t => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
              {t.id === 'bookmarks' && bookmarks.length > 0 && <small>{bookmarks.length}</small>}
              {t.id === 'highlights' && highlights.length > 0 && <small>{highlights.length}</small>}
            </button>
          ))}
        </div>

        <div className="rd-drawer-body">
          {tab === 'toc' && (
            tocItems.length === 0 ? (
              <p className="rd-empty">No chapter list in this book.</p>
            ) : (
              tocItems.map((item, i) => (
                <button
                  key={`${item.href || item.id || i}-${i}`}
                  className={`rd-toc ${currentChapter && item.label === currentChapter ? 'current' : ''}`}
                  style={{ paddingLeft: `${0.9 + (item.depth || 0) * 0.9}rem` }}
                  onClick={() => onOpenToc(item)}
                >
                  {item.label}
                </button>
              ))
            )
          )}

          {tab === 'bookmarks' && (
            bookmarks.length === 0 ? (
              <p className="rd-empty">No bookmarks yet. Tap the bookmark icon at the top while reading.</p>
            ) : (
              bookmarks.map(b => (
                <div key={b.id} className="rd-item">
                  <button className="rd-item-main" onClick={() => onOpenCfi(b.cfi)}>
                    <span>{b.label || 'Bookmark'}</span>
                    <small>{b.page_info}</small>
                  </button>
                  <button className="rd-icon rd-icon-sm" onClick={() => onDeleteBookmark(b.id)} aria-label="Delete bookmark"><Trash2 size={14} /></button>
                </div>
              ))
            )
          )}

          {tab === 'highlights' && (
            highlights.length === 0 ? (
              <p className="rd-empty">No highlights yet. Select some text in the book to highlight it.</p>
            ) : (
              highlights.map(h => (
                <div key={h.id} className="rd-item">
                  <button
                    className="rd-item-main rd-hl"
                    style={{ borderLeftColor: HIGHLIGHT_COLORS[h.color] || HIGHLIGHT_COLORS.gold }}
                    onClick={() => onOpenCfi(h.cfi_range || h.cfi)}
                  >
                    <span>{h.text}</span>
                    <small>{h.page_info}</small>
                  </button>
                  <button className="rd-icon rd-icon-sm" onClick={() => onDeleteHighlight(h)} aria-label="Delete highlight"><Trash2 size={14} /></button>
                </div>
              ))
            )
          )}
        </div>
      </aside>
    </div>
  )
}
