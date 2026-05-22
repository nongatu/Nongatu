import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase.js'
import { gs, diasDesde } from '../utils/helpers.js'
import SearchSelect from './SearchSelect.jsx'

const CAUSAS = ['Enfermedad', 'Picadura de víbora', 'Otro']

// Abreviatura inteligente: single-word → 3 chars; multi-word → iniciales
const abrev = (nombre) => {
  const w = nombre.trim().split(' ')
  return w.length === 1 ? nombre.substring(0, 3) : w.map(x => x[0]).join('')
}

export default function Animales({ user }) {
  const [clientes, setClientes] = useState([])
  const [categorias, setCategorias] = useState([])
  const [animales, setAnimales] = useState([])
  const [clienteSelec, setClienteSelec] = useState('')
  const [form, setForm] = useState({
    categoria_id: '', cantidad: '',
    fecha_ingreso: new Date().toISOString().split('T')[0],
    precio: '', observaciones: '',
    reclasMode: false, nueva_categoria_id: ''
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [modal, setModal] = useState(null)
  const [modalForm, setModalForm] = useState({})

  const perms = user?.rol === 'Administrador' ? { todo: true } : (user?.permisos || {})
  const puedeRegistrar = perms.todo || perms.registrar_animales
  const puedeEliminar = perms.todo || perms.eliminar_anular

  useEffect(() => {
    supabase.from('clientes').select('id,nombre_razon_social,ruc,cedula').order('nombre_razon_social')
      .then(({ data }) => setClientes(data || []))
    supabase.from('categorias').select('*').order('orden')
      .then(({ data }) => setCategorias(data || []))
  }, [])

  const cargarAnimales = useCallback(async () => {
    if (!clienteSelec) { setAnimales([]); return }
    setLoading(true)
    const { data } = await supabase.from('animales')
      .select('*, categorias(nombre,cobrable), usuarios(nombre_usuario)')
      .eq('cliente_id', clienteSelec).eq('estado', 'activo')
      .order('fecha_ingreso').order('id', { ascending: false })
    setAnimales(data || [])
    setLoading(false)
  }, [clienteSelec])

  useEffect(() => { cargarAnimales() }, [cargarAnimales])

  const clienteOpts = clientes.map(c => ({
    value: c.id, label: c.nombre_razon_social,
    sublabel: [c.ruc ? `RUC: ${c.ruc}` : '', c.cedula ? `CI: ${c.cedula}` : ''].filter(Boolean).join(' · '),
    searchText: `${c.nombre_razon_social} ${c.ruc||''} ${c.cedula||''}`,
  }))
  const catOpts = categorias.map(c => ({ value: c.id, label: c.nombre, searchText: c.nombre }))
  const catDestinoOpts = categorias
    .filter(c => String(c.id) !== String(form.categoria_id))
    .map(c => ({ value: c.id, label: c.nombre, searchText: c.nombre }))

  const resetForm = () => setForm({
    categoria_id: '', cantidad: '',
    fecha_ingreso: new Date().toISOString().split('T')[0],
    precio: '', observaciones: '', reclasMode: false, nueva_categoria_id: ''
  })

  // ── Guardar animal normal ─────────────────────────────────────────────────
  const guardarNormal = async () => {
    if (!clienteSelec) return setMsg({ type: 'error', text: 'Seleccioná un cliente.' })
    if (!form.categoria_id || !form.cantidad || !form.fecha_ingreso)
      return setMsg({ type: 'error', text: 'Completá los campos obligatorios.' })
    await supabase.from('animales').insert({
      cliente_id: parseInt(clienteSelec),
      categoria_id: parseInt(form.categoria_id),
      cantidad: parseInt(form.cantidad),
      fecha_ingreso: form.fecha_ingreso,
      precio: parseInt(form.precio) || 0,
      observaciones: form.observaciones,
      estado: 'activo', usuario_id: user?.id,
      fecha_registro: new Date().toISOString(),
    })
    setMsg({ type: 'success', text: 'Animal registrado correctamente.' })
    resetForm(); cargarAnimales()
  }

  // ── Guardar reclasificación ───────────────────────────────────────────────
  const guardarReclasificacion = async () => {
    if (!clienteSelec) return setMsg({ type: 'error', text: 'Seleccioná un cliente.' })
    if (!form.categoria_id || !form.cantidad || !form.nueva_categoria_id || !form.fecha_ingreso)
      return setMsg({ type: 'error', text: 'Completá todos los campos de reclasificación.' })

    const cant = parseInt(form.cantidad)
    // Registros de la categoría origen, ordenados del más antiguo al más nuevo
    const registros = animales
      .filter(a => a.categoria_id === parseInt(form.categoria_id))
      .sort((a, b) => new Date(a.fecha_ingreso) - new Date(b.fecha_ingreso))
    const totalDisp = registros.reduce((s, r) => s + r.cantidad, 0)

    if (cant > totalDisp)
      return setMsg({ type: 'error', text: `Solo hay ${totalDisp} animales de esa categoría disponibles.` })

    let restante = cant
    for (const r of registros) {
      if (restante <= 0) break
      const q = Math.min(r.cantidad, restante)
      const nuevo = r.cantidad - q
      if (nuevo === 0) {
        await supabase.from('animales').delete().eq('id', r.id)
      } else {
        await supabase.from('animales').update({ cantidad: nuevo }).eq('id', r.id)
      }
      restante -= q
    }

    // Crear nuevo registro con categoría destino
    const catOrigenNombre = categorias.find(c => c.id === parseInt(form.categoria_id))?.nombre || ''
    const obsReclas = `Reclasificado de ${catOrigenNombre}${form.observaciones ? ' | '+form.observaciones : ''}`
    await supabase.from('animales').insert({
      cliente_id: parseInt(clienteSelec),
      categoria_id: parseInt(form.nueva_categoria_id),
      cantidad: cant,
      fecha_ingreso: form.fecha_ingreso,
      precio: parseInt(form.precio) || 0,
      observaciones: obsReclas,
      estado: 'activo', usuario_id: user?.id,
      fecha_registro: new Date().toISOString(),
    })

    // Registrar movimiento
    await supabase.from('movimientos').insert({
      cliente_id: parseInt(clienteSelec),
      tipo: 'reclasificacion',
      categoria_anterior_id: parseInt(form.categoria_id),
      categoria_nueva_id: parseInt(form.nueva_categoria_id),
      cantidad: cant,
      precio_nuevo: parseInt(form.precio) || 0,
      usuario_id: user?.id,
      fecha: new Date().toISOString()
    })

    const catOrigen = categorias.find(c => c.id === parseInt(form.categoria_id))?.nombre || ''
    const catDestino = categorias.find(c => c.id === parseInt(form.nueva_categoria_id))?.nombre || ''
    setMsg({ type: 'success', text: `${cant} animales reclasificados de ${catOrigen} → ${catDestino}.` })
    resetForm(); cargarAnimales()
  }

  const guardar = async () => {
    setSaving(true); setMsg(null)
    if (form.reclasMode) await guardarReclasificacion()
    else await guardarNormal()
    setSaving(false)
  }

  const eliminar = async (id) => {
  const animal = animales.find(a => a.id === id)
  const esReclasificado = animal?.observaciones?.startsWith('Reclasificado de')

  if (esReclasificado) {
    const catOrigenNombre = animal.observaciones.match(/Reclasificado de ([^|]+)/)?.[1]?.trim() || ''
    const restaurar = confirm(
      `Este registro fue reclasificado desde "${catOrigenNombre}".\n\n` +
      `¿Querés restaurar los ${animal.cantidad} animales a "${catOrigenNombre}"?\n\n` +
      `Aceptar = eliminar Y restaurar la cantidad original\n` +
      `Cancelar = no hacer nada`
    )
    if (!restaurar) return

    const catOrigen = categorias.find(c => c.nombre === catOrigenNombre)
    if (catOrigen) {
      const registrosOrigen = animales
        .filter(a => a.categoria_id === catOrigen.id && a.id !== id)
        .sort((a, b) => new Date(a.fecha_ingreso) - new Date(b.fecha_ingreso))

      if (registrosOrigen.length > 0) {
        await supabase.from('animales')
          .update({ cantidad: registrosOrigen[0].cantidad + animal.cantidad })
          .eq('id', registrosOrigen[0].id)
      } else {
        await supabase.from('animales').insert({
          cliente_id: parseInt(clienteSelec),
          categoria_id: catOrigen.id,
          cantidad: animal.cantidad,
          fecha_ingreso: animal.fecha_ingreso,
          precio: 0,
          observaciones: 'Restaurado de reclasificación',
          estado: 'activo',
          usuario_id: user?.id,
          fecha_registro: new Date().toISOString(),
        })
      }
    }
  } else {
    if (!confirm('¿Eliminar este registro?')) return
  }

  await supabase.from('animales').delete().eq('id', id)
  cargarAnimales()
}

  // ── Salida F8 ─────────────────────────────────────────────────────────────
  const abrirSalida = () => {
    setModalForm({ categoria_id: '', cantidad: 1 }); setModal('salida')
  }
  const registrarSalida = async () => {
    const { categoria_id, cantidad } = modalForm
    if (!categoria_id || !cantidad) return
    const registros = animales.filter(a => a.categoria_id === parseInt(categoria_id))
      .sort((a, b) => new Date(a.fecha_ingreso) - new Date(b.fecha_ingreso))
    const totalDisp = registros.reduce((s, a) => s + a.cantidad, 0)
    if (parseInt(cantidad) > totalDisp) return alert(`Solo hay ${totalDisp} animales.`)
    let restante = parseInt(cantidad)
    for (const r of registros) {
      if (restante <= 0) break
      const q = Math.min(r.cantidad, restante)
      if (q === r.cantidad) await supabase.from('animales').update({ estado: 'vendido' }).eq('id', r.id)
      else await supabase.from('animales').update({ cantidad: r.cantidad - q }).eq('id', r.id)
      await supabase.from('movimientos').insert({
        animal_id: r.id, cliente_id: parseInt(clienteSelec), tipo: 'salida',
        categoria_anterior_id: r.categoria_id, cantidad: q,
        usuario_id: user?.id, fecha: new Date().toISOString()
      })
      restante -= q
    }
    setModal(null); cargarAnimales()
  }

  // ── Baja F9 ───────────────────────────────────────────────────────────────
  const abrirBaja = () => {
    setModalForm({ categoria_id: '', cantidad: 1, causa: '', observacion: '' }); setModal('baja')
  }
  const registrarBaja = async () => {
    const { categoria_id, cantidad, causa, observacion } = modalForm
    if (!categoria_id || !cantidad || !causa) return
    const registros = animales.filter(a => a.categoria_id === parseInt(categoria_id))
      .sort((a, b) => new Date(a.fecha_ingreso) - new Date(b.fecha_ingreso))
    const totalDisp = registros.reduce((s, a) => s + a.cantidad, 0)
    if (parseInt(cantidad) > totalDisp) return alert(`Solo hay ${totalDisp} animales.`)
    let restante = parseInt(cantidad)
    for (const r of registros) {
      if (restante <= 0) break
      const q = Math.min(r.cantidad, restante)
      if (q === r.cantidad) await supabase.from('animales').update({ estado: 'baja' }).eq('id', r.id)
      else await supabase.from('animales').update({ cantidad: r.cantidad - q }).eq('id', r.id)
      await supabase.from('movimientos').insert({
        animal_id: r.id, cliente_id: parseInt(clienteSelec), tipo: 'baja',
        categoria_anterior_id: r.categoria_id, cantidad: q,
        causa, observacion: causa === 'Otro' ? observacion : null,
        usuario_id: user?.id, fecha: new Date().toISOString()
      })
      restante -= q
    }
    setModal(null); cargarAnimales()
  }

  // ── Resumen barra inferior ────────────────────────────────────────────────
  const resumen = {}
  animales.forEach(a => {
    const n = a.categorias?.nombre || '?'
    resumen[n] = (resumen[n] || 0) + a.cantidad
  })
  const totalAnimales = animales.reduce((s, a) => s + a.cantidad, 0)
  const total = animales.filter(a => a.categorias?.cobrable)
    .reduce((s, a) => s + (a.cantidad * Number(a.precio)), 0)
  const iva = Math.round(total / 11)
  const gravada = total - iva

  const hayAnimales = clienteSelec && animales.length > 0

  // Opts para modales (categorías presentes en los animales del cliente)
  const catClienteOpts = [...new Set(animales.map(a => a.categoria_id))].map(id => {
    const cat = animales.find(a => a.categoria_id === id)
    const totalCat = animales.filter(a => a.categoria_id === id).reduce((s, a) => s + a.cantidad, 0)
    return { value: id, label: cat?.categorias?.nombre || '', sublabel: `${totalCat} disponibles`, searchText: cat?.categorias?.nombre || '' }
  })

  return (
    <div>
      {puedeRegistrar && (
        <div className="page-card">
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Cliente *</label>
              <SearchSelect options={clienteOpts} value={clienteSelec} onChange={setClienteSelec}
                placeholder="Buscar por nombre, RUC o cédula..." />
            </div>
            <div className="form-group">
              <label>{form.reclasMode ? 'Categoría origen *' : 'Categoría *'}</label>
              <SearchSelect options={catOpts} value={form.categoria_id}
                onChange={v => setForm({ ...form, categoria_id: v, nueva_categoria_id: '' })}
                placeholder={form.reclasMode ? 'Categoría a reclasificar...' : 'Buscar categoría...'} />
            </div>
            <div className="form-group">
              <label>Cantidad *</label>
              <input type="number" min="1" value={form.cantidad}
                onChange={e => setForm({ ...form, cantidad: e.target.value })} />
            </div>
            <div className="form-group">
              <label>{form.reclasMode ? 'Fecha de reclasificación *' : 'Fecha de ingreso *'}</label>
              <input type="date" value={form.fecha_ingreso}
                onChange={e => setForm({ ...form, fecha_ingreso: e.target.value })} />
            </div>
            {!form.reclasMode && (
              <div className="form-group">
                <label>Precio (Gs.)</label>
                <input type="number" min="0" value={form.precio}
                  onChange={e => setForm({ ...form, precio: e.target.value })} placeholder="0" />
              </div>
            )}
            {form.reclasMode && (
              <div className="form-group">
                <label>Nuevo precio (Gs.)</label>
                <input type="number" min="0" value={form.precio}
                  onChange={e => setForm({ ...form, precio: e.target.value })} placeholder="0" />
              </div>
            )}
            <div className="form-group" style={{ gridColumn: form.reclasMode ? '1' : 'span 2' }}>
              <label>Observaciones</label>
              <input value={form.observaciones}
                onChange={e => setForm({ ...form, observaciones: e.target.value })} />
            </div>

            {/* Checkbox reclasificación */}
            <div className="form-group" style={{ gridColumn: 'span 3', marginTop: -4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.reclasMode}
                  onChange={e => setForm({ ...form, reclasMode: e.target.checked, nueva_categoria_id: '', precio: '', fecha_ingreso: e.target.checked ? new Date().toISOString().split('T')[0] : form.fecha_ingreso })}
                  style={{ width: 'auto', margin: 0 }} />
                Habilitar reclasificación
              </label>
            </div>

            {/* Campos adicionales cuando está en modo reclasificación */}
            {form.reclasMode && (
              <div className="form-group" style={{ gridColumn: 'span 3' }}>
                <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#5b21b6', marginBottom: 12 }}>
                    Reclasificar a:
                  </div>
                  <div className="form-group">
                    <label>Nueva categoría *</label>
                    <SearchSelect options={catDestinoOpts} value={form.nueva_categoria_id}
                      onChange={v => setForm({ ...form, nueva_categoria_id: v })}
                      placeholder="Categoría destino..." />
                  </div>
                </div>
              </div>
            )}
          </div>

          {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

          <div className="btn-row">
            <button className="btn btn-gray" onClick={abrirSalida} disabled={!hayAnimales}>Salida (F8)</button>
            <button className="btn btn-gray" onClick={abrirBaja} disabled={!hayAnimales}>Baja (F9)</button>
            {puedeEliminar && <button className="btn btn-red" disabled>Eliminar (F11)</button>}
            <button className="btn btn-green" onClick={guardar} disabled={saving}>
              {saving ? 'Guardando...' : form.reclasMode ? 'Guardar reclasificación' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="table-container">
        <div className="table-wrapper">
          <table className="table-animales">
            <thead>
              <tr>
                <th>ID</th><th>Cliente</th><th>Categoría</th><th>Cant.</th><th>Ingreso</th>
                <th>Precio</th><th>Obs.</th><th>Días</th><th>Cobrado</th>
                <th>Fecha Registro</th><th>Hora</th><th>Usuario</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={13} className="table-empty">Cargando...</td></tr>
              ) : animales.length === 0 ? (
                <tr><td colSpan={13} className="table-empty">
                  {clienteSelec ? 'Sin animales activos para este cliente.' : 'Seleccioná un cliente para ver sus animales.'}
                </td></tr>
              ) : animales.map(a => (
                <tr key={a.id} style={a.observaciones?.startsWith('Reclasificado') ? {background:'#f5f3ff'} : {}}>
                  <td>{a.id}</td>
                  <td>{clientes.find(c => c.id === a.cliente_id)?.nombre_razon_social?.split(' ')[0] || a.cliente_id}</td>
                  <td><span className="badge badge-blue">{a.categorias?.nombre}</span></td>
                  <td style={{ fontWeight: 700, textAlign: 'center' }}>{a.cantidad}</td>
                  <td>{a.fecha_ingreso ? new Date(a.fecha_ingreso + 'T00:00:00').toLocaleDateString('es-PY') : '-'}</td>
                  <td>{gs(a.precio)}</td>
                  <td>{a.observaciones || '-'}</td>
                  <td>{diasDesde(a.fecha_ingreso)}</td>
                  <td><span className={`badge badge-${a.cobrado ? 'green' : 'red'}`}>{a.cobrado ? 'Sí' : 'No'}</span></td>
                  <td>{a.fecha_registro ? new Date(a.fecha_registro).toLocaleDateString('es-PY') : '-'}</td>
                  <td>{a.fecha_registro ? new Date(a.fecha_registro).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td>{a.usuarios?.nombre_usuario || '-'}</td>
                  <td>
                    {puedeEliminar && (
                      <button className="btn btn-red btn-sm" onClick={() => eliminar(a.id)}>Eliminar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Barra resumen */}
        {clienteSelec && (
          <div className="summary-bar">
            {Object.entries(resumen).map(([nombre, cant]) => (
              <span key={nombre}><strong>{abrev(nombre)}:</strong>{cant}</span>
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
        <div className="modal-overlay"><div className="modal">
          <h3>Salida de animal (F8)</h3>
          <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
            Cliente: <strong>{clientes.find(c => c.id == clienteSelec)?.nombre_razon_social}</strong>
          </p>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Categoría *</label>
            <SearchSelect options={catClienteOpts} value={modalForm.categoria_id}
              onChange={v => setModalForm({ ...modalForm, categoria_id: v })}
              placeholder="Seleccionar categoría..." />
          </div>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label>Cantidad a vender *</label>
            <input type="number" min="1" value={modalForm.cantidad}
              onChange={e => setModalForm({ ...modalForm, cantidad: e.target.value })} />
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-green" onClick={registrarSalida}>Registrar salida</button>
          </div>
        </div></div>
      )}

      {/* Modal Baja */}
      {modal === 'baja' && (
        <div className="modal-overlay"><div className="modal">
          <h3>Baja de animal (F9)</h3>
          <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
            Cliente: <strong>{clientes.find(c => c.id == clienteSelec)?.nombre_razon_social}</strong>
          </p>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Categoría *</label>
            <SearchSelect options={catClienteOpts} value={modalForm.categoria_id}
              onChange={v => setModalForm({ ...modalForm, categoria_id: v })}
              placeholder="Seleccionar categoría..." />
          </div>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Cantidad *</label>
            <input type="number" min="1" value={modalForm.cantidad}
              onChange={e => setModalForm({ ...modalForm, cantidad: e.target.value })} />
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
              <input value={modalForm.observacion}
                onChange={e => setModalForm({ ...modalForm, observacion: e.target.value })}
                placeholder="Describí la causa..." />
            </div>
          )}
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-red" onClick={registrarBaja}>Registrar baja</button>
          </div>
        </div></div>
      )}
    </div>
  )
}
