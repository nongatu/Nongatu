import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const EMPTY = { nombre_razon_social: '', cedula: '', ruc: '', direccion: '', telefono: '', email: '' }

export default function Clientes({ user }) {
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [buscar, setBuscar] = useState('')

  const perms = user?.rol === 'Administrador' ? { todo: true } : (user?.permisos || {})
  const puedeEditar = perms.todo || perms.crear_editar_clientes
  const puedeEliminar = perms.todo || perms.eliminar_anular

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    const { data } = await supabase.from('clientes').select('*').order('nombre_razon_social')
    setLista(data || [])
    setLoading(false)
  }

  const guardar = async () => {
    if (!form.nombre_razon_social.trim()) return setMsg({ type: 'error', text: 'El nombre es obligatorio.' })
    setSaving(true)
    setMsg(null)
    try {
      const payload = {
        ...form,
        ultima_modificacion: new Date().toISOString(),
        modificado_por: user?.nombre_usuario,
        ...(editId ? {} : { fecha_alta: new Date().toISOString().split('T')[0], creado_por: user?.id })
      }
      if (editId) {
        await supabase.from('clientes').update(payload).eq('id', editId)
        setMsg({ type: 'success', text: 'Cliente actualizado.' })
      } else {
        await supabase.from('clientes').insert(payload)
        setMsg({ type: 'success', text: 'Cliente guardado.' })
      }
      setForm(EMPTY); setEditId(null); cargar()
    } catch { setMsg({ type: 'error', text: 'Error al guardar.' }) }
    setSaving(false)
  }

  const editar = (c) => {
    setForm({ nombre_razon_social: c.nombre_razon_social || '', cedula: c.cedula || '', ruc: c.ruc || '', direccion: c.direccion || '', telefono: c.telefono || '', email: c.email || '' })
    setEditId(c.id); setMsg(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este cliente? Esta acción no se puede deshacer.')) return
    await supabase.from('clientes').delete().eq('id', id)
    setMsg({ type: 'success', text: 'Cliente eliminado.' }); cargar()
  }

  const cancelar = () => { setForm(EMPTY); setEditId(null); setMsg(null) }

  const filtrados = lista.filter(c =>
    c.nombre_razon_social?.toLowerCase().includes(buscar.toLowerCase()) ||
    c.ruc?.includes(buscar) || c.cedula?.includes(buscar) || c.telefono?.includes(buscar)
  )

  return (
    <div>
      {puedeEditar && (
        <div className="page-card">
          <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>
            {editId ? 'Editar cliente' : 'Nuevo cliente'}
          </h3>
          {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
          <div className="form-grid">
            <div className="form-group">
              <label>Nombre o Razón Social *</label>
              <input value={form.nombre_razon_social} onChange={e => setForm({ ...form, nombre_razon_social: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Cédula</label>
              <input value={form.cedula} onChange={e => setForm({ ...form, cedula: e.target.value })} />
            </div>
            <div className="form-group">
              <label>RUC</label>
              <input value={form.ruc} onChange={e => setForm({ ...form, ruc: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Dirección</label>
              <input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="btn-row">
            <button className="btn btn-green" onClick={guardar} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            {editId && <button className="btn btn-outline" onClick={cancelar}>Cancelar</button>}
          </div>
        </div>
      )}

      <div className="table-container">
        <div style={{ padding: '16px 16px 0' }}>
          <div className="filter-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Buscar</label>
              <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Nombre, RUC, cédula, teléfono..." />
            </div>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Nombre / Razón Social</th><th>RUC</th><th>Cédula</th>
                <th>Teléfono</th><th>Dirección</th><th>Email</th><th>Fecha Alta</th>
                {puedeEditar && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="table-empty">Cargando...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={9} className="table-empty">Sin clientes registrados.</td></tr>
              ) : filtrados.map(c => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td style={{ fontWeight: 600 }}>{c.nombre_razon_social}</td>
                  <td>{c.ruc || '-'}</td>
                  <td>{c.cedula || '-'}</td>
                  <td>{c.telefono || '-'}</td>
                  <td>{c.direccion || '-'}</td>
                  <td>{c.email || '-'}</td>
                  <td>{c.fecha_alta ? new Date(c.fecha_alta).toLocaleDateString('es-PY') : '-'}</td>
                  {puedeEditar && (
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-blue btn-sm" onClick={() => editar(c)}>Editar</button>
                        {puedeEliminar && (
                          <button className="btn btn-red btn-sm" onClick={() => eliminar(c.id)}>Eliminar</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
