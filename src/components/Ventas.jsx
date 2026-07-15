import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { gs, fechaHoy } from '../utils/helpers'
import SearchSelect from './SearchSelect.jsx'
import Modal from './ui/Modal.jsx'
import ConfirmDialog from './ui/ConfirmDialog.jsx'
import Toast from './ui/Toast.jsx'
import { printHeader, printFooter, printDocument, abrirVentanaImpresion } from '../utils/printTemplate'

const FORMA_LABEL  = { efectivo: 'Efectivo', transferencia: 'Transferencia', fiado: 'Fiado' }
const FORMA_BADGE  = { efectivo: 'green', transferencia: 'blue', fiado: 'orange' }
const ESTADO_LABEL = { pagada: 'Pagada', pendiente: 'Pendiente', anulada: 'Anulada' }
const ESTADO_BADGE = { pagada: 'green', pendiente: 'orange', anulada: 'gray' }

const ITEM_EMPTY  = { producto_id: '', cantidad: 1, precio_unitario: 0 }
const FORM_EMPTY  = () => ({
  fecha: fechaHoy(), cliente_id: 'consumidor_final', items: [{ ...ITEM_EMPTY }],
  forma_pago: 'efectivo', cuenta_id: '', fecha_vencimiento: '', observaciones: '',
})
const CLIENTE_EMPTY = { nombre_razon_social: '', ruc: '', cedula: '', telefono: '', email: '', tipo: 'ventas' }
const PRODUCCION_EMPTY = { producto_id: '', cantidad: '', fecha: fechaHoy(), observacion: '' }

// ── Ticket de venta (plantilla imprimible común: ventana + print) ────────────
function htmlTicket(venta, usuario) {
  const items = venta.venta_items || []
  const filas = items.map(it => `
    <tr>
      <td>${it.productos?.nombre || ''}</td>
      <td style="text-align:center">${it.cantidad}</td>
      <td style="text-align:right">${gs(it.precio_unitario)} Gs.</td>
      <td style="text-align:right">${gs(it.subtotal)} Gs.</td>
    </tr>`).join('')
  const numero = String(venta.numero || '').padStart(4, '0')

  const bodyHtml = `
    ${printHeader({
      titulo: `Venta N° ${numero}`,
      subtitulo: `Cliente: ${venta.cliente_nombre}`,
      filtrosTxt: `Fecha: ${new Date(venta.fecha + 'T00:00:00').toLocaleDateString('es-PY')} · Forma de pago: ${FORMA_LABEL[venta.forma_pago] || venta.forma_pago} · Estado: ${ESTADO_LABEL[venta.estado] || venta.estado}`,
      usuario,
    })}
    <table>
      <thead><tr><th>Producto</th><th style="text-align:center">Cant.</th><th style="text-align:right">P. unit.</th><th style="text-align:right">Subtotal</th></tr></thead>
      <tbody>
        ${filas}
        <tr class="pt-total-row"><td colspan="3" style="text-align:right">TOTAL:</td><td style="text-align:right">${gs(venta.total)} Gs.</td></tr>
      </tbody>
    </table>
    ${venta.observaciones ? `<div style="font-size:11px;color:#555;margin-top:6px"><b>Obs.:</b> ${venta.observaciones}</div>` : ''}
    ${printFooter()}
  `

  return printDocument({ titleTag: `Venta N° ${numero}`, bodyHtml })
}

