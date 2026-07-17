import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import ConfirmDialog from './ui/ConfirmDialog.jsx'

const EMPTY = { nombre_razon_social: '', ruc: '', cedula: '', rubro: '', telefono: '', email: '', direccion: '', observaciones: '' }

export default function Proveedores({ user }) {
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [buscar, setBuscar] = useState('')
  const [confirmData, setConfirmData] = useState(null)

  const perms = user?.rol === 'Administrador' ? { todo: true } : (user?.permisos || {})
  const puedeEditar = perms.todo || perms.crear_gastos
  const puedeEliminar = perms.todo || perms.eliminar_anular

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    const { data } = await supabase.from('proveedores').select('*').order('nombre_razon_social')
    setLista(data || [])
    setLoading(false)
  }

  const guardar = async () => {
    if (!form.nombre_razon_social.trim()) return setMsg({ type: 'error', text: 'El nombre o razón social es obligatorio.' })
    setSaving(true); setMsg(null)
    const payload = {
      nombre_razon_social: form.nombre_razon_social.trim(),
      ruc: form.ruc || null,
      cedula: form.cedula || null,
      rubro: form.rubro || null,
      telefono: form.telefono || null,
      email: form.email || null,
      direccion: form.direccion || null,
      observaciones: form.observaciones || null,
    }
    if (editId) {
      const { error } = await supabase.from('proveedores').update(payload).eq('id', editId)
      setMsg(error ? { type: 'error', text: 'Error al guardar.' } : { type: 'success', text: 'Proveedor actualizado.' })
    } else {
      const { error } = await supabase.from('proveedores').insert(payload)
      setMsg(error ? { type: 'error', text: 'Error al guardar.' } : { type: 'success', text: 'Proveedor guardado.' })
    }
    setForm(EMPTY); setEditId(null); cargar(); setSaving(false)
  }

  const editar = (p) => {
    setForm({
      nombre_razon_social: p.nombre_razon_social || '', ruc: p.ruc || '', cedula: p.cedula || '',
      rubro: p.rubro || '', telefono: p.telefono || '', email: p.email || '',
      direccion: p.direccion || '', observaciones: p.observaciones || '',
    })
    setEditId(p.id); setMsg(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelar = () => { setForm(EMPTY); setEditId(null); setMsg(null) }

  const pedirEliminar = async (p) => {
    const { count } = await supabase.from('gastos').select('*', { count: 'exact', head: true }).eq('proveedor_id', p.id)
    setConfirmData({ id: p.id, nombre: p.nombre_razon_social, soft: (count || 0) > 0 })
  }

  const confirmarEliminar = async () => {
    const { id, soft } = confirmData
    if (soft) await supabase.from('proveedores').update({ activo: false }).eq('id', id)
    else await supabase.from('proveedores').delete().eq('id', id)
    setConfirmData(null)
    setMsg({ type: 'success', text: soft ? 'Proveedor desactivado.' : 'Proveedor eliminado.' })
    cargar()
  }

  const reactivar = async (id) => {
    await supabase.from('proveedores').update({ activo: true }).eq('id', id)
    cargar()
  }

  const filtrados = lista.filter(p =>
    p.nombre_razon_social?.toLowerCase().includes(buscar.toLowerCase()) ||
    p.ruc?.includes(buscar) || p.telefono?.includes(buscar)
  )

  return (
    <div>
      {puedeEditar && (
        <div className="page-card">
          <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>
            {editId ? 'Editar proveedor' : 'Nuevo proveedor'}
          </h3>
          {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
          <div className="form-grid">
            <div className="form-group">
              <label>Nombre o razón social *</label>
              <input value={form.nombre_razon_social} onChange={e => setForm({ ...form, nombre_razon_social: e.target.value })} />
            </div>
            <div className="form-group">
              <label>RUC</label>
              <input value={form.ruc} onChange={e => setForm({ ...form, ruc: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Cédula</label>
              <input value={form.cedula} onChange={e => setForm({ ...form, cedula: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Rubro</label>
              <input value={form.rubro} onChange={e => setForm({ ...form, rubro: e.target.value })} placeholder="Ej: Insumos, Combustible..." />
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Dirección</label>
              <input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Observaciones</label>
              <input value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} placeholder="Opcional" />
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
              <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Nombre, RUC o teléfono..." />
            </div>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nombre / Razón social</th><th>Rubro</th><th>RUC</th><th>Teléfono</th><th>Dirección</th>
                <th>Estado</th>
                {puedeEditar && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="table-empty">Cargando...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={7} className="table-empty">Sin proveedores registrados.</td></tr>
              ) : filtrados.map(p => (
                <tr key={p.id} style={{ opacity: p.activo ? 1 : 0.6 }}>
                  <td style={{ fontWeight: 600 }}>{p.nombre_razon_social}</td>
                  <td>{p.rubro || '-'}</td>
                  <td>{p.ruc || '-'}</td>
                  <td>{p.telefono || '-'}</td>
                  <td>{p.direccion || '-'}</td>
                  <td><span className={`badge badge-${p.activo ? 'green' : 'gray'}`}>{p.activo ? 'Activo' : 'Inactivo'}</span></td>
                  {puedeEditar && (
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-blue btn-sm" onClick={() => editar(p)}>Editar</button>
                        {p.activo
                          ? (puedeEliminar && <button className="btn btn-red btn-sm" onClick={() => pedirEliminar(p)}>Eliminar</button>)
                          : <button className="btn btn-outline btn-sm" onClick={() => reactivar(p.id)}>Reactivar</button>
                        }
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {confirmData && (
        <ConfirmDialog
          title={confirmData.soft ? 'Desactivar proveedor' : 'Eliminar proveedor'}
          message={
            confirmData.soft
              ? `"${confirmData.nombre}" ya tiene gastos registrados: no se puede borrar del todo. Se va a desactivar (no aparecerá para nuevos gastos, pero se conserva el historial).`
              : `¿Eliminar "${confirmData.nombre}" definitivamente? No tiene gastos registrados.`
          }
          confirmText={confirmData.soft ? 'Desactivar' : 'Eliminar'}
          danger={!confirmData.soft}
          onConfirm={confirmarEliminar}
          onCancel={() => setConfirmData(null)}
        />
      )}
    </div>
  )
}
