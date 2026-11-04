import { useEffect } from 'react'
import Button from './Button'
import Icon from './Icon'

// Animated yes/no dialog. tone: 'danger' | 'primary'.  busy shows a spinner on the confirm button.
export default function ConfirmModal({ icon = 'logout', title, text, confirmLabel = 'Yes', cancelLabel = 'Cancel', tone = 'danger', busy, onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, busy])

  return (
    <div className="modal-overlay" onMouseDown={() => !busy && onCancel()}>
      <div className="modal confirm" role="alertdialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className={`confirm-icon ${tone}`}><span className="ring" /><Icon name={icon} size={26} /></div>
        <h2>{title}</h2>
        <p>{text}</p>
        <div className="confirm-actions">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={busy} autoFocus>{busy ? 'Please wait…' : confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}
