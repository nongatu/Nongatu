import { useEffect } from 'react'

export default function Toast({ text, type = 'success', onClose, duration = 2600 }) {
  useEffect(() => {
    if (!text) return
    const t = setTimeout(() => onClose?.(), duration)
    return () => clearTimeout(t)
  }, [text, onClose, duration])

  if (!text) return null

  return (
    <div className={`toast toast-${type}`} role="status">
      {text}
    </div>
  )
}
