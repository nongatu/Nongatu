import { useState, useRef } from 'react'
import { supabase } from '../supabase'

const PERFIL_VACIO = { nombre: '', segundo_nombre: '', apellido: '', apodo: '', telefono: '', email: '' }

function cargarPerfil(username) {
  try {
    const saved = localStorage.getItem(`profile_data_${username}`)
    if (saved) {
      const p = JSON.parse(saved)
      // Migración: si tenía nombre_completo pero no tiene los nuevos campos, ignorar (que llene de nuevo)
      return {
        nombre:         p.nombre         ?? '',
        segundo_nombre: p.segundo_nombre ?? '',
        apellido:       p.apellido       ?? '',
        apodo:          p.apodo          ?? '',
        telefono:       p.telefono       ?? '',
        email:          p.email          ?? '',
      }
    }
  } catch {}
  return { ...PERFIL_VACIO }
}

export default function Perfil({ user, onUpdateUser }) {
  const [foto, setFoto] = useState(() =>
    user?.foto_url || localStorage.getItem(`profile_photo_${user?.nombre_usuario}`) || null
  )
  const [uploading, setUploading] = useState(false)
  const [perfil, setPerfil] = useState(() => cargarPerfil(user?.nombre_usuario))
  const [pass,     setPass]    = useState({ actual: '', nueva: '', confirmar: '' })
  const [showPass, setShowPass]= useState({ actual: false, nueva: false, confirmar: false })
  const [msg,    setMsg]    = useState(null)
  const fileRef             = useRef()

  const showMsg = (type, text) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3500)
  }

  const set = (field) => (e) => setPerfil(p => ({ ...p, [field]: e.target.value }))

  // ── Nombre para mostrar ───────────────────────────────────────────────────
  const nombreMostrar = perfil.apodo?.trim()
    || perfil.nombre?.trim()
    || user?.nombre_usuario
    || '?'

  const nombreCompleto = [perfil.nombre, perfil.segundo_nombre, perfil.apellido]
    .filter(Boolean).join(' ') || user?.nombre_usuario

  const initial = nombreMostrar.charAt(0).toUpperCase()

  // ── Foto ──────────────────────────────────────────────────────────────────
  const handleFoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
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
        canvas.toBlob(async (blob) => {
          const fileName = `${user.id}_${Date.now()}.jpg`
          const { error: upErr } = await supabase.storage
            .from('avatars')
            .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true })
          if (upErr) {
            showMsg('error', 'Error al subir la foto. Verificá que el bucket "avatars" esté creado en Supabase.')
            setUploading(false)
            return
          }
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName)
          await supabase.from('usuarios').update({ foto_url: publicUrl }).eq('id', user.id)
          setFoto(publicUrl)
          localStorage.setItem(`profile_photo_${user?.nombre_usuario}`, publicUrl)
          if (onUpdateUser) onUpdateUser({ ...user, foto_url: publicUrl })
          showMsg('success', 'Foto actualizada. Ya se verá en todos los dispositivos.')
          setUploading(false)
        }, 'image/jpeg', 0.82)
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }

  const eliminarFoto = async () => {
    await supabase.from('usuarios').update({ foto_url: null }).eq('id', user.id)
    localStorage.removeItem(`profile_photo_${user?.nombre_usuario}`)
    if (onUpdateUser) onUpdateUser({ ...user, foto_url: null })
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
      .from('usuarios').select('password_hash').eq('id', user.id).single()

    if (fetchErr || !data) return showMsg('error', 'Error al verificar usuario.')
    if (data.password_hash !== pass.actual) return showMsg('error', 'La contraseña actual no es correcta.')

    const { error } = await supabase.from('usuarios').update({ password_hash: pass.nueva }).eq('id', user.id)
    if (error) return showMsg('error', 'Error al guardar la nueva contraseña.')
    setPass({ actual: '', nueva: '', confirmar: '' })
    showMsg('success', 'Contraseña cambiada correctamente.')
  }

  return (
    <div style={{ maxWidth: 580, margin: '0 auto' }}>
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
              overflow: 'hidden', border: '3px solid var(--border)', cursor: 'pointer',
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
              border: '2px solid var(--card-bg)', fontSize: 13,
            }}
            onClick={() => fileRef.current?.click()}
          >✏️</div>
        </div>

        <div style={{ flex: 1 }}>
          {/* Nombre de pila grande */}
          <div style={{ fontWeight: 700, fontSize: 20 }}>{nombreMostrar}</div>
          {/* Nombre completo si difiere */}
          {perfil.apodo?.trim() && nombreCompleto && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 1 }}>{nombreCompleto}</div>
          )}
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
            @{user?.nombre_usuario} · {user?.rol}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-blue btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Subiendo...' : 'Cambiar foto'}
            </button>
            {foto && (
              <button className="btn btn-outline btn-sm" onClick={eliminarFoto}>Quitar</button>
            )}
          </div>
        </div>

        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFoto} />
      </div>

      {/* ── Datos personales ── */}
      <div className="page-card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
          Datos personales
        </h3>

        <div className="form-grid">
          {/* Usuario + Rol (readonly) */}
          <div className="form-group">
            <label>Usuario del sistema</label>
            <input value={user?.nombre_usuario || ''} disabled
              style={{ background: 'var(--table-head)', color: 'var(--text-secondary)' }} />
          </div>
          <div className="form-group">
            <label>Rol</label>
            <input value={user?.rol || ''} disabled
              style={{ background: 'var(--table-head)', color: 'var(--text-secondary)' }} />
          </div>

          {/* Nombre, Segundo Nombre, Apellido */}
          <div className="form-group">
            <label>Primer nombre *</label>
            <input
              value={perfil.nombre}
              onChange={set('nombre')}
              placeholder="Ej: Dahiana"
            />
          </div>
          <div className="form-group">
            <label>Segundo nombre</label>
            <input
              value={perfil.segundo_nombre}
              onChange={set('segundo_nombre')}
              placeholder="Opcional"
            />
          </div>
          <div className="form-group">
            <label>Apellido</label>
            <input
              value={perfil.apellido}
              onChange={set('apellido')}
              placeholder="Ej: Krause"
            />
          </div>

          {/* Apodo */}
          <div className="form-group">
            <label>Apodo</label>
            <input
              value={perfil.apodo}
              onChange={set('apodo')}
              placeholder="Ej: Didi"
            />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              {perfil.apodo?.trim()
                ? <>El dashboard te saludará: <strong>"Bienvenida a Ñongatu, {perfil.apodo.trim()}"</strong></>
                : perfil.nombre?.trim()
                  ? <>Sin apodo, el saludo usará tu primer nombre: <strong>"{perfil.nombre.trim()}"</strong></>
                  : 'Si lo dejás vacío, se usará tu primer nombre. Si tampoco, tu usuario.'
              }
            </div>
          </div>

          {/* Teléfono + Email */}
          <div className="form-group">
            <label>Teléfono</label>
            <input value={perfil.telefono} onChange={set('telefono')} placeholder="Ej: 0981 123 456" />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label>Email</label>
            <input type="email" value={perfil.email} onChange={set('email')} placeholder="correo@ejemplo.com" />
          </div>
        </div>

        <div className="btn-row" style={{ marginBottom: 0 }}>
          <button className="btn btn-blue" onClick={guardarPerfil}>Guardar cambios</button>
        </div>
      </div>

      {/* ── Cambiar contraseña ── */}
      <div className="page-card">
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
          Cambiar contraseña
        </h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Contraseña actual</label>
            <div style={{ position: 'relative' }}>
              <input type={showPass.actual ? 'text' : 'password'} value={pass.actual}
                onChange={e => setPass(p => ({ ...p, actual: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && cambiarPassword()}
                style={{ paddingRight: 72 }} />
              <button type="button" onClick={() => setShowPass(p => ({ ...p, actual: !p.actual }))}
                style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:11, color:'var(--text-secondary)', fontWeight:600, padding:'2px 4px' }}>
                {showPass.actual ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>Nueva contraseña</label>
            <div style={{ position: 'relative' }}>
              <input type={showPass.nueva ? 'text' : 'password'} value={pass.nueva}
                onChange={e => setPass(p => ({ ...p, nueva: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && cambiarPassword()}
                style={{ paddingRight: 72 }} />
              <button type="button" onClick={() => setShowPass(p => ({ ...p, nueva: !p.nueva }))}
                style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:11, color:'var(--text-secondary)', fontWeight:600, padding:'2px 4px' }}>
                {showPass.nueva ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>Confirmar nueva</label>
            <div style={{ position: 'relative' }}>
              <input type={showPass.confirmar ? 'text' : 'password'} value={pass.confirmar}
                onChange={e => setPass(p => ({ ...p, confirmar: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && cambiarPassword()}
                style={{ paddingRight: 72 }} />
              <button type="button" onClick={() => setShowPass(p => ({ ...p, confirmar: !p.confirmar }))}
                style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:11, color:'var(--text-secondary)', fontWeight:600, padding:'2px 4px' }}>
                {showPass.confirmar ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>
        </div>
        <div className="btn-row" style={{ marginBottom: 0 }}>
          <button className="btn btn-green" onClick={cambiarPassword}>Cambiar contraseña</button>
        </div>
      </div>
    </div>
  )
}
