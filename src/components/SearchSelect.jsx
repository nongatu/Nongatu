import { useState, useRef, useEffect } from 'react'

export default function SearchSelect({ options = [], value, onChange, placeholder = 'Buscar...' }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const selected = options.find(o => String(o.value) === String(value))

  const filtered = options.filter(o =>
    !query || o.searchText?.toLowerCase().includes(query.toLowerCase()) || o.label?.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (opt) => {
    onChange(String(opt.value))
    setQuery('')
    setOpen(false)
  }

  const handleFocus = () => {
    setQuery('')
    setOpen(true)
  }

  const handleChange = (e) => {
    setQuery(e.target.value)
    setOpen(true)
    if (!e.target.value) onChange('')
  }

  const displayValue = open ? query : (selected ? selected.label : '')

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <input
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        autoComplete="off"
        style={{
          width: '100%', padding: '8px 12px',
          border: `1px solid ${open ? 'var(--blue)' : 'var(--input-border)'}`,
          borderRadius: 6, fontSize: 14,
          background: 'var(--input-bg)', color: 'var(--text-primary)', outline: 'none',
          boxSizing: 'border-box'
        }}
      />
      {selected && !open && (
        <button
          onMouseDown={e => { e.preventDefault(); onChange(''); setQuery('') }}
          style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1, padding: '2px 4px'
          }}
        >×</button>
      )}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 999,
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          borderRadius: 8, maxHeight: 260, overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: 13 }}>Sin resultados.</div>
          ) : filtered.map(opt => (
            <div
              key={opt.value}
              onMouseDown={() => handleSelect(opt)}
              style={{
                padding: '10px 14px', cursor: 'pointer', fontSize: 14,
                borderBottom: '1px solid var(--border)',
                background: String(opt.value) === String(value) ? 'var(--table-row-hover)' : 'transparent',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--table-row-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = String(opt.value) === String(value) ? 'var(--table-row-hover)' : 'transparent'}
            >
              <div style={{ fontWeight: String(opt.value) === String(value) ? 600 : 400 }}>{opt.label}</div>
              {opt.sublabel && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{opt.sublabel}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
