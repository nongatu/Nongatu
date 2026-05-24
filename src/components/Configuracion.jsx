import { useState, useEffect, useRef } from 'react'
import Usuarios from './Usuarios'
import Categorias from './Categorias'

// ── Constantes ────────────────────────────────────────────────────────────────
const DIAS_SEMANA = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

const REPETIR_OPTS = [
  { value: 'ninguna', label: 'Solo ese día (sin repetición)' },
  { value: 'semanal', label: 'Cada semana (mismo día de la semana)' },
  { value: 'mensual', label: 'Cada mes (mismo día del mes)' },
  { value: 'diaria',  label: 'Todos los días (desde esa fecha)' },
]

const TABS = [
  { key: 'general',    label: '⚙️ General' },
  { key: 'categorias', label: '🐄 Categorías' },
  { key: 'usuarios',   label: '👥 Usuarios' },
]

// ── Lógica de frases compartida ───────────────────────────────────────────────
function esFraseHoy(f) {
  const hoy    = new Date()
  const inicio = new Date(f.fecha_inicio + 'T12:00:00')
  if (hoy < inicio) return false
  const hoyStr = hoy.toISOString().split('T')[0]
  if (f.repetir === 'ninguna') return f.fecha_inicio === hoyStr
  if (f.repetir === 'diaria')  return true
  if (f.repetir === 'semanal') return hoy.getDay() === inicio.getDay()
  if (f.repetir === 'mensual') return hoy.getDate() === inicio.getDate()
  return false
}

export function getFraseHoy() {
  try {
    const saved = localStorage.getItem('nongatu_frases_v2')
    if (saved) {
      const arr = JSON.parse(saved)
      if (Array.isArray(arr) && arr.length > 0) {
        for (const rep of ['ninguna', 'semanal', 'mensual', 'diaria']) {
          const match = arr.find(f => f.repetir === rep && esFraseHoy(f))
          if (match) return match.texto
        }
      }
    }
  } catch {}
  return null
}

