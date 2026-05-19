import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const PERMS_KEYS = [
  { key: 'ver_clientes', label: 'Ver Clientes' },
  { key: 'ver_animales', label: 'Ver Animales' },
  { key: 'ver_cobros', label: 'Ver Cobros' },
  { key: 'ver_reportes', label: 'Ver Reportes' },
  { key: 'crear_editar_clientes', label: 'Crear / Editar Clientes' },
  { key: 'registrar_animales', label: 'Registrar Animales' },
  { key: 'generar_cobros', label: 'Generar Cobros' },
  { key: 'registrar_pagos', label: 'Registrar Pagos' },
  { key: 'eliminar_anular', label: 'Eliminar / Anular Registros' },
  { key: 'exportar_pdf', label: 'Exportar PDF' },
  { key: 'exportar_csv', label: 'Exportar CSV' },
]

const EMPTY = { nombre_usuario: '', password_hash: '', rol: 'Usuario', activo: true, permisos: {} }

export default function Usuarios({ user }) {
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  if (user?.rol !== 'Administrador') {
    return <div className="page-card" style={{ color: 'var(--text-secondary)' }}>Solo los administradores pueden gestionar usuarios.</div>
  }

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    const { data } = await supabase.from('usuarios').select('id,nombre_usuario,rol,activo,fecha_creacion,permisos').order('fecha_creacion')
    setLista(data || [])
    setLoading(false)
  }

  const abrirNuevo = () => {
    setForm(EMPTY); setEditId(null); setMsg(null); setModal(true)
  }

  const abrirEditar = (u) => {
    setForm({ nombre_usuario: u.nombre_usuario, password_hash: '', rol: u.rol, activo: u.activo, permisos: u.permisos || {} })
    setEditId(u.id); setMsg(null); setModal(true)
  }

  const togglePerm = (key) => {
    setForm(f => ({ ...f, permisos: { ...f.permisos, [key]: !f.permisos[key] } }))
  }

  const marcarTodo = (val) => {
    const permisos = {}
    PERMS_KEYS.forEach(p => { permisos[p.key] = val })
    setForm(f => ({ ...f, permisos }))
  }

  const guardar = async () => {
    if (!form.nombre_usuario.trim()) return setMsg({ type: 'error', text: 'El nombre de usuario es obligatorio.' })
    if (!editId && !form.password_hash.trim()) return setMsg({ type: 'error', text: 'La contraseña es obligatoria.' })
    setSaving(true); setMsg(null)
    try {
      const payload = { nombre_usuario: form.nombre_usuario, rol: form.rol, activo: form.activo, permisos: form.permisos }
      if (form.password_hash.trim()) payload.password_hash = form.password_hash
      if (editId) {
        await supabase.from('usuarios').update(payload).eq('id', editId)
      } else {
        await supabase.from('usuarios').insert({ ...payload, fecha_creacion: new Date().toISOString() })
      }
      setModal(false); cargar()
    } catch { setMsg({ type: 'error', text: 'Error al guardar.' }) }
    setSaving(false)
  }

  const eliminar = async (id) => {
    if (id === user?.id) return alert('No podés eliminar tu propio usuario.')
    if (!confirm('¿Eliminar este usuario?')) return
    await supabase.from('usuarios').delete().eq('id', id)
    cargar()
  }

  return (
    <div>
      <div className="section-header">
        <h2>Gestión de usuarios</h2>
        <button className="btn btn-blue" onClick={abrirNuevo}>+ Nuevo usuario</button>
      </div>

      <div className="table-container">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>ID</th><th>Usuario</th><th>Rol</th><th>Activo</th><th>Fecha creación</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="table-empty">Cargando...</td></tr>
              ) : lista.map(u => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td style={{ fontWeight: 600 }}>{u.nombre_usuario}</td>
                  <td><span className={`badge badge-${u.rol === 'Administrador' ? 'blue' : 'gray'}`}>{u.rol}</span></td>
                  <td><span className={`badge badge-${u.activo ? 'green' : 'red'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span></td>
                  <td>{u.fecha_creacion ? new Date(u.fecha_creacion).toLocaleDateString('es-PY') : '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-blue btn-sm" onClick={() => abrirEditar(u)}>Editar</button>
                      {u.id !== user?.id && <button className="btn btn-red btn-sm" onClick={() => eliminar(u.id)}>Eliminar</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <h3>{editId ? 'Editar usuario' : 'Nuevo usuario'}</h3>
            {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
            <div className="form-grid-2">
              <div className="form-group">
                <label>Nombre de usuario *</label>
                <input value={form.nombre_usuario} onChange={e => setForm({ ...form, nombre_usuario: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Contraseña {editId ? '(dejar vacío para no cambiar)' : '*'}</label>
                <input type="password" value={form.password_hash} onChange={e => setForm({ ...form, password_hash: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Rol *</label>
                <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
                  <option value="Administrador">Administrador</option>
                  <option value="Usuario">Usuario</option>
                </select>
              </div>
              <div className="form-group">
                <label>Estado</label>
                <select value={form.activo} onChange={e => setForm({ ...form, activo: e.target.value === 'true' })}>
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </div>
            </div>

            {form.rol !== 'Administrador' && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Permisos del usuario</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {PERMS_KEYS.map(p => (
                    <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                      <input type="checkbox" checked={!!form.permisos[p.key]} onChange={() => togglePerm(p.key)} />
                      {p.label}
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => marcarTodo(true)}>Marcar todo</button>
                  <button className="btn btn-outline btn-sm" onClick={() => marcarTodo(false)}>Desmarcar todo</button>
                </div>
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-green" onClick={guardar} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
