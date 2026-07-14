import { useState, useRef, useEffect } from 'react'

const norm = s => (s || '').toString().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

export default function SearchSelect({ options = [], value, onChange, placeholder = 'Buscar...', onCreateNew }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const ref = useRef(null)

  const selected = options.find(o => String(o.value) === String(value))

  const filtered = options.filter(o => {
    const q = norm(query)
    return !q || norm(o.searchText).includes(q) || norm(o.label).includes(q)
  })

  const totalItems = filtered.length + (onCreateNew ? 1 : 0)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
        setHighlight(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => { setHighlight(-1) }, [query, open])

  const handleSelect = (opt) => {
    onChange(String(opt.value))
    setQuery('')
    setOpen(false)
    setHighlight(-1)
  }

  const handleCreateNew = () => {
    setQuery('')
    setOpen(false)
    setHighlight(-1)
    onCreateNew?.()
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

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown') setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => Math.min(h + 1, totalItems - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      if (highlight === -1) return
      e.preventDefault()
      if (highlight < filtered.length) handleSelect(filtered[highlight])
      else handleCreateNew()
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  const displayValue = open ? query : (selected ? selected.label : '')

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <input
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
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
          {filtered.length === 0 && !onCreateNew ? (
            <div style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: 13 }}>Sin resultados.</div>
          ) : (
            <>
              {filtered.length === 0 && (
                <div style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: 13 }}>Sin resultados.</div>
              )}
              {filtered.map((opt, i) => (
                <div
                  key={opt.value}
                  onMouseDown={() => handleSelect(opt)}
                  onMouseEnter={() => setHighlight(i)}
                  style={{
                    padding: '10px 14px', cursor: 'pointer', fontSize: 14,
                    borderBottom: '1px solid var(--border)',
                    background: highlight === i || String(opt.value) === String(value) ? 'var(--table-row-hover)' : 'transparent',
                  }}
                >
                  <div style={{ fontWeight: String(opt.value) === String(value) ? 600 : 400 }}>{opt.label}</div>
                  {opt.sublabel && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{opt.sublabel}</div>}
                </div>
              ))}
              {onCreateNew && (
                <div
                  onMouseDown={handleCreateNew}
                  onMouseEnter={() => setHighlight(filtered.length)}
                  style={{
                    padding: '10px 14px', cursor: 'pointer', fontSize: 14,
                    fontWeight: 600, color: 'var(--green)',
                    background: highlight === filtered.length ? 'var(--table-row-hover)' : 'transparent',
                  }}
                >
                  + Crear cliente nuevo…
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
