import { useEffect } from 'react'

export default function Modal({ title, onClose, children, footer, size = 'md' }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className={`modal ${size === 'lg' ? 'modal-lg' : ''}`}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
