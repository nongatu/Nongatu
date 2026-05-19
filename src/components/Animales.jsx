import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase.js'
import { gs, diasDesde } from '../utils/helpers.js'
import SearchSelect from './SearchSelect.jsx'

const CAUSAS = ['Enfermedad', 'Picadura de víbora', 'Otro']

export default function Animales({ user }) {
  const [clientes, setClientes] = useState([])
  const [categorias, setCategorias] = useState([])
  const [animales, setAnimales] = useState([])
  const [clienteSelec, setClienteSelec] = useState('')
  const [form, setForm] = useState({ categoria_id: '', cantidad: '', fecha_ingreso: new Date().toISOString().split('T')[0], precio: '', observaciones: '' })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [modal, setModal] = useState(null)
  const [modalForm, setModalForm] = useState({})

  const perms = user?.rol === 'Administrador' ? { todo: true } : (user?.permisos || {})
  const puedeRegistrar = perms.todo || perms.registrar_animales
  const puedeEliminar = perms.todo || perms.eliminar_anular

  useEffect(() => {
    supabase.from('clientes').select('id,nombre_razon_social,ruc,cedula').order('nombre_razon_social').then(({ data }) => setClientes(data || []))
    supabase.from('categorias').select('*').order('orden').then(({ data }) => setCategorias(data || []))
  }, [])

  const cargarAnimales = useCallback(async () => {
    if (!clienteSelec) { setAnimales([]); return }
    setLoading(true)
    const { data } = await supabase.from('animales')
      .select('*, categorias(nombre,cobrable), usuarios(nombre_usuario)')
      .eq('cliente_id', clienteSelec).eq('estado', 'activo')
      .order('id', { ascending: false })
    setAnimales(data || [])
    setLoading(false)
  }, [clienteSelec])

  useEffect(() => { cargarAnimales() }, [cargarAnimales])

  const clienteOpts = clientes.map(c => ({
    value: c.id,
    label: c.nombre_razon_social,
    sublabel: [c.ruc ? `RUC: ${c.ruc}` : '', c.cedula ? `CI: ${c.cedula}` : ''].filter(Boolean).join(' · '),
    searchText: `${c.nombre_razon_social} ${c.ruc || ''} ${c.cedula || ''}`,
  }))

  const catOpts = categorias.map(c => ({
    value: c.id,
    label: c.nombre,
    searchText: c.nombre,
  }))

  const catOptsFromIds = (ids) => categorias.filter(c => (ids || []).includes(c.id)).map(c => ({
    value: c.id,
    label: c.nombre,
    searchText: c.nombre,
  }))

  const guardar = async () => {
    if (!clienteSelec) return setMsg({ type: 'error', text: 'Seleccioná un cliente.' })
    if (!form.categoria_id || !form.cantidad || !form.fecha_ingreso) return setMsg({ type: 'error', text: 'Completá los campos obligatorios.' })
    setSaving(true); setMsg(null)
    await supabase.from('animales').insert({
      cliente_id: parseInt(clienteSelec),
      categoria_id: parseInt(form.categoria_id),
      cantidad: parseInt(form.cantidad),
      fecha_ingreso: form.fecha_ingreso,
      precio: parseInt(form.precio) || 0,
      observaciones: form.observaciones,
      estado: 'activo',
      usuario_id: user?.id,
      fecha_registro: new Date().toISOString(),
    })
    setForm({ categoria_id: '', cantidad: '', fecha_ingreso: new Date().toISOString().split('T')[0], precio: '', observaciones: '' })
    setMsg({ type: 'success', text: 'Animal registrado correctamente.' })
    cargarAnimales(); setSaving(false)
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este registro?')) return
    await supabase.from('animales').delete().eq('id', id)
    cargarAnimales()
  }

  const abrirSalida = () => {
    const cats = [...new Set(animales.map(a => a.categoria_id))]
    setModalForm({ categoria_id: '', cantidad: 1, cats })
    setModal('salida')
  }

  const registrarSalida = async () => {
    const { categoria_id, cantidad } = modalForm
    if (!categoria_id || !cantidad) return
    const registros = animales.filter(a => a.categoria_id === parseInt(categoria_id))
    const totalDisp = registros.reduce((s, a) => s + a.cantidad, 0)
    if (parseInt(cantidad) > totalDisp) return alert(`Solo hay ${totalDisp} animales de esa categoría.`)
    let restante = parseInt(cantidad)
    for (const r of registros) {
      if (restante <= 0) break
      const q = Math.min(r.cantidad, restante)
      if (q === r.cantidad) {
        await supabase.from('animales').update({ estado: 'vendido' }).eq('id', r.id)
      } else {
        await supabase.from('animales').update({ cantidad: r.cantidad - q }).eq('id', r.id)
        await supabase.from('animales').insert({ ...r, id: undefined, cantidad: q, estado: 'vendido', created_at: undefined })
      }
      await supabase.from('movimientos').insert({ animal_id: r.id, cliente_id: parseInt(clienteSelec), tipo: 'salida', categoria_anterior_id: r.categoria_id, cantidad: q, usuario_id: user?.id, fecha: new Date().toISOString() })
      restante -= q
    }
    setModal(null); cargarAnimales()
  }

  const abrirBaja = () => {
    const cats = [...new Set(animales.map(a => a.categoria_id))]
    setModalForm({ categoria_id: '', cantidad: 1, causa: '', observacion: '', cats })
    setModal('baja')
  }

  const registrarBaja = async () => {
    const { categoria_id, cantidad, causa, observacion } = modalForm
    if (!categoria_id || !cantidad || !causa) return
    const registros = animales.filter(a => a.categoria_id === parseInt(categoria_id))
    const totalDisp = registros.reduce((s, a) => s + a.cantidad, 0)
    if (parseInt(cantidad) > totalDisp) return alert(`Solo hay ${totalDisp} animales de esa categoría.`)
    let restante = parseInt(cantidad)
    for (const r of registros) {
      if (restante <= 0) break
      const q = Math.min(r.cantidad, restante)
      if (q === r.cantidad) {
        await supabase.from('animales').update({ estado: 'baja' }).eq('id', r.id)
      } else {
        await supabase.from('animales').update({ cantidad: r.cantidad - q }).eq('id', r.id)
        await supabase.from('animales').insert({ ...r, id: undefined, cantidad: q, estado: 'baja', created_at: undefined })
      }
      await supabase.from('movimientos').insert({ animal_id: r.id, cliente_id: parseInt(clienteSelec), tipo: 'baja', categoria_anterior_id: r.categoria_id, cantidad: q, causa, observacion: causa === 'Otro' ? observacion : null, usuario_id: user?.id, fecha: new Date().toISOString() })
      restante -= q
    }
    setModal(null); cargarAnimales()
  }

  const abrirReclasificar = (animal) => {
    setModalForm({ animal, nueva_categoria_id: '', nuevo_precio: animal.precio })
    setModal('reclasificar')
  }

  const registrarReclasificacion = async () => {
    const { animal, nueva_categoria_id, nuevo_precio } = modalForm
    if (!nueva_categoria_id) return
    await supabase.from('animales').update({ categoria_id: parseInt(nueva_categoria_id), precio: parseInt(nuevo_precio) || 0 }).eq('id', animal.id)
    await supabase.from('movimientos').insert({ animal_id: animal.id, cliente_id: parseInt(clienteSelec), tipo: 'reclasificacion', categoria_anterior_id: animal.categoria_id, categoria_nueva_id: parseInt(nueva_categoria_id), cantidad: animal.cantidad, precio_nuevo: parseInt(nuevo_precio) || 0, usuario_id: user?.id, fecha: new Date().toISOString() })
    setModal(null); cargarAnimales()
  }

  const resumen = {}
  animales.forEach(a => {
    const n = a.categorias?.nombre || '?'
    resumen[n] = (resumen[n] || 0) + a.cantidad
  })
  const totalAnimales = animales.reduce((s, a) => s + a.cantidad, 0)
  const gravada = animales.filter(a => a.categorias?.cobrable).reduce((s, a) => s + (a.cantidad * Number(a.precio)), 0)
  const iva = Math.round(gravada * 0.1)
  const total = gravada + iva

  const catReclasOpts = modalForm.animal
    ? categorias.filter(c => c.id !== modalForm.animal?.categoria_id).map(c => ({ value: c.id, label: c.nombre, searchText: c.nombre }))
    : []

  return (
    <div>
      {puedeRegistrar && (
        <div className="page-card">
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Cliente *</label>
              <SearchSelect
                options={clienteOpts}
                value={clienteSelec}
                onChange={setClienteSelec}
                placeholder="Buscar por nombre, RUC o cédula..."
              />
            </div>
            <div className="form-group">
              <label>Categoría *</label>
              <SearchSelect
                options={catOpts}
                value={form.categoria_id}
                onChange={v => setForm({ ...form, categoria_id: v })}
                placeholder="Buscar categoría..."
              />
            </div>
            <div className="form-group">
              <label>Cantidad *</label>
              <input type="number" min="1" value={form.cantidad} onChange={e => setForm({ ...form, cantidad: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Fecha de ingreso *</label>
              <input type="date" value={form.fecha_ingreso} onChange={e => setForm({ ...form, fecha_ingreso: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Precio (Gs.)</label>
              <input type="number" min="0" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} placeholder="0" />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Observaciones</label>
              <input value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} />
            </div>
          </div>
          {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
          <div className="btn-row">
            <button className="btn btn-gray" onClick={abrirSalida} disabled={!clienteSelec || animales.length === 0}>Salida (F8)</button>
            <button className="btn btn-gray" onClick={abrirBaja} disabled={!clienteSelec || animales.length === 0}>Baja (F9)</button>
            {puedeEliminar && <button className="btn btn-red" disabled>Eliminar (F11)</button>}
            <button className="btn btn-green" onClick={guardar} disabled={saving} style={{ marginLeft: 'auto' }}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      <div className="table-container">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Cliente</th><th>Categoría</th><th>Ingreso</th>
                <th>Precio</th><th>Obs.</th><th>Días</th><th>Cobrado</th>
                <th>Fecha Registro</th><th>Hora</th><th>Usuario</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} className="table-empty">Cargando...</td></tr>
              ) : animales.length === 0 ? (
                <tr><td colSpan={12} className="table-empty">
                  {clienteSelec ? 'Sin animales activos para este cliente.' : 'Seleccioná un cliente para ver sus animales.'}
                </td></tr>
              ) : animales.map(a => (
                <tr key={a.id}>
                  <td>{a.id}</td>
                  <td>{clientes.find(c => c.id === a.cliente_id)?.nombre_razon_social?.split(' ')[0] || a.cliente_id}</td>
                  <td><span className="badge badge-blue">{a.categorias?.nombre}</span></td>
                  <td>{a.fecha_ingreso ? new Date(a.fecha_ingreso + 'T00:00:00').toLocaleDateString('es-PY') : '-'}</td>
                  <td>{gs(a.precio)}</td>
                  <td>{a.observaciones || '-'}</td>
                  <td>{diasDesde(a.fecha_ingreso)}</td>
                  <td><span className={`badge badge-${a.cobrado ? 'green' : 'red'}`}>{a.cobrado ? 'Sí' : 'No'}</span></td>
                  <td>{a.fecha_registro ? new Date(a.fecha_registro).toLocaleDateString('es-PY') : '-'}</td>
                  <td>{a.fecha_registro ? new Date(a.fecha_registro).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td>{a.usuarios?.nombre_usuario || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-purple btn-sm" onClick={() => abrirReclasificar(a)}>Reclasificar</button>
                      {puedeEliminar && <button className="btn btn-red btn-sm" onClick={() => eliminar(a.id)}>Eliminar</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {clienteSelec && (
          <div className="summary-bar">
            {Object.entries(resumen).map(([nombre, cant]) => (
              <span key={nombre}><strong>{nombre.split(' ').map(w => w[0]).join('')}:</strong>{cant}</span>
            ))}
            <span>Total: <strong>{totalAnimales}</strong></span>
            <div className="totals">
              <span>Gravada 10%: <strong>{gs(gravada)} Gs.</strong></span>
              <span>IVA 10%: <strong>{gs(iva)} Gs.</strong></span>
              <span>Total: <strong>{gs(total)} Gs.</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Modal Salida */}
      {modal === 'salida' && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Salida de animal</h3>
            <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
              Cliente: <strong>{clientes.find(c => c.id == clienteSelec)?.nombre_razon_social}</strong>
            </p>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Categoría *</label>
              <SearchSelect
                options={catOptsFromIds(modalForm.cats).map(c => {
                  const cant = animales.filter(a => a.categoria_id === c.value).reduce((s, a) => s + a.cantidad, 0)
                  return { ...c, sublabel: `${cant} disponibles` }
                })}
                value={modalForm.categoria_id}
                onChange={v => setModalForm({ ...modalForm, categoria_id: v })}
                placeholder="Buscar categoría..."
              />
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>Cantidad a vender *</label>
              <input type="number" min="1" value={modalForm.cantidad} onChange={e => setModalForm({ ...modalForm, cantidad: e.target.value })} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-green" onClick={registrarSalida}>Registrar salida</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Baja */}
      {modal === 'baja' && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Baja de animal</h3>
            <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
              Cliente: <strong>{clientes.find(c => c.id == clienteSelec)?.nombre_razon_social}</strong>
            </p>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Categoría *</label>
              <SearchSelect
                options={catOptsFromIds(modalForm.cats).map(c => {
                  const cant = animales.filter(a => a.categoria_id === c.value).reduce((s, a) => s + a.cantidad, 0)
                  return { ...c, sublabel: `${cant} disponibles` }
                })}
                value={modalForm.categoria_id}
                onChange={v => setModalForm({ ...modalForm, categoria_id: v })}
                placeholder="Buscar categoría..."
              />
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Cantidad *</label>
              <input type="number" min="1" value={modalForm.cantidad} onChange={e => setModalForm({ ...modalForm, cantidad: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Causa de muerte *</label>
              <select value={modalForm.causa} onChange={e => setModalForm({ ...modalForm, causa: e.target.value })}>
                <option value="">Seleccionar...</option>
                {CAUSAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {modalForm.causa === 'Otro' && (
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>Observación *</label>
                <input value={modalForm.observacion} onChange={e => setModalForm({ ...modalForm, observacion: e.target.value })} placeholder="Describí la causa..." />
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-red" onClick={registrarBaja}>Registrar baja</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reclasificar */}
      {modal === 'reclasificar' && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Reclasificar animal</h3>
            <p style={{ marginBottom: 4, color: 'var(--text-secondary)', fontSize: 13 }}>
              Categoría actual: <strong>{modalForm.animal?.categorias?.nombre}</strong>
            </p>
            <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
              Cantidad: <strong>{modalForm.animal?.cantidad}</strong>
            </p>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Nueva categoría *</label>
              <SearchSelect
                options={catReclasOpts}
                value={modalForm.nueva_categoria_id}
                onChange={v => setModalForm({ ...modalForm, nueva_categoria_id: v })}
                placeholder="Buscar nueva categoría..."
              />
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>Nuevo precio (Gs.)</label>
              <input type="number" min="0" value={modalForm.nuevo_precio} onChange={e => setModalForm({ ...modalForm, nuevo_precio: e.target.value })} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-purple" onClick={registrarReclasificacion}>Reclasificar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
