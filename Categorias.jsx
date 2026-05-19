import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'

const EMPTY = { nombre: '', especie_id: 1, cobrable: true, orden: 0 }

export default function Categorias({ user }) {
  const [categorias, setCategorias] = useState([])
  const [especies, setEspecies] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [modalEspecie, setModalEspecie] = useState(false)
  const [nuevaEspecie, setNuevaEspecie] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const esAdmin = user?.rol === 'Administrador'

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    const [{ data: cats }, { data: esp }] = await Promise.all([
      supabase.from('categorias').select('*, especies(nombre)').order('especie_id').order('orden'),
      supabase.from('especies').select('*').order('nombre'),
    ])
    setCategorias(cats || [])
    setEspecies(esp || [])
    setLoading(false)
  }

  const guardar = async () => {
    if (!form.nombre.trim()) return setMsg({ type: 'error', text: 'El nombre es obligatorio.' })
    setSaving(true); setMsg(null)
    const payload = { nombre: form.nombre.trim(), especie_id: parseInt(form.especie_id), cobrable: form.cobrable, orden: parseInt(form.orden) || 0 }
    if (editId) {
      await supabase.from('categorias').update(payload).eq('id', editId)
      setMsg({ type: 'success', text: 'Categoría actualizada.' })
    } else {
      await supabase.from('categorias').insert(payload)
      setMsg({ type: 'success', text: 'Categoría guardada.' })
    }
    setForm(EMPTY); setEditId(null); cargar(); setSaving(false)
  }

  const editar = (c) => {
    setForm({ nombre: c.nombre, especie_id: c.especie_id, cobrable: c.cobrable, orden: c.orden })
    setEditId(c.id); setMsg(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar esta categoría? Solo podés eliminarla si no tiene animales registrados.')) return
    const { error } = await supabase.from('categorias').delete().eq('id', id)
    if (error) {
      setMsg({ type: 'error', text: 'No se puede eliminar: tiene animales registrados.' })
    } else {
      setMsg({ type: 'success', text: 'Categoría eliminada.' }); cargar()
    }
  }

  const cancelar = () => { setForm(EMPTY); setEditId(null); setMsg(null) }

  const guardarEspecie = async () => {
    if (!nuevaEspecie.trim()) return
    await supabase.from('especies').insert({ nombre: nuevaEspecie.trim() })
    setNuevaEspecie(''); setModalEspecie(false); cargar()
  }

  const eliminarEspecie = async (id) => {
    if (!confirm('¿Eliminar esta especie? Solo si no tiene categorías asociadas.')) return
    const { error } = await supabase.from('especies').delete().eq('id', id)
    if (error) setMsg({ type: 'error', text: 'No se puede eliminar: tiene categorías asociadas.' })
    else cargar()
  }

  const porEspecie = especies.map(e => ({
    ...e,
    cats: categorias.filter(c => c.especie_id === e.id)
  }))

  return (
    <div>
      {esAdmin && (
        <div className="page-card">
          <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>
            {editId ? 'Editar categoría' : 'Nueva categoría'}
          </h3>
          {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
          <div className="form-grid">
            <div className="form-group">
              <label>Nombre de la categoría *</label>
              <input
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Vaca, Oveja, Yegua..."
              />
            </div>
            <div className="form-group">
              <label>Especie *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={form.especie_id}
                  onChange={e => setForm({ ...form, especie_id: e.target.value })}
                  style={{ flex: 1 }}
                >
                  {especies.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
                <button className="btn btn-outline btn-sm" onClick={() => setModalEspecie(true)} title="Nueva especie">+</button>
              </div>
            </div>
            <div className="form-group">
              <label>¿Se cobra?</label>
              <select value={form.cobrable} onChange={e => setForm({ ...form, cobrable: e.target.value === 'true' })}>
                <option value="true">Sí (se incluye en cobros)</option>
                <option value="false">No (solo se registra)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Orden de visualización</label>
              <input
                type="number"
                min="0"
                value={form.orden}
                onChange={e => setForm({ ...form, orden: e.target.value })}
                placeholder="0"
              />
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

      {/* Lista por especie */}
      {loading ? <div className="spinner" /> : porEspecie.map(esp => (
        <div key={esp.id} className="table-container" style={{ marginBottom: 20 }}>
          <div style={{ padding: '14px 16px', background: 'var(--sidebar-bg)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '10px 10px 0 0' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{esp.nombre}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, opacity: 0.7 }}>{esp.cats.length} categorías</span>
              {esAdmin && (
                <button className="btn btn-red btn-sm" onClick={() => eliminarEspecie(esp.id)}>Eliminar especie</button>
              )}
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Se cobra</th>
                  <th>Orden</th>
                  {esAdmin && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {esp.cats.length === 0 ? (
                  <tr><td colSpan={5} className="table-empty">Sin categorías para esta especie.</td></tr>
                ) : esp.cats.map(c => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                    <td>
                      <span className={`badge badge-${c.cobrable ? 'green' : 'gray'}`}>
                        {c.cobrable ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td>{c.orden}</td>
                    {esAdmin && (
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-blue btn-sm" onClick={() => editar(c)}>Editar</button>
                          <button className="btn btn-red btn-sm" onClick={() => eliminar(c.id)}>Eliminar</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Modal nueva especie */}
      {modalEspecie && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Nueva especie</h3>
            <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 14 }}>
              Por ejemplo: Bovinos, Ovinos, Equinos, Porcinos...
            </p>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>Nombre de la especie *</label>
              <input
                value={nuevaEspecie}
                onChange={e => setNuevaEspecie(e.target.value)}
                placeholder="Ej: Ovinos"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && guardarEspecie()}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => { setModalEspecie(false); setNuevaEspecie('') }}>Cancelar</button>
              <button className="btn btn-green" onClick={guardarEspecie}>Guardar especie</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