export function aplicarFavicon(url) {
  let link = document.querySelector("link[rel~='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = url
}

function descripcionFrase(f) {
  const d     = new Date(f.fecha_inicio + 'T12:00:00')
  const dia   = DIAS_SEMANA[d.getDay()]
  const fecha = d.toLocaleDateString('es-PY', { day: 'numeric', month: 'long', year: 'numeric' })
  if (f.repetir === 'ninguna') return `Solo el ${fecha} (${dia})`
  if (f.repetir === 'diaria')  return `Todos los días desde el ${fecha}`
  if (f.repetir === 'semanal') return `Cada ${dia} desde el ${fecha}`
  if (f.repetir === 'mensual') return `Cada día ${d.getDate()} del mes desde el ${fecha}`
  return fecha
}

const FORM_EMPTY = {
  texto:        '',
  fecha_inicio: new Date().toISOString().split('T')[0],
  repetir:      'ninguna',
}

const GRUPOS = [
  { rep: 'ninguna', label: '📅 Fecha específica (sin repetición)', color: '#2563eb' },
  { rep: 'semanal', label: '📆 Semanal (mismo día de la semana)',   color: '#059669' },
  { rep: 'mensual', label: '🗓️ Mensual (mismo día del mes)',         color: '#7c3aed' },
  { rep: 'diaria',  label: '🔁 Diaria (todos los días)',             color: '#d97706' },
]

// ── Componente ────────────────────────────────────────────────────────────────
export default function Configuracion({ user }) {
  const [tab,            setTab]           = useState('general')
  const [frases,         setFrases]        = useState([])
  const [form,           setForm]          = useState(FORM_EMPTY)
  const [editId,         setEditId]        = useState(null)
  const [mostrarForm,    setMostrarForm]   = useState(false)
  const [msgFrases,      setMsgFrases]     = useState(null)
  const [faviconPreview, setFaviconPreview]= useState(null)
  const [logoPreview,    setLogoPreview]   = useState(null)
  const [msgImagen,      setMsgImagen]     = useState(null)
  const faviconRef = useRef()
  const logoRef    = useRef()

  if (user?.rol !== 'Administrador') {
    return (
      <div className="page-card" style={{ color: 'var(--text-secondary)' }}>
        Solo los administradores pueden acceder a la configuración.
      </div>
    )
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem('nongatu_frases_v2')
      if (saved) setFrases(JSON.parse(saved))
    } catch {}
    const fav  = localStorage.getItem('nongatu_favicon')
    if (fav)  setFaviconPreview(fav)
    const logo = localStorage.getItem('nongatu_logo')
    if (logo) setLogoPreview(logo)
  }, [])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const flash = (setter, msg) => {
    setter(msg)
    setTimeout(() => setter(null), 3500)
  }

  const guardarFrases = (lista) => {
    localStorage.setItem('nongatu_frases_v2', JSON.stringify(lista))
    setFrases(lista)
  }

  const diaDeLabel = (fechaStr) => {
    if (!fechaStr) return ''
    return DIAS_SEMANA[new Date(fechaStr + 'T12:00:00').getDay()]
  }

  // ── Frases ────────────────────────────────────────────────────────────────
  const abrirNueva = () => {
    setForm(FORM_EMPTY); setEditId(null); setMostrarForm(true); setMsgFrases(null)
  }

  const abrirEditar = (f) => {
    setForm({ texto: f.texto, fecha_inicio: f.fecha_inicio, repetir: f.repetir })
    setEditId(f.id); setMostrarForm(true); setMsgFrases(null)
  }

  const cancelarForm = () => {
    setMostrarForm(false); setEditId(null); setForm(FORM_EMPTY)
  }

  const guardarFrase = () => {
    if (!form.texto.trim())  return flash(setMsgFrases, { type: 'error', text: 'Escribí el texto de la frase.' })
    if (!form.fecha_inicio)  return flash(setMsgFrases, { type: 'error', text: 'Seleccioná una fecha de inicio.' })
    const entry = { texto: form.texto.trim(), fecha_inicio: form.fecha_inicio, repetir: form.repetir }
    const nueva = editId
      ? frases.map(f => f.id === editId ? { ...f, ...entry } : f)
      : [...frases, { id: Date.now().toString(36) + Math.random().toString(36).slice(2), ...entry }]
    guardarFrases(nueva)
    setMostrarForm(false); setEditId(null); setForm(FORM_EMPTY)
    flash(setMsgFrases, { type: 'success', text: '✅ Frase guardada correctamente.' })
  }

  const eliminarFrase = (id) => {
    if (!confirm('¿Eliminar esta frase?')) return
    guardarFrases(frases.filter(f => f.id !== id))
    flash(setMsgFrases, { type: 'success', text: '✅ Frase eliminada.' })
  }

  // ── Imágenes ──────────────────────────────────────────────────────────────
  const handleImagen = (tipo, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      flash(setMsgImagen, { type: 'error', text: 'El archivo debe ser una imagen.' })
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target.result
      if (tipo === 'favicon') {
        setFaviconPreview(dataUrl)
        localStorage.setItem('nongatu_favicon', dataUrl)
        aplicarFavicon(dataUrl)
        flash(setMsgImagen, { type: 'success', text: '✅ Favicon actualizado. Ya aparece en la pestaña del navegador.' })
      } else {
        setLogoPreview(dataUrl)
        localStorage.setItem('nongatu_logo', dataUrl)
        flash(setMsgImagen, { type: 'success', text: '✅ Logo actualizado. Recargá la app para verlo en el menú lateral.' })
      }
    }
    reader.readAsDataURL(file)
  }

  const eliminarImagen = (tipo) => {
    if (tipo === 'favicon') {
      localStorage.removeItem('nongatu_favicon')
      setFaviconPreview(null)
      aplicarFavicon("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐄</text></svg>")
      if (faviconRef.current) faviconRef.current.value = ''
    } else {
      localStorage.removeItem('nongatu_logo')
      setLogoPreview(null)
      if (logoRef.current) logoRef.current.value = ''
    }
    flash(setMsgImagen, { type: 'success', text: '✅ Imagen eliminada.' })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 860 }}>

      {/* ── Encabezado + tabs ── */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, marginBottom: 16 }}>Configuración</h2>
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '9px 22px',
                fontSize: 14, fontWeight: 600,
                border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
                color: tab === t.key ? '#2563eb' : 'var(--text-secondary)',
                marginBottom: -2,
                transition: 'color 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab: Categorías ── */}
      {tab === 'categorias' && <Categorias user={user} />}

      {/* ── Tab: Usuarios ── */}
      {tab === 'usuarios' && <Usuarios user={user} />}

      {/* ── Tab: General ── */}
      {tab === 'general' && (
        <>
          {/* Marca visual */}
          <div className="page-card" style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Marca visual</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Logo del menú lateral y favicon de la pestaña — son dos imágenes independientes.
            </div>

            {msgImagen && (
              <div className={`alert alert-${msgImagen.type}`} style={{ marginBottom: 16 }}>{msgImagen.text}</div>
            )}

            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>

              {/* Logo sidebar */}
              <div style={{ flex: '1 1 300px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                  Logo del sistema{' '}
                  <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(menú lateral)</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
                  Reemplaza el texto "🐄 ÑONGATU" en el menú.<br />
                  <strong>Tamaño recomendado: máximo 240 × 60 px.</strong><br />
                  PNG con fondo transparente para que se vea bien sobre el fondo oscuro.
                </div>
                <div style={{
                  background: '#1e3a5f', borderRadius: 10,
                  padding: '10px 18px', marginBottom: 12, minHeight: 58,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {logoPreview
                    ? <img src={logoPreview} alt="logo" style={{ maxWidth: 220, maxHeight: 50, objectFit: 'contain' }} />
                    : <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, fontWeight: 700 }}>🐄 ÑONGATU</span>
                  }
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <label className="btn btn-blue btn-sm" style={{ cursor: 'pointer' }}>
                    📁 Subir logo
                    <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => handleImagen('logo', e)} />
                  </label>
                  {logoPreview && (
                    <button className="btn btn-red btn-sm" onClick={() => eliminarImagen('logo')}>
                      Eliminar logo
                    </button>
                  )}
                </div>
              </div>

              {/* Favicon */}
              <div style={{ flex: '1 1 220px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                  Favicon{' '}
                  <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(pestaña del navegador)</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
                  Solo aparece en la pestaña, no dentro de la app.<br />
                  <strong>Tamaño recomendado: 64 × 64 px (cuadrado).</strong><br />
                  PNG o ICO con fondo transparente.
                </div>
                {/* Preview pestaña */}
                <div style={{
                  background: '#e8eaed', borderRadius: '8px 8px 0 0',
                  padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6,
                  marginBottom: 12, border: '1px solid #ccc', borderBottom: 'none',
                }}>
                  <div style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {faviconPreview
                      ? <img src={faviconPreview} alt="fav" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                      : <span style={{ fontSize: 14 }}>🐄</span>
                    }
                  </div>
                  <span style={{ fontSize: 11, color: '#333' }}>Ñongatu</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <label className="btn btn-blue btn-sm" style={{ cursor: 'pointer' }}>
                    📁 Subir favicon
                    <input ref={faviconRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => handleImagen('favicon', e)} />
                  </label>
                  {faviconPreview && (
                    <button className="btn btn-red btn-sm" onClick={() => eliminarImagen('favicon')}>
                      Eliminar
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Frases de bienvenida */}
          <div className="page-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>Frases de bienvenida</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
                  Cada frase tiene fecha de inicio y repetición. Prioridad:{' '}
                  <span style={{ color: '#2563eb' }}>fecha exacta</span> →{' '}
                  <span style={{ color: '#059669' }}>semanal</span> →{' '}
                  <span style={{ color: '#7c3aed' }}>mensual</span> →{' '}
                  <span style={{ color: '#d97706' }}>diaria</span>.
                  Si ninguna coincide, se usan las frases por defecto.
                </div>
              </div>
              <button className="btn btn-blue" onClick={abrirNueva} style={{ flexShrink: 0, marginLeft: 16 }}>
                + Nueva frase
              </button>
            </div>

            {msgFrases && (
              <div className={`alert alert-${msgFrases.type}`} style={{ marginBottom: 14 }}>{msgFrases.text}</div>
            )}

            {/* Formulario */}
            {mostrarForm && (
              <div style={{
                border: '2px solid #2563eb', borderRadius: 10,
                padding: 18, marginBottom: 20, background: '#eff6ff',
              }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: '#1e40af' }}>
                  {editId ? '✏️ Editar frase' : '➕ Nueva frase'}
                </div>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label>Texto de la frase *</label>
                  <input
                    value={form.texto}
                    onChange={e => setForm({ ...form, texto: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && guardarFrase()}
                    placeholder="Ej: ¡Feliz sábado! Que el campo te traiga buenos resultados hoy."
                    style={{ fontSize: 14 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
                  <div className="form-group" style={{ marginBottom: 0, flex: '1 1 160px' }}>
                    <label>Fecha de inicio *</label>
                    <input
                      type="date"
                      value={form.fecha_inicio}
                      onChange={e => setForm({ ...form, fecha_inicio: e.target.value })}
                    />
                    {form.fecha_inicio && (
                      <div style={{ fontSize: 12, color: '#2563eb', marginTop: 4, fontWeight: 600 }}>
                        {diaDeLabel(form.fecha_inicio)}
                      </div>
                    )}
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, flex: '2 1 240px' }}>
                    <label>Repetición</label>
                    <select value={form.repetir} onChange={e => setForm({ ...form, repetir: e.target.value })}>
                      {REPETIR_OPTS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {form.fecha_inicio && (
                      <div style={{ fontSize: 12, color: '#059669', marginTop: 4 }}>
                        {descripcionFrase(form)}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-green" onClick={guardarFrase}>
                    {editId ? 'Guardar cambios' : 'Agregar frase'}
                  </button>
                  <button className="btn btn-outline" onClick={cancelarForm}>Cancelar</button>
                </div>
              </div>
            )}

            {/* Lista agrupada */}
            {frases.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>
                Sin frases personalizadas. El sistema usa frases por defecto del sistema.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {GRUPOS.map(g => {
                  const lista = frases.filter(f => f.repetir === g.rep)
                  if (lista.length === 0) return null
                  return (
                    <div key={g.rep}>
                      <div style={{
                        fontSize: 12, fontWeight: 700, color: g.color,
                        textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8,
                      }}>
                        {g.label}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {lista.map(f => {
                          const activa = esFraseHoy(f)
                          return (
                            <div key={f.id} style={{
                              border: `1px solid ${activa ? g.color : 'var(--border)'}`,
                              borderLeft: `4px solid ${g.color}`,
                              borderRadius: 8, padding: '10px 14px',
                              background: activa ? `${g.color}0d` : 'var(--main-bg,#f9fafb)',
                              display: 'flex', alignItems: 'center', gap: 12,
                            }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontStyle: 'italic', marginBottom: 4 }}>
                                  "{f.texto}"
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                  {descripcionFrase(f)}
                                </div>
                              </div>
                              {activa && (
                                <span style={{
                                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                                  background: g.color, color: '#fff',
                                  borderRadius: 12, padding: '3px 10px',
                                }}>
                                  Hoy ✓
                                </span>
                              )}
                              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                <button className="btn btn-outline btn-sm" onClick={() => abrirEditar(f)}>Editar</button>
                                <button className="btn btn-red btn-sm" onClick={() => eliminarFrase(f.id)}>Eliminar</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
