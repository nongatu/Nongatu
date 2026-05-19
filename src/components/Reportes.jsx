import { useState } from 'react'
import { supabase } from '../supabase'
import { gs, periodoLabel } from '../utils/helpers'

const TIPOS = [
  { value: 'animales_activos', label: 'Resumen de animales activos (detallado)' },
  { value: 'estado_cuenta', label: 'Estado de cuenta por cliente' },
  { value: 'pagos_realizados', label: 'Pagos realizados' },
  { value: 'bajas', label: 'Bajas de animales (resumen)' },
  { value: 'salidas', label: 'Salidas de animales (resumen)' },
  { value: 'reclasificados', label: 'Animales reclasificados' },
  { value: 'movimiento_general', label: 'Movimiento general de animales' },
]

export default function Reportes({ user }) {
  const [tipo, setTipo] = useState('')
  const [cliente, setCliente] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [clientes, setClientes] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [clientesCargados, setClientesCargados] = useState(false)

  if (!clientesCargados) {
    supabase.from('clientes').select('id,nombre_razon_social').order('nombre_razon_social').then(({ data: cl }) => {
      setClientes(cl || [])
      setClientesCargados(true)
    })
  }

  const generar = async () => {
    if (!tipo) return
    setLoading(true); setData(null)
    try {
      let resultado = null
      if (tipo === 'animales_activos') {
        let q = supabase.from('animales').select('*, clientes(nombre_razon_social), categorias(nombre,cobrable)').eq('estado', 'activo').order('cliente_id').order('categoria_id')
        if (cliente) q = q.eq('cliente_id', parseInt(cliente))
        const { data: d } = await q
        resultado = d
      } else if (tipo === 'estado_cuenta') {
        let q = supabase.from('cobros').select('*, clientes(nombre_razon_social), pagos(monto)').order('periodo', { ascending: false })
        if (cliente) q = q.eq('cliente_id', parseInt(cliente))
        const { data: d } = await q
        resultado = d
      } else if (tipo === 'pagos_realizados') {
        let q = supabase.from('pagos').select('*, cobros(periodo, cliente_id, clientes(nombre_razon_social)), usuarios(nombre_usuario)').order('fecha_pago', { ascending: false })
        if (desde) q = q.gte('fecha_pago', desde)
        if (hasta) q = q.lte('fecha_pago', hasta + 'T23:59:59')
        const { data: d } = await q
        resultado = d
      } else if (tipo === 'bajas' || tipo === 'salidas' || tipo === 'reclasificados' || tipo === 'movimiento_general') {
        const tipoMap = { bajas: 'baja', salidas: 'salida', reclasificados: 'reclasificacion', movimiento_general: undefined }
        let q = supabase.from('movimientos').select('*, clientes(nombre_razon_social), categorias!movimientos_categoria_anterior_id_fkey(nombre), usuarios(nombre_usuario)').order('fecha', { ascending: false })
        if (tipoMap[tipo]) q = q.eq('tipo', tipoMap[tipo])
        if (cliente) q = q.eq('cliente_id', parseInt(cliente))
        if (desde) q = q.gte('fecha', desde)
        if (hasta) q = q.lte('fecha', hasta + 'T23:59:59')
        const { data: d } = await q
        resultado = d
      }
      setData({ tipo, resultado })
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const exportarCSV = () => {
    if (!data?.resultado?.length) return
    const rows = data.resultado
    const headers = Object.keys(rows[0] || {}).filter(k => typeof rows[0][k] !== 'object')
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${r[h] ?? ''}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `reporte_${tipo}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div>
      <div className="page-card">
        <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>Generar reporte</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Tipo de reporte *</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="">Seleccionar...</option>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Cliente</label>
            <select value={cliente} onChange={e => setCliente(e.target.value)}>
              <option value="">Todos</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre_razon_social}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
        </div>
        <div className="btn-row">
          <button className="btn btn-blue" onClick={generar} disabled={!tipo || loading}>
            {loading ? 'Generando...' : 'Generar'}
          </button>
          {data?.resultado?.length > 0 && (
            <button className="btn btn-green" onClick={exportarCSV}>Exportar CSV</button>
          )}
        </div>
      </div>

      {data && (
        <div className="table-container">
          <div style={{ padding: '12px 16px', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
            {TIPOS.find(t => t.value === data.tipo)?.label} — {data.resultado?.length || 0} registros
          </div>
          <div className="table-wrapper">
            {data.tipo === 'animales_activos' && (
              <table>
                <thead><tr><th>ID</th><th>Cliente</th><th>Categoría</th><th>Cantidad</th><th>Fecha Ingreso</th><th>Precio</th><th>Observaciones</th></tr></thead>
                <tbody>
                  {data.resultado?.length === 0 ? <tr><td colSpan={7} className="table-empty">Sin resultados.</td></tr>
                    : data.resultado?.map(r => (
                      <tr key={r.id}>
                        <td>{r.id}</td><td>{r.clientes?.nombre_razon_social}</td>
                        <td>{r.categorias?.nombre}</td><td>{r.cantidad}</td>
                        <td>{r.fecha_ingreso ? new Date(r.fecha_ingreso + 'T00:00:00').toLocaleDateString('es-PY') : '-'}</td>
                        <td>{gs(r.precio)} Gs.</td><td>{r.observaciones || '-'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
            {data.tipo === 'estado_cuenta' && (
              <table>
                <thead><tr><th>N°</th><th>Cliente</th><th>Período</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Estado</th></tr></thead>
                <tbody>
                  {data.resultado?.length === 0 ? <tr><td colSpan={7} className="table-empty">Sin resultados.</td></tr>
                    : data.resultado?.map(r => {
                      const pagado = r.pagos?.reduce((s, p) => s + Number(p.monto), 0) || 0
                      return (
                        <tr key={r.id}>
                          <td>{r.id}</td><td>{r.clientes?.nombre_razon_social}</td>
                          <td>{periodoLabel(r.periodo)}</td>
                          <td>{gs(r.total)} Gs.</td><td>{gs(pagado)} Gs.</td>
                          <td>{gs(Number(r.total) - pagado)} Gs.</td>
                          <td><span className={`badge badge-${r.estado === 'pagado' ? 'green' : r.estado === 'parcial' ? 'orange' : 'red'}`}>{r.estado}</span></td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            )}
            {(data.tipo === 'bajas' || data.tipo === 'salidas' || data.tipo === 'reclasificados' || data.tipo === 'movimiento_general') && (
              <table>
                <thead><tr><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Categoría anterior</th><th>Cantidad</th><th>Causa</th><th>Usuario</th></tr></thead>
                <tbody>
                  {data.resultado?.length === 0 ? <tr><td colSpan={7} className="table-empty">Sin resultados.</td></tr>
                    : data.resultado?.map(r => (
                      <tr key={r.id}>
                        <td>{new Date(r.fecha).toLocaleDateString('es-PY')}</td>
                        <td>{r.clientes?.nombre_razon_social}</td>
                        <td><span className={`badge badge-${r.tipo === 'baja' ? 'red' : r.tipo === 'salida' ? 'orange' : 'blue'}`}>{r.tipo}</span></td>
                        <td>{r.categorias?.nombre || '-'}</td>
                        <td>{r.cantidad}</td>
                        <td>{r.causa || r.observacion || '-'}</td>
                        <td>{r.usuarios?.nombre_usuario}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
            {data.tipo === 'pagos_realizados' && (
              <table>
                <thead><tr><th>Fecha</th><th>Cliente</th><th>Período</th><th>Monto</th><th>Tipo</th><th>Usuario</th></tr></thead>
                <tbody>
                  {data.resultado?.length === 0 ? <tr><td colSpan={6} className="table-empty">Sin resultados.</td></tr>
                    : data.resultado?.map(r => (
                      <tr key={r.id}>
                        <td>{new Date(r.fecha_pago).toLocaleDateString('es-PY')}</td>
                        <td>{r.cobros?.clientes?.nombre_razon_social}</td>
                        <td>{periodoLabel(r.cobros?.periodo || '')}</td>
                        <td>{gs(r.monto)} Gs.</td>
                        <td><span className={`badge badge-${r.tipo === 'completo' ? 'green' : 'orange'}`}>{r.tipo}</span></td>
                        <td>{r.usuarios?.nombre_usuario}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
