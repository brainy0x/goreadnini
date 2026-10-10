import { X } from 'lucide-react'
import AnabelleStatus from './AnabelleStatus'

export default function AnabelleSheet({ onClose, studying }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal pup-modal">
        <div className="modal-header">
          <div className="modal-title">Anabelle</div>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="modal-body">
          <AnabelleStatus studying={studying} />
        </div>
      </div>
    </div>
  )
}
