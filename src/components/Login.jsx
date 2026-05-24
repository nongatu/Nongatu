import { useState } from 'react'
import { supabase } from '../supabase'

export default function Login({ onLogin }) {
  const [form, setForm] = useState({ usuario: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [logo] = useState(() => localStorage.getItem('nongatu_logo') || null)
  const [showPass, setShowPass] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .from('usuarios')
        .select('*')
        .eq('nombre_usuario', form.usuario.trim())
        .eq('password_hash', form.password)
        .eq('activo', true)
        .single()
      if (err || !data) {
        setError('Usuario o contraseña incorrectos.')
      } else {
        onLogin(data)
      }
    } catch {
      setError('Error de conexión. Verificá tu internet.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">
          {logo
            ? <img src={logo} alt="Ñongatu" style={{ maxWidth: 210, maxHeight: 80, objectFit: 'contain', display: 'block', margin: '0 auto 10px' }} />
            : <h1>ÑONGATU</h1>
          }
          <p>Sistema de gestión de pasturas</p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Usuario</label>
            <input
              value={form.usuario}
              onChange={e => setForm({ ...form, usuario: e.target.value })}
              placeholder="Nombre de usuario"
              autoFocus
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="Contraseña"
                required
                style={{ paddingRight: 72 }}
              />
              <button
                type="button"
                onClick={() => setShowPass(p => !p)}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, padding: '2px 4px' }}
              >{showPass ? 'Ocultar' : 'Mostrar'}</button>
            </div>
          </div>
          <button className="btn btn-blue" style={{ width: '100%', justifyContent: 'center', padding: '11px' }} disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
