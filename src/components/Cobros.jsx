import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { gs, periodoActual, periodoLabel } from '../utils/helpers'

export default function Cobros({ user }) {
  const [tab, setTab] = useState('pagos')
  const [cobros, setCobros] = useState([])
  const [recibos, setRecibos] = useState([])
  const [clientes, setClientes] = useState([])
  const [categorias, setCategorias] = useState([])
  const [animales, setAnimales] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [modalForm, setModalForm] = useState({})
  const [msg, setMsg] = useState(null)
  const [filtroCliente, setFiltroCliente] = useState('')

  const perms = user?.rol === 'Administrador' ? { todo: true } : (user?.permisos || {})
  const puedeGenerar = perms.todo || perms.generar_cobros
  const puedeRegistrar = perms.todo || perms.registrar_pagos
  const puedeEliminar = perms.todo || perms.eliminar_anular

  useEffect(() => {
    Promise.all([
      supabase.from('clientes').select('id,nombre_razon_social,ruc').order('nombre_razon_social'),
      supabase.from('categorias').select('*'),
      supabase.from('animales').select('*, categorias(nombre,cobrable)').eq('estado', 'activo'),
    ]).then(([{ data: cl }, { data: ca }, { data: an }]) => {
      setClientes(cl || [])
      setCategorias(ca || [])
      setAnimales(an || [])
    })
    cargar()
  }, [])

  const cargar = async () => {
    setLoading(true)
    const [{ data: cb }, { data: rc }] = await Promise.all([
      supabase.from('cobros').select('*, clientes(nombre_razon_social), pagos(monto)').order('created_at', { ascending: false }),
      supabase.from('recibos').select('*, clientes(nombre_razon_social)').order('created_at', { ascending: false }),
    ])
    setCobros(cb || [])
    setRecibos(rc || [])
    setLoading(false)
  }

  const stats = {
    pendiente: cobros.filter(c => c.estado === 'pendiente').reduce((s, c) => s + Number(c.total), 0),
    pagado: cobros.filter(c => c.estado === 'pagado').reduce((s, c) => s + Number(c.total), 0),
    parcial: cobros.filter(c => c.estado === 'parcial').reduce((s, c) => s + Number(c.total), 0),
    mes: cobros.filter(c => c.periodo === periodoActual()).reduce((s, c) => s + Number(c.total), 0),
  }

  // Generar cobros automáticos para todos los clientes
  const generarCobros = async () => {
    if (!puedeGenerar) return
    const periodo = periodoActual()
    const existe = cobros.some(c => c.periodo === periodo)
    if (existe && !confirm(`Ya existen cobros para ${periodoLabel(periodo)}. ¿Generar igualmente?`)) return

    setMsg(null)
    let generados = 0

    for (const cliente of clientes) {
      const animalesCli = animales.filter(a => a.cliente_id === cliente.id && a.categorias?.cobrable)
      if (animalesCli.length === 0) continue

      const detalles = {}
      animalesCli.forEach(a => {
        const cid = a.categoria_id
        if (!detalles[cid]) detalles[cid] = { categoria_id: cid, cantidad: 0, precio_unitario: Number(a.precio) }
        detalles[cid].cantidad += a.cantidad
      })
      const det = Object.values(detalles).map(d => ({ ...d, subtotal: d.cantidad * d.precio_unitario }))
      const gravada = det.reduce((s, d) => s + d.subtotal, 0)
      const iva = Math.round(gravada * 0.1)
      const total = gravada + iva

      const hoy = new Date()
      const venc = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 10)

      const { data: cobro } = await supabase.from('cobros').insert({
        cliente_id: cliente.id, periodo,
        fecha_generacion: hoy.toISOString().split('T')[0],
        fecha_vencimiento: venc.toISOString().split('T')[0],
        gravada, iva, total, estado: 'pendiente'
      }).select().single()

      if (cobro) {
        await supabase.from('cobro_detalles').insert(det.map(d => ({ ...d, cobro_id: cobro.id })))
        generados++
      }
    }

    setMsg({ type: 'success', text: `Se generaron ${generados} cobros para ${periodoLabel(periodo)}.` })
    cargar()
  }

  const abrirPago = (cobro) => {
    const pagado = cobro.pagos?.reduce((s, p) => s + Number(p.monto), 0) || 0
    const saldo = Number(cobro.total) - pagado
    setModalForm({ cobro, saldo, pagado, monto: saldo, tipo: 'completo' })
    setModal('pago')
  }

  const registrarPago = async () => {
    const { cobro, monto, tipo, saldo } = modalForm
    if (!monto || Number(monto) <= 0) return
    const montoNum = Number(monto)

    const { data: pago } = await supabase.from('pagos').insert({
      cobro_id: cobro.id, monto: montoNum, tipo,
      fecha_pago: new Date().toISOString(), usuario_id: user?.id
    }).select().single()

    const nuevoEstado = montoNum >= saldo ? 'pagado' : 'parcial'
    await supabase.from('cobros').update({ estado: nuevoEstado }).eq('id', cobro.id)

    // Generar recibo
    const nroRecibo = String(recibos.length + 1).padStart(6, '0')
    const detalleData = await supabase.from('cobro_detalles').select('*, categorias(nombre)').eq('cobro_id', cobro.id)
    await supabase.from('recibos').insert({
      pago_id: pago.id, numero: nroRecibo,
      fecha: new Date().toISOString().split('T')[0],
      cliente_id: cobro.cliente_id, total: montoNum,
      detalle: detalleData.data
    })

    setModal(null); cargar()
  }

  const eliminarCobro = async (id) => {
    if (!confirm('¿Eliminar este cobro?')) return
    await supabase.from('cobros').delete().eq('id', id)
    cargar()
  }

  const cobrosFiltrados = cobros.filter(c =>
    !filtroCliente || c.cliente_id === parseInt(filtroCliente)
  )

  const getSaldo = (c) => {
    const pagado = c.pagos?.reduce((s, p) => s + Number(p.monto), 0) || 0
    return Number(c.total) - pagado
  }

  const getPagado = (c) => c.pagos?.reduce((s, p) => s + Number(p.monto), 0) || 0

  return (
    <div>
      <div className="cobro-cards">
        <div className="cobro-card"><div className="label">Total pendiente</div><div className="value red">{gs(stats.pendiente)} Gs.</div></div>
        <div className="cobro-card"><div className="label">Total pagado</div><div className="value green">{gs(stats.pagado)} Gs.</div></div>
        <div className="cobro-card"><div className="label">Parciales</div><div className="value orange">{gs(stats.parcial)} Gs.</div></div>
        <div className="cobro-card"><div className="label">Total del mes</div><div className="value blue">{gs(stats.mes)} Gs.</div></div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'pagos' ? 'active' : ''}`} onClick={() => setTab('pagos')}>Pagos</button>
        <button className={`tab-btn ${tab === 'recibos' ? 'active' : ''}`} onClick={() => setTab('recibos')}>Recibos</button>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {tab === 'pagos' && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ minWidth: 220 }}>
              <label>Filtrar por cliente</label>
              <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}>
                <option value="">Todos</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre_razon_social}</option>)}
              </select>
            </div>
            {puedeGenerar && (
              <button className="btn btn-blue" onClick={generarCobros}>Generar cobros del mes</button>
            )}
          </div>

          <div className="table-container">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>N°</th><th>Cliente</th><th>Período</th><th>Total</th>
                    <th>Pagado</th><th>Saldo</th><th>Estado</th><th>Vencimiento</th>
                    {(puedeRegistrar || puedeEliminar) && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="table-empty">Cargando...</td></tr>
                  ) : cobrosFiltrados.length === 0 ? (
                    <tr><td colSpan={9} className="table-empty">Sin cobros. Usá "Generar cobros del mes".</td></tr>
                  ) : cobrosFiltrados.map(c => {
                    const pagado = getPagado(c)
                    const saldo = getSaldo(c)
                    const venc = c.fecha_vencimiento && new Date(c.fecha_vencimiento) < new Date() && c.estado !== 'pagado'
                    return (
                      <tr key={c.id} style={venc ? { background: '#fff5f5' } : {}}>
                        <td>{c.id}</td>
                        <td style={{ fontWeight: 600 }}>{c.clientes?.nombre_razon_social}</td>
                        <td>{periodoLabel(c.periodo)}</td>
                        <td>{gs(c.total)} Gs.</td>
                        <td>{gs(pagado)} Gs.</td>
                        <td style={{ color: saldo > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>{gs(saldo)} Gs.</td>
                        <td>
                          <span className={`badge badge-${c.estado === 'pagado' ? 'green' : c.estado === 'parcial' ? 'orange' : 'red'}`}>
                            {c.estado === 'pagado' ? 'Pagado' : c.estado === 'parcial' ? 'Parcial' : 'Pendiente'}
                          </span>
                          {venc && <span className="badge badge-red" style={{ marginLeft: 4 }}>Vencido</span>}
                        </td>
                        <td>{c.fecha_vencimiento ? new Date(c.fecha_vencimiento).toLocaleDateString('es-PY') : '-'}</td>
                        {(puedeRegistrar || puedeEliminar) && (
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {puedeRegistrar && c.estado !== 'pagado' && (
                                <button className="btn btn-green btn-sm" onClick={() => abrirPago(c)}>Registrar pago</button>
                              )}
                              {puedeEliminar && (
                                <button className="btn btn-red btn-sm" onClick={() => eliminarCobro(c.id)}>Eliminar</button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'recibos' && (
        <div className="table-container">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>N° Recibo</th><th>Cliente</th><th>Fecha</th><th>Total</th></tr>
              </thead>
              <tbody>
                {recibos.length === 0 ? (
                  <tr><td colSpan={4} className="table-empty">Sin recibos generados.</td></tr>
                ) : recibos.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 700 }}>{String(r.numero).padStart(6, '0')}</td>
                    <td>{r.clientes?.nombre_razon_social}</td>
                    <td>{new Date(r.fecha).toLocaleDateString('es-PY')}</td>
                    <td>{gs(r.total)} Gs.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Pago */}
      {modal === 'pago' && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Registrar pago</h3>
            <p style={{ marginBottom: 8, fontSize: 14 }}>
              Cliente: <strong>{modalForm.cobro?.clientes?.nombre_razon_social}</strong>
            </p>
            <p style={{ marginBottom: 4, fontSize: 14 }}>
              Período: <strong>{periodoLabel(modalForm.cobro?.periodo)}</strong>
            </p>
            <p style={{ marginBottom: 4, fontSize: 14, color: 'var(--red)' }}>
              Saldo pendiente: <strong>{gs(modalForm.saldo)} Gs.</strong>
            </p>
            <p style={{ marginBottom: 20, fontSize: 14 }}>
              Total: <strong>{gs(modalForm.cobro?.total)} Gs.</strong>
            </p>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Tipo de pago *</label>
              <select value={modalForm.tipo} onChange={e => setModalForm({ ...modalForm, tipo: e.target.value, monto: e.target.value === 'completo' ? modalForm.saldo : modalForm.monto })}>
                <option value="completo">Pago completo</option>
                <option value="parcial">Pago parcial</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>Monto a pagar (Gs.) *</label>
              <input
                type="number" min="1" max={modalForm.saldo}
                value={modalForm.monto}
                onChange={e => setModalForm({ ...modalForm, monto: e.target.value })}
                readOnly={modalForm.tipo === 'completo'}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-green" onClick={registrarPago}>Confirmar pago</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
