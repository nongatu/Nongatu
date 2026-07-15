import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { gs, fechaHoy } from '../utils/helpers'
import Modal from './ui/Modal.jsx'
import ConfirmDialog from './ui/ConfirmDialog.jsx'

const FORM_EMPTY = () => ({
  fecha: fechaHoy(), categoria_id: '', proveedor: '', descripcion: '',
  monto: '', cuenta_id: '', nro_comprobante: '',
})

const CATEGORIA_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#64748b']

// ── Barras: gastos del mes por categoría ──────────────────────────────────────
function CategoriaBars({ categorias }) {
  if (!categorias.length) {
    return <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sin gastos registrados este mes.</p>
  }
  const maxVal = Math.max(...categorias.map(c => c.monto), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {categorias.map((c, i) => (
        <div key={c.nombre} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 110px', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</span>
          <div style={{ background: 'var(--main-bg,#f1f5f9)', borderRadius: 6, height: 13, overflow: 'hidden' }}>
            <div style={{ width: `${Math.round((c.monto / maxVal) * 100)}%`, height: '100%', background: CATEGORIA_COLORS[i % CATEGORIA_COLORS.length], borderRadius: 6 }} />
          </div>
          <span style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>{gs(c.monto)} Gs.</span>
        </div>
      ))}
    </div>
  )
}

