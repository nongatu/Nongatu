import { useState, useEffect, useRef } from 'react'

const FRASES_DEFAULT = [
  '¡Que los números y el campo te acompañen hoy!',
  '¡Un buen día para mantener todo bajo control!',
  '¡El trabajo constante construye grandes resultados!',
  'Recordá revisar los cobros pendientes del mes.',
  '¡El campo bien gestionado es un campo próspero!',
  'Cada detalle registrado hoy es una decisión mejor mañana.',
  '¡Adelante, el trabajo bien hecho siempre vale la pena!',
  'Revisá si hay animales nuevos para registrar hoy.',
  '¡Los datos precisos son la base de un buen negocio!',
  'No olvides verificar los vencimientos de esta semana.',
  '¡Buen comienzo es medio camino andado!',
  '¡La organización es la clave del éxito ganadero!',
]

export default function Configuracion({ user }) {
  const [frases, setFrases]         = useState([])
  const [nuevaFrase, setNuevaFrase] = useState('')
  const [editIdx, setEditIdx]       = useState(null)
  const [editVal, setEditVal]       = useState('')
  const [msgFrases, setMsgFrases]   = useState(null)
  const [faviconPreview, setFaviconPreview] = useState(null)
  const [msgFav, setMsgFav]         = useState(null)
  const faviconRef = useRef()

  if (user?.rol !== 'Administrador') {
    return (
      <div className="page-card" style={{ color: 'var(--text-secondary)' }}>
        Solo los administradores pueden acceder a la configuración.
      </div>
    )
  }

  useEffect(() => {
    // Cargar frases guardadas
    try {
      const saved = localStorage.getItem('nongatu_frases')
      if (saved) {
        const arr = JSON.parse(saved)
        if (Array.isArray(arr) && arr.length > 0) { setFrases(arr); return }
      }
    } catch {}
    setFrases([...FRASES_DEFAULT])

    // Cargar favicon preview
    const fav = localStorage.getItem('nongatu_favicon')
    if (fav) setFaviconPreview(fav)
  }, [])

  // ── Frases ──────────────────────────────────────────
  const guardarFrases = (lista) => {
    localStorage.setItem('nongatu_frases', JSON.stringify(lista))
    setFrases(lista)
    flash(setMsgFrases, { type: 'success', text: '✅ Frases guardadas correctamente.' })
  }

  const agregarFrase = () => {
    const txt = nuevaFrase.trim()
    if (!txt) return flash(setMsgFrases, { type: 'error', text: 'Escribí el texto de la frase primero.' })
    guardarFrases([...frases, txt])
    setNuevaFrase('')
  }

  const eliminarFrase = (idx) => {
    if (frases.length <= 1) return flash(setMsgFrases, { type: 'error', text: 'Debe haber al menos una frase.' })
    const nueva = frases.filter((_, i) => i !== idx)
    guardarFrases(nueva)
  }

  const iniciarEditar = (idx) => {
    setEditIdx(idx)
    setEditVal(frases[idx])
  }

  const guardarEdicion = () => {
    const txt = editVal.trim()
    if (!txt) return
    const nueva = frases.map((f, i) => i === editIdx ? txt : f)
    guardarFrases(nueva)
    setEditIdx(null)
    setEditVal('')
  }

  const restaurarDefault = () => {
    if (!confirm('¿Restaurar las frases originales de Ñongatu? Se perderán tus frases personalizadas.')) return
    localStorage.removeItem('nongatu_frases')
    setFrases([...FRASES_DEFAULT])
    flash(setMsgFrases, { type: 'success', text: '✅ Frases restauradas al valor original.' })
  }

  // ── Favicon ──────────────────────────────────────────
  const handleFaviconChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      flash(setMsgFav, { type: 'error', text: 'El archivo debe ser una imagen (PNG, JPG, ICO, SVG...).' })
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target.result
      setFaviconPreview(dataUrl)
      localStorage.setItem('nongatu_favicon', dataUrl)
      // Aplicar inmediatamente al documento
      aplicarFavicon(dataUrl)
      flash(setMsgFav, { type: 'success', text: '✅ Favicon actualizado. Se aplicará en cada inicio de sesión.' })
    }
    reader.readAsDataURL(file)
  }

  const eliminarFavicon = () => {
    localStorage.removeItem('nongatu_favicon')
    setFaviconPreview(null)
    // Restaurar favicon por defecto (emoji vaca)
    aplicarFavicon("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐄</text></svg>")
    flash(setMsgFav, { type: 'success', text: '✅ Favicon eliminado. Se restauró el ícono por defecto.' })
    if (faviconRef.current) faviconRef.current.value = ''
  }

  // Utilitarios
  const flash = (setter, msg) => {
    setter(msg)
    setTimeout(() => setter(null), 3500)
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="section-header" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22 }}>Configuración</h2>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Solo visible para administradores</span>
      </div>

      {/* ── Sección Frases ── */}
      <div className="page-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Frases de bienvenida</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              Se muestran en el panel de inicio. Una frase diferente cada día.
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={restaurarDefault}>
            Restaurar originales
          </button>
        </div>

        {msgFrases && (
          <div className={`alert alert-${msgFrases.type}`} style={{ marginBottom: 14 }}>
            {msgFrases.text}
          </div>
        )}

        {/* Agregar nueva frase */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            value={nuevaFrase}
            onChange={e => setNuevaFrase(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && agregarFrase()}
            placeholder="Escribí una nueva frase..."
            style={{ flex: 1, fontSize: 14 }}
          />
          <button className="btn btn-blue" onClick={agregarFrase}>+ Agregar</button>
        </div>

        {/* Lista de frases */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {frases.map((frase, idx) => (
            <div key={idx} style={{
              background: 'var(--main-bg, #f9fafb)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              {editIdx === idx ? (
                <>
                  <input
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && guardarEdicion()}
                    style={{ flex: 1, fontSize: 14 }}
                    autoFocus
                  />
                  <button className="btn btn-green btn-sm" onClick={guardarEdicion}>Guardar</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setEditIdx(null)}>Cancelar</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 14, fontStyle: 'italic', color: 'var(--text-primary)' }}>
                    {frase}
                  </span>
                  <button className="btn btn-outline btn-sm" onClick={() => iniciarEditar(idx)}>Editar</button>
                  <button className="btn btn-red btn-sm" onClick={() => eliminarFrase(idx)}>Eliminar</button>
                </>
              )}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10 }}>
          {frases.length} {frases.length === 1 ? 'frase' : 'frases'} configuradas
        </div>
      </div>

      {/* ── Sección Favicon ── */}
      <div className="page-card">
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Favicon personalizado</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          El ícono que aparece en la pestaña del navegador. Recomendado: imagen cuadrada PNG o ICO de 32×32 o 64×64 px.
        </div>

        {msgFav && (
          <div className={`alert alert-${msgFav.type}`} style={{ marginBottom: 14 }}>
            {msgFav.text}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          {/* Preview */}
          <div style={{
            width: 64, height: 64,
            border: '2px dashed var(--border)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--main-bg, #f9fafb)',
            flexShrink: 0,
            overflow: 'hidden',
          }}>
            {faviconPreview
              ? <img src={faviconPreview} alt="favicon" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : <span style={{ fontSize: 32 }}>🐄</span>
            }
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label className="btn btn-blue" style={{ cursor: 'pointer', display: 'inline-block' }}>
              📁 Elegir imagen
              <input
                ref={faviconRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFaviconChange}
              />
            </label>
            {faviconPreview && (
              <button className="btn btn-red btn-sm" onClick={eliminarFavicon}>
                Eliminar y restaurar 🐄
              </button>
            )}
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 280 }}>
            El favicon se guarda localmente y se aplica cada vez que abrís la app. Para que todos los usuarios lo vean,
            reemplazá el archivo <code>public/favicon.ico</code> en el proyecto.
          </div>
        </div>
      </div>
    </div>
  )
}

// Función exportada para aplicar favicon desde App.jsx al iniciar
export function aplicarFavicon(url) {
  let link = document.querySelector("link[rel~='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = url
}
