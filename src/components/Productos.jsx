import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { gs } from '../utils/helpers'
import ConfirmDialog from './ui/ConfirmDialog.jsx'

const UNIDADES = ['unidad', 'docena', 'kg', 'litro', 'frasco']

const EMPTY = { nombre: '', unidad: 'unidad', precio: '', controla_stock: true, stock_minimo: '', orden: 0 }

export default function Productos() {
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
    const { data } = await supabase.from('productos').select('*').order('orden').order('nombre')
    setLista(data || [])
    setLoading(false)
  }

  const guardar = async () => {
    if (!form.nombre.trim()) return setMsg({ type: 'error', text: 'El nombre es obligatorio.' })
    setSaving(true); setMsg(null)
    const payload = {
      nombre: form.nombre.trim(),
      unidad: form.unidad,
      precio: Number(form.precio) || 0,
      controla_stock: form.controla_stock,
      stock_minimo: Number(form.stock_minimo) || 0,
      orden: parseInt(form.orden) || 0,
    }
    if (editId) {
      const { error } = await supabase.from('productos').update(payload).eq('id', editId)
      setMsg(error ? { type: 'error', text: 'Error al guardar.' } : { type: 'success', text: 'Producto actualizado.' })
    } else {
      const { error } = await supabase.from('productos').insert(payload)
      setMsg(error ? { type: 'error', text: 'Error al guardar.' } : { type: 'success', text: 'Producto guardado.' })
    }
    setForm(EMPTY); setEditId(null); cargar(); setSaving(false)
  }

  const editar = (p) => {
    setForm({
      nombre: p.nombre, unidad: p.unidad, precio: p.precio, controla_stock: p.controla_stock,
      stock_minimo: p.stock_minimo, orden: p.orden,
    })
    setEditId(p.id); setMsg(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelar = () => { setForm(EMPTY); setEditId(null); setMsg(null) }

  const pedirEliminar = async (p) => {
    const [{ count: c1 }, { count: c2 }] = await Promise.all([
      supabase.from('venta_items').select('*', { count: 'exact', head: true }).eq('producto_id', p.id),
      supabase.from('stock_movimientos').select('*', { count: 'exact', head: true }).eq('producto_id', p.id),
    ])
    const usado = (c1 || 0) > 0 || (c2 || 0) > 0
    setConfirmData({ id: p.id, nombre: p.nombre, soft: usado })
  }

  const confirmarEliminar = async () => {
    const { id, soft } = confirmData
    if (soft) await supabase.from('productos').update({ activo: false }).eq('id', id)
    else await supabase.from('productos').delete().eq('id', id)
    setConfirmData(null)
    setMsg({ type: 'success', text: soft ? 'Producto desactivado.' : 'Producto eliminado.' })
    cargar()
  }

  const reactivar = async (id) => {
    await supabase.from('productos').update({ activo: true }).eq('id', id)
    cargar()
  }

  return (
    <div>
      <div className="page-card">
        <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>
          {editId ? 'Editar producto' : 'Nuevo producto'}
        </h3>
        {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
        <div className="form-grid">
          <div className="form-group">
            <label>Nombre *</label>
            <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Huevos, Queso, Pepinillos..." />
          </div>
          <div className="form-group">
            <label>Unidad</label>
            <select value={form.unidad} onChange={e => setForm({ ...form, unidad: e.target.value })}>
              {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Precio (Gs.)</label>
            <input type="number" min="0" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} placeholder="0" />
          </div>
          <div className="form-group">
            <label>¿Controla stock?</label>
            <select value={form.controla_stock} onChange={e => setForm({ ...form, controla_stock: e.target.value === 'true' })}>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </div>
          <div className="form-group">
            <label>Stock mínimo</label>
            <input type="number" min="0" value={form.stock_minimo} onChange={e => setForm({ ...form, stock_minimo: e.target.value })} placeholder="0" disabled={!form.controla_stock} />
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
              <tr>
                <th>Producto</th><th>Unidad</th><th>Precio</th><th>Controla stock</th>
                <th>Stock actual</th><th>Stock mínimo</th><th>Orden</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="table-empty">Cargando...</td></tr>
              ) : lista.length === 0 ? (
                <tr><td colSpan={9} className="table-empty">Sin productos registrados.</td></tr>
              ) : lista.map(p => (
                <tr key={p.id} style={{ opacity: p.activo ? 1 : 0.6 }}>
                  <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                  <td>{p.unidad}</td>
                  <td>{gs(p.precio)} Gs.</td>
                  <td><span className={`badge badge-${p.controla_stock ? 'green' : 'gray'}`}>{p.controla_stock ? 'Sí' : 'No'}</span></td>
                  <td>{p.controla_stock ? p.stock_actual : '—'}</td>
                  <td>{p.controla_stock ? p.stock_minimo : '—'}</td>
                  <td>{p.orden}</td>
                  <td><span className={`badge badge-${p.activo ? 'green' : 'gray'}`}>{p.activo ? 'Activo' : 'Inactivo'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-blue btn-sm" onClick={() => editar(p)}>Editar</button>
                      {p.activo
                        ? <button className="btn btn-red btn-sm" onClick={() => pedirEliminar(p)}>Eliminar</button>
                        : <button className="btn btn-outline btn-sm" onClick={() => reactivar(p.id)}>Reactivar</button>
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
          title={confirmData.soft ? 'Desactivar producto' : 'Eliminar producto'}
          message={
            confirmData.soft
              ? `"${confirmData.nombre}" ya tiene ventas o movimientos de stock registrados: no se puede borrar del todo. Se va a desactivar (no aparecerá para nuevas ventas, pero se conserva el historial).`
              : `¿Eliminar "${confirmData.nombre}" definitivamente? No tiene ventas ni movimientos registrados.`
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
