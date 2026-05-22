import { useState, useRef } from 'react'
import { supabase } from '../supabase'

export default function Perfil({ user }) {
  const [foto, setFoto] = useState(() =>
    localStorage.getItem(`profile_photo_${user?.nombre_usuario}`) || null
  )
  const [perfil, setPerfil] = useState(() => {
    try {
      const saved = localStorage.getItem(`profile_data_${user?.nombre_usuario}`)
      if (saved) return JSON.parse(saved)
    } catch {}
    return { nombre_completo: '', telefono: '', email: '' }
  })
  const [pass, setPass]   = useState({ actual: '', nueva: '', confirmar: '' })
  const [msg, setMsg]     = useState(null)
  const fileRef           = useRef()

  const showMsg = (type, text) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3500)
  }

  // ── Foto ──────────────────────────────────────────────────────────────────
  const handleFoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    // Resize to max 400px to keep localStorage lean
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const MAX = 400
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        const base64 = canvas.toDataURL('image/jpeg', 0.82)
        localStorage.setItem(`profile_photo_${user?.nombre_usuario}`, base64)
        setFoto(base64)
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }

  const eliminarFoto = () => {
    localStorage.removeItem(`profile_photo_${user?.nombre_usuario}`)
    setFoto(null)
  }

  // ── Guardar datos ─────────────────────────────────────────────────────────
  const guardarPerfil = () => {
    localStorage.setItem(`profile_data_${user?.nombre_usuario}`, JSON.stringify(perfil))
    showMsg('success', 'Perfil actualizado correctamente.')
  }

  // ── Cambiar contraseña ────────────────────────────────────────────────────
  const cambiarPassword = async () => {
    if (!pass.actual) return showMsg('error', 'Ingresá tu contraseña actual.')
    if (pass.nueva.length < 4) return showMsg('error', 'La nueva contraseña debe tener al menos 4 caracteres.')
    if (pass.nueva !== pass.confirmar) return showMsg('error', 'Las contraseñas nuevas no coinciden.')

    const { data, error: fetchErr } = await supabase
      .from('usuarios')
      .select('password_hash')
      .eq('id', user.id)
      .single()

    if (fetchErr || !data) return showMsg('error', 'Error al verificar usuario.')
    if (data.password_hash !== pass.actual) return showMsg('error', 'La contraseña actual no es correcta.')

    const { error } = await supabase
      .from('usuarios')
      .update({ password_hash: pass.nueva })
      .eq('id', user.id)

    if (error) return showMsg('error', 'Error al guardar la nueva contraseña.')
    setPass({ actual: '', nueva: '', confirmar: '' })
    showMsg('success', 'Contraseña cambiada correctamente.')
  }

  const initial = (perfil.nombre_completo || user?.nombre_usuario || '?').charAt(0).toUpperCase()

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="section-header">
        <h2>Mi Perfil</h2>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`}>
          {msg.text}
        </div>
      )}

      {/* ── Foto + nombre ── */}
      <div className="page-card" style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 16 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            style={{
              width: 96, height: 96, borderRadius: '50%',
              background: foto ? 'transparent' : 'linear-gradient(135deg,#1e3a5f,#2563eb)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', border: '3px solid var(--border)', cursor: 'pointer'
            }}
            onClick={() => fileRef.current?.click()}
          >
            {foto
              ? <img src={foto} alt="perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 38, color: '#fff', fontWeight: 700 }}>{initial}</span>
            }
          </div>
          <div
            style={{
              position: 'absolute', bottom: 2, right: 2,
              background: '#2563eb', borderRadius: '50%',
              width: 26, height: 26, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer',
              border: '2px solid var(--card-bg)', fontSize: 13
            }}
            onClick={() => fileRef.current?.click()}
          >✏️</div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{perfil.nombre_completo || user?.nombre_usuario}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
            @{user?.nombre_usuario} · {user?.rol}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-blue btn-sm" onClick={() => fileRef.current?.click()}>
              Cambiar foto
            </button>
            {foto && (
              <button className="btn btn-outline btn-sm" onClick={eliminarFoto}>Quitar</button>
            )}
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFoto}
        />
      </div>

      {/* ── Datos profesionales ── */}
      <div className="page-card" style={{ marginBottom: 16 }}>
        <h3 style={{
          fontSize: 14, fontWeight: 700, marginBottom: 16,
          paddingBottom: 10, borderBottom: '1px solid var(--border)'
        }}>Datos profesionales</h3>

        <div className="form-grid">
          <div className="form-group">
            <label>Usuario</label>
            <input
              value={user?.nombre_usuario || ''}
              disabled
              style={{ background: 'var(--table-head)', color: 'var(--text-secondary)' }}
            />
          </div>
          <div className="form-group">
            <label>Rol</label>
            <input
              value={user?.rol || ''}
              disabled
              style={{ background: 'var(--table-head)', color: 'var(--text-secondary)' }}
            />
          </div>
          <div className="form-group">
            <label>Nombre completo</label>
            <input
              value={perfil.nombre_completo}
              onChange={e => setPerfil(p => ({ ...p, nombre_completo: e.target.value }))}
              placeholder="Nombre y apellido"
            />
          </div>
          <div className="form-group">
            <label>Teléfono</label>
            <input
              value={perfil.telefono}
              onChange={e => setPerfil(p => ({ ...p, telefono: e.target.value }))}
              placeholder="Ej: 0981 123 456"
            />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label>Email</label>
            <input
              type="email"
              value={perfil.email}
              onChange={e => setPerfil(p => ({ ...p, email: e.target.value }))}
              placeholder="correo@ejemplo.com"
            />
          </div>
        </div>

        <div className="btn-row" style={{ marginBottom: 0 }}>
          <button className="btn btn-blue" onClick={guardarPerfil}>Guardar cambios</button>
        </div>
      </div>

      {/* ── Cambiar contraseña ── */}
      <div className="page-card">
        <h3 style={{
          fontSize: 14, fontWeight: 700, marginBottom: 16,
          paddingBottom: 10, borderBottom: '1px solid var(--border)'
        }}>Cambiar contraseña</h3>

        <div className="form-grid">
          <div className="form-group">
            <label>Contraseña actual</label>
            <input
              type="password"
              value={pass.actual}
              onChange={e => setPass(p => ({ ...p, actual: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Nueva contraseña</label>
            <input
              type="password"
              value={pass.nueva}
              onChange={e => setPass(p => ({ ...p, nueva: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Confirmar nueva</label>
            <input
              type="password"
              value={pass.confirmar}
              onChange={e => setPass(p => ({ ...p, confirmar: e.target.value }))}
            />
          </div>
        </div>

        <div className="btn-row" style={{ marginBottom: 0 }}>
          <button className="btn btn-green" onClick={cambiarPassword}>Cambiar contraseña</button>
        </div>
      </div>
    </div>
  )
}
