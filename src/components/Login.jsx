import { useState } from 'react'
import { supabase } from '../supabase'

export default function Login({ onLogin }) {
  const [form, setForm] = useState({ usuario: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
          <h1>ÑONGATU</h1>
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
            <input
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Contraseña"
              required
            />
          </div>
          <button className="btn btn-blue" style={{ width: '100%', justifyContent: 'center', padding: '11px' }} disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
