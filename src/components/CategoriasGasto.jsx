import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import ConfirmDialog from './ui/ConfirmDialog.jsx'

const EMPTY = { nombre: '', orden: 0 }

export default function CategoriasGasto() {
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [confirmData, setConfirmData] = useState(null)

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    const { data } = await supabase.from('categorias_gasto').select('*').order('orden').order('nombre')
    setLista(data || [])
    setLoading(false)
  }

  const guardar = async () => {
    if (!form.nombre.trim()) return setMsg({ type: 'error', text: 'El nombre es obligatorio.' })
    setSaving(true); setMsg(null)
    const payload = { nombre: form.nombre.trim(), orden: parseInt(form.orden) || 0 }
    if (editId) {
      const { error } = await supabase.from('categorias_gasto').update(payload).eq('id', editId)
      setMsg(error ? { type: 'error', text: 'Error al guardar.' } : { type: 'success', text: 'Categoría actualizada.' })
    } else {
      const { error } = await supabase.from('categorias_gasto').insert(payload)
      setMsg(error ? { type: 'error', text: 'Error al guardar.' } : { type: 'success', text: 'Categoría guardada.' })
    }
    setForm(EMPTY); setEditId(null); cargar(); setSaving(false)
  }

  const editar = (c) => {
    setForm({ nombre: c.nombre, orden: c.orden })
    setEditId(c.id); setMsg(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelar = () => { setForm(EMPTY); setEditId(null); setMsg(null) }

  const pedirEliminar = async (c) => {
    const { count } = await supabase.from('gastos').select('*', { count: 'exact', head: true }).eq('categoria_id', c.id)
    setConfirmData({ id: c.id, nombre: c.nombre, soft: (count || 0) > 0 })
  }

  const confirmarEliminar = async () => {
    const { id, soft } = confirmData
    if (soft) await supabase.from('categorias_gasto').update({ activo: false }).eq('id', id)
    else await supabase.from('categorias_gasto').delete().eq('id', id)
    setConfirmData(null)
    setMsg({ type: 'success', text: soft ? 'Categoría desactivada.' : 'Categoría eliminada.' })
    cargar()
  }

  const reactivar = async (id) => {
    await supabase.from('categorias_gasto').update({ activo: true }).eq('id', id)
    cargar()
  }

  return (
    <div>
      <div className="page-card">
        <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>
          {editId ? 'Editar categoría de gasto' : 'Nueva categoría de gasto'}
        </h3>
        {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
        <div className="form-grid-2">
          <div className="form-group">
            <label>Nombre *</label>
            <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Proveedores, Combustible, Insumos..." />
          </div>
          <div className="form-group">
            <label>Orden de visualización</label>
            <input type="number" min="0" value={form.orden} onChange={e => setForm({ ...form, orden: e.target.value })} placeholder="0" />
          </div>
        </div>
        <div className="btn-row">
          <button className="btn btn-green" onClick={guardar} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          {editId && <button className="btn btn-outline" onClick={cancelar}>Cancelar</button>}
        </div>
      </div>

      <div className="table-container">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Nombre</th><th>Orden</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="table-empty">Cargando...</td></tr>
              ) : lista.length === 0 ? (
                <tr><td colSpan={4} className="table-empty">Sin categorías de gasto registradas.</td></tr>
              ) : lista.map(c => (
                <tr key={c.id} style={{ opacity: c.activo ? 1 : 0.6 }}>
                  <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                  <td>{c.orden}</td>
                  <td><span className={`badge badge-${c.activo ? 'green' : 'gray'}`}>{c.activo ? 'Activo' : 'Inactivo'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-blue btn-sm" onClick={() => editar(c)}>Editar</button>
                      {c.activo
                        ? <button className="btn btn-red btn-sm" onClick={() => pedirEliminar(c)}>Eliminar</button>
                        : <button className="btn btn-outline btn-sm" onClick={() => reactivar(c.id)}>Reactivar</button>
                      }
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {confirmData && (
        <ConfirmDialog
          title={confirmData.soft ? 'Desactivar categoría' : 'Eliminar categoría'}
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