// ── Modal: Detalle de venta ───────────────────────────────────────────────────
function VentaDetalleModal({ venta, puedeAnular, onClose, onAnular, usuario }) {
  const cobrado = venta.venta_cobros?.reduce((s, vc) => s + Number(vc.monto), 0) || 0
  const saldo = Number(venta.total) - cobrado
  return (
    <Modal
      title={`Detalle de venta N° ${String(venta.numero).padStart(4, '0')}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
          <button className="btn btn-blue" onClick={() => abrirVentanaImpresion(htmlTicket(venta, usuario))}>
            Imprimir ticket
          </button>
          {puedeAnular && venta.estado !== 'anulada' && (
            <button className="btn btn-red" onClick={() => onAnular(venta)}>Anular</button>
          )}
        </>
      }
    >
      <div style={{ fontSize: 13, marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <span><b>Cliente:</b> {venta.cliente_nombre}</span>
        <span><b>Fecha:</b> {new Date(venta.fecha + 'T00:00:00').toLocaleDateString('es-PY')}</span>
        <span className={`badge badge-${FORMA_BADGE[venta.forma_pago]}`}>{FORMA_LABEL[venta.forma_pago]}</span>
        <span className={`badge badge-${ESTADO_BADGE[venta.estado]}`}>{ESTADO_LABEL[venta.estado]}</span>
      </div>

      <div className="table-wrapper">
        <table>
          <thead><tr><th>Producto</th><th>Cant.</th><th>P. unit.</th><th>Subtotal</th></tr></thead>
          <tbody>
            {(venta.venta_items || []).map((it, i) => (
              <tr key={i}>
                <td>{it.productos?.nombre || '—'}</td>
                <td>{it.cantidad} {it.productos?.unidad || ''}</td>
                <td>{gs(it.precio_unitario)} Gs.</td>
                <td>{gs(it.subtotal)} Gs.</td>
              </tr>
            ))}
            <tr><td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>TOTAL:</td><td style={{ fontWeight: 700 }}>{gs(venta.total)} Gs.</td></tr>
          </tbody>
        </table>
      </div>

      {venta.forma_pago === 'fiado' && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Cobros asociados</div>
          {(venta.venta_cobros || []).length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sin cobros registrados todavía.</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Fecha</th><th>Monto</th><th>Forma</th></tr></thead>
                <tbody>
                  {venta.venta_cobros.map(vc => (
                    <tr key={vc.id}>
                      <td>{new Date(vc.fecha + 'T00:00:00').toLocaleDateString('es-PY')}</td>
                      <td>{gs(vc.monto)} Gs.</td>
                      <td>{vc.forma === 'transferencia' ? 'Transferencia' : 'Efectivo'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 13 }}>
            Saldo pendiente: <b style={{ color: saldo > 0 ? 'var(--red)' : 'var(--green)' }}>{gs(saldo)} Gs.</b>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function Ventas({ user }) {
  const [ventas, setVentas]       = useState([])
  const [productos, setProductos] = useState([])
  const [clientes, setClientes]   = useState([])
  const [cuentas, setCuentas]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState(null)
  const [toast, setToast]         = useState(null)

  const [form, setForm] = useState(FORM_EMPTY())

  const [modalCliente, setModalCliente]       = useState(false)
  const [clienteForm, setClienteForm]         = useState(CLIENTE_EMPTY)
  const [modalProduccion, setModalProduccion] = useState(false)
  const [produccionForm, setProduccionForm]   = useState(PRODUCCION_EMPTY)
  const [verVenta, setVerVenta]               = useState(null)
  const [confirmAnular, setConfirmAnular]     = useState(null)

  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroProducto, setFiltroProducto] = useState('')
  const [filtroForma, setFiltroForma] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  const perms = user?.rol === 'Administrador' ? { todo: true } : (user?.permisos || {})
  const puedeVer     = perms.todo || perms.ver_ventas
  const puedeCrear   = perms.todo || perms.crear_ventas
  const puedeAnular  = perms.todo || perms.eliminar_anular

  useEffect(() => { if (puedeVer) cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    const [{ data: cl }, { data: pr }, { data: cu }, { data: vt }] = await Promise.all([
      supabase.from('clientes').select('id,nombre_razon_social,ruc,tipo').in('tipo', ['ventas', 'mixto']).order('nombre_razon_social'),
      supabase.from('productos').select('*').order('orden').order('nombre'),
      supabase.from('cuentas_pago').select('*').eq('activo', true).order('nombre'),
      supabase.from('ventas').select('*, venta_items(*,productos(nombre,unidad)), venta_cobros(*)').order('id', { ascending: false }),
    ])
    setClientes(cl || []); setProductos(pr || []); setCuentas(cu || []); setVentas(vt || [])
    setLoading(false)
  }

  if (!puedeVer) {
    return (
      <div className="page-card" style={{ color: 'var(--text-secondary)' }}>
        No tenés permiso para ver las ventas. Pedile al administrador que te habilite el acceso.
      </div>
    )
  }

  if (loading) return <div className="spinner" />

  // ── Ítems del formulario ────────────────────────────────────────────────
  const setItem = (idx, patch) => {
    setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, ...patch } : it) }))
  }
  const onProductoChange = (idx, producto_id) => {
    const prod = productos.find(p => String(p.id) === producto_id)
    setItem(idx, { producto_id, precio_unitario: prod ? prod.precio : 0 })
  }
  const agregarItem = () => setForm(f => ({ ...f, items: [...f.items, { ...ITEM_EMPTY }] }))
  const quitarItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))

  const totalForm = form.items.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0), 0)

  // ── Guardar venta ───────────────────────────────────────────────────────
  const guardarVenta = async () => {
    const itemsValidos = form.items.filter(it => it.producto_id && Number(it.cantidad) > 0)
    if (!itemsValidos.length) return setMsg({ type: 'error', text: 'Agregá al menos un producto.' })
    if (form.forma_pago === 'transferencia' && !form.cuenta_id) return setMsg({ type: 'error', text: 'Seleccioná la cuenta de destino.' })
    if (form.forma_pago === 'fiado' && !form.fecha_vencimiento) return setMsg({ type: 'error', text: 'Indicá la fecha de vencimiento.' })

    setSaving(true); setMsg(null)
    const esConsumidorFinal = form.cliente_id === 'consumidor_final'
    const clienteObj = !esConsumidorFinal ? clientes.find(c => String(c.id) === form.cliente_id) : null
    const total = itemsValidos.reduce((s, it) => s + Number(it.cantidad) * Number(it.precio_unitario), 0)

    const payload = {
      fecha: form.fecha,
      cliente_id: esConsumidorFinal ? null : parseInt(form.cliente_id),
      cliente_nombre: esConsumidorFinal ? 'Consumidor final' : (clienteObj?.nombre_razon_social || 'Consumidor final'),
      forma_pago: form.forma_pago,
      cuenta_id: form.forma_pago === 'transferencia' ? parseInt(form.cuenta_id) : null,
      estado: form.forma_pago === 'fiado' ? 'pendiente' : 'pagada',
      fecha_vencimiento: form.forma_pago === 'fiado' ? form.fecha_vencimiento : null,
      observaciones: form.observaciones || null,
      total,
      usuario: user?.nombre_usuario,
    }
    const { data: venta, error } = await supabase.from('ventas').insert(payload).select().single()
    if (error || !venta) { setSaving(false); return setMsg({ type: 'error', text: 'Error al guardar la venta.' }) }

    await supabase.from('venta_items').insert(itemsValidos.map(it => ({
      venta_id: venta.id, producto_id: parseInt(it.producto_id),
      cantidad: Number(it.cantidad), precio_unitario: Number(it.precio_unitario),
      subtotal: Number(it.cantidad) * Number(it.precio_unitario),
    })))

    let stockNegativo = false
    for (const it of itemsValidos) {
      const prod = productos.find(p => String(p.id) === it.producto_id)
      if (!prod?.controla_stock) continue
      const nuevoStock = Number(prod.stock_actual) - Number(it.cantidad)
      if (nuevoStock < 0) stockNegativo = true
      await supabase.from('stock_movimientos').insert({
        producto_id: prod.id, tipo: 'venta', cantidad: -Number(it.cantidad),
        fecha: form.fecha, venta_id: venta.id, usuario: user?.nombre_usuario,
      })
      await supabase.from('productos').update({ stock_actual: nuevoStock }).eq('id', prod.id)
    }

    setMsg({ type: 'success', text: 'Venta registrada.' })
    if (stockNegativo) setToast({ type: 'error', text: 'Atención: algún producto quedó con stock negativo.' })
    setForm(FORM_EMPTY())
    cargar()
    setSaving(false)
  }

  // ── Crear cliente nuevo desde la venta ─────────────────────────────────
  const guardarClienteNuevo = async () => {
    if (!clienteForm.nombre_razon_social.trim()) return setMsg({ type: 'error', text: 'El nombre del cliente es obligatorio.' })
    const payload = {
      ...clienteForm,
      nombre_razon_social: clienteForm.nombre_razon_social.trim(),
      fecha_alta: fechaHoy(), creado_por: user?.id, modificado_por: user?.nombre_usuario,
      ultima_modificacion: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('clientes').insert(payload).select().single()
    if (error || !data) return setMsg({ type: 'error', text: 'Error al crear el cliente.' })
    setClientes(prev => [...prev, data].sort((a, b) => a.nombre_razon_social.localeCompare(b.nombre_razon_social)))
    setForm(f => ({ ...f, cliente_id: String(data.id) }))
    setModalCliente(false); setClienteForm(CLIENTE_EMPTY)
  }

  // ── Producción (entrada de stock) ──────────────────────────────────────
  const abrirProduccion = () => { setProduccionForm(PRODUCCION_EMPTY); setModalProduccion(true) }
  const guardarProduccion = async () => {
    const { producto_id, cantidad, fecha, observacion } = produccionForm
    if (!producto_id || !cantidad || Number(cantidad) <= 0) return setMsg({ type: 'error', text: 'Seleccioná el producto e ingresá una cantidad.' })
    const prod = productos.find(p => String(p.id) === producto_id)
    await supabase.from('stock_movimientos').insert({
      producto_id: parseInt(producto_id), tipo: 'entrada_produccion',
      cantidad: Number(cantidad), fecha, observacion: observacion || null, usuario: user?.nombre_usuario,
    })
    await supabase.from('productos').update({ stock_actual: Number(prod.stock_actual) + Number(cantidad) }).eq('id', producto_id)
    setModalProduccion(false)
    setMsg({ type: 'success', text: 'Producción registrada.' })
    cargar()
  }

  // ── Anular venta ────────────────────────────────────────────────────────
  const confirmarAnular = async () => {
    const venta = confirmAnular
    for (const it of venta.venta_items || []) {
      const prod = productos.find(p => p.id === it.producto_id)
      if (!prod?.controla_stock) continue
      const nuevoStock = Number(prod.stock_actual) + Number(it.cantidad)
      await supabase.from('stock_movimientos').insert({
        producto_id: prod.id, tipo: 'anulacion_venta', cantidad: Number(it.cantidad),
        fecha: fechaHoy(), venta_id: venta.id, usuario: user?.nombre_usuario,
        observacion: `Anulación de venta N° ${venta.numero}`,
      })
      await supabase.from('productos').update({ stock_actual: nuevoStock }).eq('id', prod.id)
    }
    await supabase.from('ventas').update({ estado: 'anulada' }).eq('id', venta.id)
    setConfirmAnular(null); setVerVenta(null)
    setMsg({ type: 'success', text: 'Venta anulada.' })
    cargar()
  }

  // ── Stats ────────────────────────────────────────────────────────────────
  const hoyStr = fechaHoy()
  const mesActualKey = hoyStr.slice(0, 7)
  const ventasHoy = ventas.filter(v => v.estado !== 'anulada' && v.fecha === hoyStr).reduce((s, v) => s + Number(v.total), 0)
  const ventasMes = ventas.filter(v => v.estado !== 'anulada' && v.fecha?.slice(0, 7) === mesActualKey).reduce((s, v) => s + Number(v.total), 0)
  const fiadoPendiente = ventas.filter(v => v.estado === 'pendiente').reduce((s, v) => {
    const cobrado = v.venta_cobros?.reduce((ss, vc) => ss + Number(vc.monto), 0) || 0
    return s + Math.max(0, Number(v.total) - cobrado)
  }, 0)
  const cantidadPorProducto = {}
  ventas.forEach(v => {
    if (v.estado === 'anulada' || v.fecha?.slice(0, 7) !== mesActualKey) return
    v.venta_items?.forEach(it => {
      const nombre = it.productos?.nombre || 'Otro'
      cantidadPorProducto[nombre] = (cantidadPorProducto[nombre] || 0) + Number(it.cantidad)
    })
  })
  const masVendido = Object.entries(cantidadPorProducto).sort((a, b) => b[1] - a[1])[0]

  // ── Filtros de la tabla ───────────────────────────────────────────────────
  const ventasFiltradas = ventas.filter(v => {
    if (filtroCliente === 'consumidor_final' && v.cliente_id) return false
    if (filtroCliente && filtroCliente !== 'consumidor_final' && String(v.cliente_id) !== filtroCliente) return false
    if (filtroProducto && !v.venta_items?.some(it => String(it.producto_id) === filtroProducto)) return false
    if (filtroForma && v.forma_pago !== filtroForma) return false
    if (filtroDesde && v.fecha < filtroDesde) return false
    if (filtroHasta && v.fecha > filtroHasta) return false
    return true
  })
  const totalesPeriodo = {
    contado: ventasFiltradas.filter(v => v.estado !== 'anulada' && v.forma_pago !== 'fiado').reduce((s, v) => s + Number(v.total), 0),
    fiado: ventasFiltradas.filter(v => v.estado !== 'anulada' && v.forma_pago === 'fiado').reduce((s, v) => s + Number(v.total), 0),
  }
  totalesPeriodo.total = totalesPeriodo.contado + totalesPeriodo.fiado

  const clienteOptions = [
    { value: 'consumidor_final', label: 'Consumidor final', searchText: 'consumidor final' },
    ...clientes.map(c => ({
      value: String(c.id), label: c.nombre_razon_social,
      sublabel: c.ruc ? `RUC ${c.ruc}` : undefined,
      searchText: `${c.nombre_razon_social} ${c.ruc || ''}`,
    })),
  ]

  return (
    <div>
      <div className="cobro-cards">
        <div className="cobro-card"><div className="label">Ventas de hoy</div><div className="value blue">{gs(ventasHoy)} Gs.</div></div>
        <div className="cobro-card"><div className="label">Ventas del mes</div><div className="value green">{gs(ventasMes)} Gs.</div></div>
        <div className="cobro-card"><div className="label">Fiado pendiente</div><div className="value orange">{gs(fiadoPendiente)} Gs.</div></div>
        <div className="cobro-card">
          <div className="label">Producto más vendido</div>
          <div className="value" style={{ fontSize: 16 }}>{masVendido ? masVendido[0] : '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            {masVendido ? `${masVendido[1]} unidades este mes` : 'Sin ventas este mes'}
          </div>
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* ── Nueva venta ── */}
      {puedeCrear && (
        <div className="page-card">
          <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>Nueva venta</h3>
          <div className="form-grid-2">
            <div className="form-group">
              <label>Fecha *</label>
              <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Cliente *</label>
              <SearchSelect
                options={clienteOptions}
                value={form.cliente_id}
                onChange={v => setForm({ ...form, cliente_id: v })}
                placeholder="Buscar por nombre o RUC..."
                onCreateNew={() => { setClienteForm(CLIENTE_EMPTY); setModalCliente(true) }}
              />
            </div>
          </div>

          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 8 }}>
            Productos *
          </label>
          {form.items.map((it, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 90px 140px 130px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <select value={it.producto_id} onChange={e => onProductoChange(idx, e.target.value)}>
                  <option value="">Seleccionar producto...</option>
                  {productos.filter(p => p.activo).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <input type="number" min="0.01" step="0.01" value={it.cantidad} onChange={e => setItem(idx, { cantidad: e.target.value })} placeholder="Cant." />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <input type="number" min="0" value={it.precio_unitario} onChange={e => setItem(idx, { precio_unitario: e.target.value })} placeholder="Precio unit." />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>
                {gs((Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0))} Gs.
              </div>
              <button
                type="button" onClick={() => quitarItem(idx)} disabled={form.items.length === 1}
                style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 16, cursor: form.items.length === 1 ? 'not-allowed' : 'pointer', opacity: form.items.length === 1 ? 0.3 : 1 }}
              >✕</button>
            </div>
          ))}
          <button className="btn btn-outline btn-sm" onClick={agregarItem} style={{ marginBottom: 18 }}>+ Agregar producto</button>

          <div className="form-grid">
            <div className="form-group">
              <label>Forma de pago</label>
              <select value={form.forma_pago} onChange={e => setForm({ ...form, forma_pago: e.target.value, cuenta_id: '', fecha_vencimiento: '' })}>
                <option value="efectivo">Contado — Efectivo</option>
                <option value="transferencia">Contado — Transferencia</option>
                <option value="fiado">Fiado</option>
              </select>
            </div>
            {form.forma_pago === 'transferencia' && (
              <div className="form-group">
                <label>Cuenta de destino *</label>
                <select value={form.cuenta_id} onChange={e => setForm({ ...form, cuenta_id: e.target.value })}>
                  <option value="">Seleccionar cuenta...</option>
                  {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            )}
            {form.forma_pago === 'fiado' && (
              <div className="form-group">
                <label>Vencimiento *</label>
                <input type="date" value={form.fecha_vencimiento} onChange={e => setForm({ ...form, fecha_vencimiento: e.target.value })} />
              </div>
            )}
            <div className="form-group">
              <label>Observaciones</label>
              <input value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} />
            </div>
          </div>

          {form.forma_pago === 'fiado' && (
            <div className="alert alert-info">Esta venta queda pendiente de cobro y va a aparecer en Cobros → Ventas fiadas.</div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Total: {gs(totalForm)} Gs.</div>
            <button className="btn btn-green" onClick={guardarVenta} disabled={saving}>
              {saving ? 'Guardando...' : 'Registrar venta'}
            </button>
          </div>
        </div>
      )}

      {/* ── Productos a la venta ── */}
      <div className="page-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Productos a la venta</h3>
          {puedeCrear && <button className="btn btn-outline btn-sm" onClick={abrirProduccion}>+ Producción</button>}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {productos.filter(p => p.activo).length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sin productos activos. Cargalos en Configuración → Productos.</p>
          ) : productos.filter(p => p.activo).map(p => {
            const bajoMinimo = p.controla_stock && Number(p.stock_actual) < Number(p.stock_minimo)
            return (
              <div key={p.id} style={{
                border: `1px solid ${bajoMinimo ? '#f59e0b' : 'var(--border)'}`,
                background: bajoMinimo ? '#fff7ed' : 'var(--main-bg,#f9fafb)',
                borderRadius: 10, padding: '8px 12px', minWidth: 150,
              }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.nombre}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{gs(p.precio)} Gs. / {p.unidad}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: bajoMinimo ? '#d97706' : 'var(--text-primary)', marginTop: 2 }}>
                  {p.controla_stock ? `Stock: ${p.stock_actual}` : 'Sin control de stock'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Tabla de ventas ── */}
      <div className="table-container">
        <div style={{ padding: '16px 16px 0' }}>
          <div className="filter-row">
            <div className="form-group">
              <label>Cliente</label>
              <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}>
                <option value="">Todos</option>
                <option value="consumidor_final">Consumidor final</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre_razon_social}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Producto</label>
              <select value={filtroProducto} onChange={e => setFiltroProducto(e.target.value)}>
                <option value="">Todos</option>
                {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Forma de pago</label>
              <select value={filtroForma} onChange={e => setFiltroForma(e.target.value)}>
                <option value="">Todas</option>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="fiado">Fiado</option>
              </select>
            </div>
            <div className="form-group">
              <label>Desde</label>
              <input type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Hasta</label>
              <input type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Detalle</th><th>Total</th><th>Forma de pago</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {ventasFiltradas.length === 0 ? (
                <tr><td colSpan={8} className="table-empty">Sin ventas registradas.</td></tr>
              ) : ventasFiltradas.map(v => (
                <tr key={v.id} style={{ opacity: v.estado === 'anulada' ? 0.5 : 1 }}>
                  <td>{String(v.numero).padStart(4, '0')}</td>
                  <td>{new Date(v.fecha + 'T00:00:00').toLocaleDateString('es-PY')}</td>
                  <td style={{ fontWeight: 600 }}>{v.cliente_nombre}</td>
                  <td style={{ maxWidth: 240, whiteSpace: 'normal' }}>
                    {(v.venta_items || []).map(it => `${it.productos?.nombre || ''} ×${it.cantidad}`).join(', ')}
                  </td>
                  <td>{gs(v.total)} Gs.</td>
                  <td><span className={`badge badge-${FORMA_BADGE[v.forma_pago]}`}>{FORMA_LABEL[v.forma_pago]}</span></td>
                  <td><span className={`badge badge-${ESTADO_BADGE[v.estado]}`}>{ESTADO_LABEL[v.estado]}</span></td>
                  <td><button className="btn btn-blue btn-sm" onClick={() => setVerVenta(v)}>Ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="summary-bar">
          <span>Contado: <strong>{gs(totalesPeriodo.contado)} Gs.</strong></span>
          <span>Fiado: <strong>{gs(totalesPeriodo.fiado)} Gs.</strong></span>
          <div className="totals">
            <span>Total del período: <strong>{gs(totalesPeriodo.total)} Gs.</strong></span>
          </div>
        </div>
      </div>

      {/* ── Modal: crear cliente nuevo ── */}
      {modalCliente && (
        <Modal
          title="Nuevo cliente"
          onClose={() => setModalCliente(false)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setModalCliente(false)}>Cancelar</button>
              <button className="btn btn-green" onClick={guardarClienteNuevo}>Guardar cliente</button>
            </>
          }
        >
          <div className="form-grid-2">
            <div className="form-group">
              <label>Nombre o Razón Social *</label>
              <input value={clienteForm.nombre_razon_social} onChange={e => setClienteForm({ ...clienteForm, nombre_razon_social: e.target.value })} autoFocus />
            </div>
            <div className="form-group">
              <label>RUC</label>
              <input value={clienteForm.ruc} onChange={e => setClienteForm({ ...clienteForm, ruc: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Cédula</label>
              <input value={clienteForm.cedula} onChange={e => setClienteForm({ ...clienteForm, cedula: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input value={clienteForm.telefono} onChange={e => setClienteForm({ ...clienteForm, telefono: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={clienteForm.email} onChange={e => setClienteForm({ ...clienteForm, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Tipo de cliente</label>
              <select value={clienteForm.tipo} onChange={e => setClienteForm({ ...clienteForm, tipo: e.target.value })}>
                <option value="ventas">Ventas</option>
                <option value="mixto">Pastaje + Ventas</option>
                <option value="pastaje">Pastaje</option>
              </select>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: producción ── */}
      {modalProduccion && (
        <Modal
          title="Registrar producción"
          onClose={() => setModalProduccion(false)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setModalProduccion(false)}>Cancelar</button>
              <button className="btn btn-green" onClick={guardarProduccion}>Guardar</button>
            </>
          }
        >
          <div className="form-grid-2">
            <div className="form-group">
              <label>Producto *</label>
              <select value={produccionForm.producto_id} onChange={e => setProduccionForm({ ...produccionForm, producto_id: e.target.value })}>
                <option value="">Seleccionar...</option>
                {productos.filter(p => p.activo && p.controla_stock).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Cantidad *</label>
              <input type="number" min="0.01" step="0.01" value={produccionForm.cantidad} onChange={e => setProduccionForm({ ...produccionForm, cantidad: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Fecha</label>
              <input type="date" value={produccionForm.fecha} onChange={e => setProduccionForm({ ...produccionForm, fecha: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Observación</label>
              <input value={produccionForm.observacion} onChange={e => setProduccionForm({ ...produccionForm, observacion: e.target.value })} />
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: ver detalle de venta ── */}
      {verVenta && (
        <VentaDetalleModal
          venta={verVenta}
          puedeAnular={puedeAnular}
          usuario={user?.nombre_usuario}
          onClose={() => setVerVenta(null)}
          onAnular={(v) => setConfirmAnular(v)}
        />
      )}

      {/* ── Confirmar anulación ── */}
      {confirmAnular && (
        <ConfirmDialog
          title="Anular venta"
          message={`¿Anular la venta N° ${String(confirmAnular.numero).padStart(4, '0')}? El stock de los productos se restituye y la venta queda marcada como anulada (no se borra).`}
          confirmText="Anular"
          onConfirm={confirmarAnular}
          onCancel={() => setConfirmAnular(null)}
        />
      )}

      {toast && <Toast text={toast.text} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