export default function Gastos({ user }) {
  const [gastos, setGastos]               = useState([])
  const [categoriasGasto, setCategoriasGasto] = useState([])
  const [cuentas, setCuentas]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(false)
  const [msg, setMsg]                     = useState(null)

  const [form, setForm]     = useState(FORM_EMPTY())
  const [editId, setEditId] = useState(null)

  const [verGasto, setVerGasto]         = useState(null)
  const [gastoAEliminar, setGastoAEliminar] = useState(null)
  const [confirmPaso, setConfirmPaso]   = useState(0)

  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [filtroCuenta, setFiltroCuenta]       = useState('')
  const [filtroDesde, setFiltroDesde]         = useState('')
  const [filtroHasta, setFiltroHasta]         = useState('')

  const perms = user?.rol === 'Administrador' ? { todo: true } : (user?.permisos || {})
  const puedeVer   = perms.todo || perms.ver_gastos
  const puedeCrear = perms.todo || perms.crear_gastos

  useEffect(() => { if (puedeVer) cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    const [{ data: g }, { data: cg }, { data: cu }] = await Promise.all([
      supabase.from('gastos').select('*, categorias_gasto(nombre), cuentas_pago(nombre,tipo)').order('fecha', { ascending: false }).order('id', { ascending: false }),
      supabase.from('categorias_gasto').select('*').eq('activo', true).order('orden').order('nombre'),
      supabase.from('cuentas_pago').select('*').eq('activo', true).order('nombre'),
    ])
    setGastos(g || []); setCategoriasGasto(cg || []); setCuentas(cu || [])
    setLoading(false)
  }

  if (!puedeVer) {
    return (
      <div className="page-card" style={{ color: 'var(--text-secondary)' }}>
        No tenés permiso para ver los gastos. Pedile al administrador que te habilite el acceso.
      </div>
    )
  }

  if (loading) return <div className="spinner" />

  // ── Guardar (alta / edición) ──────────────────────────────────────────────
  const guardar = async () => {
    if (!form.fecha) return setMsg({ type: 'error', text: 'Indicá la fecha.' })
    if (!form.categoria_id) return setMsg({ type: 'error', text: 'Seleccioná la categoría.' })
    if (!form.descripcion.trim()) return setMsg({ type: 'error', text: 'La descripción es obligatoria.' })
    if (!form.monto || Number(form.monto) <= 0) return setMsg({ type: 'error', text: 'Ingresá un monto válido.' })
    if (!form.cuenta_id) return setMsg({ type: 'error', text: 'Indicá desde dónde se pagó.' })

    setSaving(true); setMsg(null)
    const payload = {
      fecha: form.fecha,
      categoria_id: parseInt(form.categoria_id),
      proveedor: form.proveedor.trim() || null,
      descripcion: form.descripcion.trim(),
      monto: Number(form.monto),
      cuenta_id: parseInt(form.cuenta_id),
      nro_comprobante: form.nro_comprobante.trim() || null,
      usuario: user?.nombre_usuario,
    }
    if (editId) {
      const { error } = await supabase.from('gastos').update(payload).eq('id', editId)
      setMsg(error ? { type: 'error', text: 'Error al guardar.' } : { type: 'success', text: 'Gasto actualizado.' })
    } else {
      const { error } = await supabase.from('gastos').insert(payload)
      setMsg(error ? { type: 'error', text: 'Error al guardar.' } : { type: 'success', text: 'Gasto registrado.' })
    }
    setForm(FORM_EMPTY()); setEditId(null); cargar(); setSaving(false)
  }

  const editar = (g) => {
    setForm({
      fecha: g.fecha, categoria_id: String(g.categoria_id || ''), proveedor: g.proveedor || '',
      descripcion: g.descripcion, monto: g.monto, cuenta_id: String(g.cuenta_id || ''),
      nro_comprobante: g.nro_comprobante || '',
    })
    setEditId(g.id); setMsg(null); setVerGasto(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const cancelar = () => { setForm(FORM_EMPTY()); setEditId(null); setMsg(null) }

  // ── Eliminar (doble confirmación) ────────────────────────────────────────
  const pedirEliminar = (g) => { setGastoAEliminar(g); setConfirmPaso(1) }
  const cerrarConfirm = () => { setConfirmPaso(0); setGastoAEliminar(null) }
  const confirmarPaso1 = () => setConfirmPaso(2)
  const confirmarPaso2 = async () => {
    await supabase.from('gastos').delete().eq('id', gastoAEliminar.id)
    cerrarConfirm(); setVerGasto(null)
    setMsg({ type: 'success', text: 'Gasto eliminado.' })
    cargar()
  }

  // ── Stats del mes ─────────────────────────────────────────────────────────
  const mesActualKey = fechaHoy().slice(0, 7)
  const gastosDelMes = gastos.filter(g => g.fecha?.slice(0, 7) === mesActualKey)
  const gastosMesTotal = gastosDelMes.reduce((s, g) => s + Number(g.monto), 0)

  const montoPorCategoria = {}
  gastosDelMes.forEach(g => {
    const nombre = g.categorias_gasto?.nombre || 'Sin categoría'
    montoPorCategoria[nombre] = (montoPorCategoria[nombre] || 0) + Number(g.monto)
  })
  const categoriasOrdenadas = Object.entries(montoPorCategoria).map(([nombre, monto]) => ({ nombre, monto })).sort((a, b) => b.monto - a.monto)
  const mayorCategoria = categoriasOrdenadas[0]

  const pagadoPorTipo = { efectivo: 0, banco: 0 }
  gastosDelMes.forEach(g => {
    const tipo = g.cuentas_pago?.tipo || 'efectivo'
    pagadoPorTipo[tipo] = (pagadoPorTipo[tipo] || 0) + Number(g.monto)
  })

  // ── Filtros de la tabla ───────────────────────────────────────────────────
  const gastosFiltrados = gastos.filter(g => {
    if (filtroCategoria && String(g.categoria_id) !== filtroCategoria) return false
    if (filtroProveedor && !(g.proveedor || '').toLowerCase().includes(filtroProveedor.toLowerCase())) return false
    if (filtroCuenta && String(g.cuenta_id) !== filtroCuenta) return false
    if (filtroDesde && g.fecha < filtroDesde) return false
    if (filtroHasta && g.fecha > filtroHasta) return false
    return true
  })
  const totalPeriodo = gastosFiltrados.reduce((s, g) => s + Number(g.monto), 0)

  return (
    <div>
      <div className="cobro-cards">
        <div className="cobro-card"><div className="label">Gastos del mes</div><div className="value red">{gs(gastosMesTotal)} Gs.</div></div>
        <div className="cobro-card">
          <div className="label">Mayor categoría del mes</div>
          <div className="value" style={{ fontSize: 16 }}>{mayorCategoria ? mayorCategoria.nombre : '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            {mayorCategoria ? `${gs(mayorCategoria.monto)} Gs.` : 'Sin gastos este mes'}
          </div>
        </div>
        <div className="cobro-card"><div className="label">Pagado desde Caja chica</div><div className="value orange">{gs(pagadoPorTipo.efectivo)} Gs.</div></div>
        <div className="cobro-card"><div className="label">Pagado desde Banco</div><div className="value blue">{gs(pagadoPorTipo.banco)} Gs.</div></div>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* ── Nuevo gasto ── */}
      {puedeCrear && (
        <div className="page-card">
          <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>{editId ? 'Editar gasto' : 'Nuevo gasto'}</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Fecha *</label>
              <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Categoría *</label>
              <select value={form.categoria_id} onChange={e => setForm({ ...form, categoria_id: e.target.value })}>
                <option value="">Seleccionar...</option>
                {categoriasGasto.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Proveedor</label>
              <input value={form.proveedor} onChange={e => setForm({ ...form, proveedor: e.target.value })} placeholder="Ej: Cooperativa Fernheim" />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Descripción *</label>
              <input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Ej: Balanceado ponedoras 40 bolsas" />
            </div>
            <div className="form-group">
              <label>Monto (Gs.) *</label>
              <input type="number" min="0" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} placeholder="0" />
            </div>
            <div className="form-group">
              <label>Pagado desde *</label>
              <select value={form.cuenta_id} onChange={e => setForm({ ...form, cuenta_id: e.target.value })}>
                <option value="">Seleccionar...</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>N° comprobante</label>
              <input value={form.nro_comprobante} onChange={e => setForm({ ...form, nro_comprobante: e.target.value })} placeholder="Opcional" />
            </div>
          </div>
          <div className="btn-row">
            <button className="btn btn-green" onClick={guardar} disabled={saving}>{saving ? 'Guardando...' : 'Guardar gasto'}</button>
            {editId && <button className="btn btn-outline" onClick={cancelar}>Cancelar</button>}
          </div>
        </div>
      )}

      {/* ── Gastos del mes por categoría ── */}
      <div className="page-card">
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 1 }}>Gastos del mes por categoría</h3>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
          {gastosDelMes.length} gasto{gastosDelMes.length === 1 ? '' : 's'} · {gs(gastosMesTotal)} Gs.
        </div>
        <CategoriaBars categorias={categoriasOrdenadas} />
      </div>

      {/* ── Tabla de gastos ── */}
      <div className="table-container">
        <div style={{ padding: '16px 16px 0' }}>
          <div className="filter-row">
            <div className="form-group">
              <label>Categoría</label>
              <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
                <option value="">Todas</option>
                {categoriasGasto.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Proveedor</label>
              <input value={filtroProveedor} onChange={e => setFiltroProveedor(e.target.value)} placeholder="Buscar..." />
            </div>
            <div className="form-group">
              <label>Cuenta</label>
              <select value={filtroCuenta} onChange={e => setFiltroCuenta(e.target.value)}>
                <option value="">Todas</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
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
              <tr><th>Fecha</th><th>Categoría</th><th>Proveedor</th><th>Descripción</th><th>Desde</th><th>Monto</th></tr>
            </thead>
            <tbody>
              {gastosFiltrados.length === 0 ? (
                <tr><td colSpan={6} className="table-empty">Sin gastos registrados.</td></tr>
              ) : gastosFiltrados.map(g => (
                <tr key={g.id} onClick={() => setVerGasto(g)} style={{ cursor: 'pointer' }}>
                  <td>{new Date(g.fecha + 'T00:00:00').toLocaleDateString('es-PY')}</td>
                  <td><span className="badge badge-blue">{g.categorias_gasto?.nombre || '—'}</span></td>
                  <td>{g.proveedor || '-'}</td>
                  <td>{g.descripcion}</td>
                  <td><span className={`badge badge-${g.cuentas_pago?.tipo === 'banco' ? 'purple' : 'green'}`}>{g.cuentas_pago?.nombre || '—'}</span></td>
                  <td style={{ fontWeight: 600 }}>{gs(g.monto)} Gs.</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="summary-bar">
          <span>{gastosFiltrados.length} gasto{gastosFiltrados.length === 1 ? '' : 's'} en el período</span>
          <div className="totals">
            <span>Total del período: <strong>{gs(totalPeriodo)} Gs.</strong></span>
          </div>
        </div>
      </div>

      {/* ── Modal: detalle de gasto ── */}
      {verGasto && (
        <Modal
          title="Detalle de gasto"
          onClose={() => setVerGasto(null)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setVerGasto(null)}>Cerrar</button>
              {puedeCrear && <button className="btn btn-blue" onClick={() => editar(verGasto)}>Editar</button>}
              {puedeCrear && <button className="btn btn-red" onClick={() => pedirEliminar(verGasto)}>Eliminar</button>}
            </>
          }
        >
          <div style={{ fontSize: 13.5, lineHeight: 1.9 }}>
            <div><b>Fecha:</b> {new Date(verGasto.fecha + 'T00:00:00').toLocaleDateString('es-PY')}</div>
            <div><b>Categoría:</b> {verGasto.categorias_gasto?.nombre || '—'}</div>
            <div><b>Proveedor:</b> {verGasto.proveedor || '—'}</div>
            <div><b>Descripción:</b> {verGasto.descripcion}</div>
            <div><b>Monto:</b> {gs(verGasto.monto)} Gs.</div>
            <div><b>Pagado desde:</b> {verGasto.cuentas_pago?.nombre || '—'}</div>
            <div><b>N° comprobante:</b> {verGasto.nro_comprobante || '—'}</div>
          </div>
        </Modal>
      )}

      {/* ── Confirmación de eliminación (doble paso) ── */}
      {confirmPaso === 1 && (
        <ConfirmDialog
          title="Eliminar gasto"
          message={`¿Eliminar el gasto "${gastoAEliminar.descripcion}" por ${gs(gastoAEliminar.monto)} Gs.?`}
          confirmText="Sí, eliminar"
          onConfirm={confirmarPaso1}
          onCancel={cerrarConfirm}
        />
      )}
      {confirmPaso === 2 && (
        <ConfirmDialog
          title="Confirmar definitivamente"
          message="Esta acción no se puede deshacer y afecta los totales del mes. ¿Confirmás que querés eliminar este gasto?"
          confirmText="Eliminar definitivamente"
          onConfirm={confirmarPaso2}
          onCancel={cerrarConfirm}
        />
      )}
    </div>
  )
}
