import { useState } from 'react'
import { supabase } from '../supabase'
import { gs, periodoLabel } from '../utils/helpers'

const TIPOS = [
  { value: 'animales_activos',   label: 'Resumen de animales activos (detallado)' },
  { value: 'estado_cuenta',      label: 'Estado de cuenta por cliente' },
  { value: 'pagos_realizados',   label: 'Pagos realizados' },
  { value: 'bajas',              label: 'Bajas de animales' },
  { value: 'salidas',            label: 'Salidas de animales' },
  { value: 'reclasificados',     label: 'Animales reclasificados' },
  { value: 'movimiento_general', label: 'Movimiento general de animales' },
]

// ── HTML con membrete para impresión ─────────────────────────────────────────
function htmlReporte(titulo, columnas, filas, filtrosTxt) {
  const hoy = new Date().toLocaleDateString('es-PY')
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${titulo}</title><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:11px;padding:20px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;border-bottom:2px solid #000;padding-bottom:10px}
    .empresa .nombre{font-size:17px;font-weight:700;margin-bottom:3px}
    .empresa div{font-size:11px;color:#333}
    .reporte-info{text-align:right}
    .reporte-info .rtitulo{font-size:14px;font-weight:700;text-transform:uppercase;margin-bottom:3px}
    .filtros{font-size:10px;color:#666;margin-bottom:10px;font-style:italic}
    h3{font-size:12px;font-weight:700;margin-bottom:8px}
    table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #ccc;padding:4px 6px;font-size:10px;vertical-align:top}
    th{background:#f0f0f0;font-weight:700;text-align:left}
    tr:nth-child(even) td{background:#fafafa}
    @media print{body{padding:8px}}
  </style></head><body>
    <div class="header">
      <div class="empresa">
        <div class="nombre">QUERANDY S.A.</div>
        <div>RUC: 80094734-7</div>
        <div>Mcal. Estigarribia - Boquerón</div>
      </div>
      <div class="reporte-info">
        <div class="rtitulo">${titulo}</div>
        <div>Fecha de emisión: ${hoy}</div>
      </div>
    </div>
    ${filtrosTxt ? `<div class="filtros">${filtrosTxt}</div>` : ''}
    <h3>${filas.length} registros</h3>
    <table>
      <thead><tr>${columnas.map(c => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${filas.map(f => `<tr>${f.map(c => `<td>${c ?? '-'}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
    <script>window.onload=()=>window.print()<\/script>
  </body></html>`
}

// ── Helpers para armar filas del PDF según tipo ───────────────────────────────
function columnasPDF(tipo) {
  if (tipo === 'animales_activos')   return ['Cliente','Categoría','Cantidad','Fecha ingreso','Precio','Observaciones']
  if (tipo === 'estado_cuenta')      return ['N°','Cliente','Período','Total','Pagado','Saldo','Estado']
  if (tipo === 'pagos_realizados')   return ['Fecha','Cliente','Período','Monto','Tipo','Medio','Observación']
  return ['Fecha','Cliente','Tipo','Cat. anterior','Cat. nueva','Cantidad','Causa']
}

function filasPDF(tipo, resultado) {
  if (tipo === 'animales_activos') return resultado.map(r => [
    r.clientes?.nombre_razon_social,
    r.categorias?.nombre,
    r.cantidad,
    r.fecha_ingreso ? new Date(r.fecha_ingreso+'T00:00:00').toLocaleDateString('es-PY') : '-',
    gs(r.precio)+' Gs.',
    r.observaciones||'-',
  ])
  if (tipo === 'estado_cuenta') return resultado.map(r => {
    const pagado = r.pagos?.reduce((s,p)=>s+Number(p.monto),0)||0
    return [r.id, r.clientes?.nombre_razon_social, periodoLabel(r.periodo), gs(r.total)+' Gs.', gs(pagado)+' Gs.', gs(Number(r.total)-pagado)+' Gs.', r.estado]
  })
  if (tipo === 'pagos_realizados') return resultado.map(r => [
    new Date(r.fecha).toLocaleDateString('es-PY'),
    r.cliente_nombre,
    periodoLabel(r.periodo),
    gs(r.monto)+' Gs.',
    r.tipo_label,
    r.medio,
    r.observacion||'-',
  ])
  return resultado.map(r => [
    new Date(r.fecha).toLocaleDateString('es-PY'),
    r.clientes?.nombre_razon_social,
    r.tipo,
    r.cat_ant?.nombre||'-',
    r.cat_nva?.nombre||'-',
    r.cantidad,
    r.causa||r.observacion||'-',
  ])
}

// ── Etiqueta de tipo de movimiento ────────────────────────────────────────────
const tipoColor = { baja:'red', salida:'orange', reclasificacion:'blue', ingreso:'green' }

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
        let q = supabase.from('animales')
          .select('*, clientes(nombre_razon_social), categorias(nombre,cobrable)')
          .eq('estado', 'activo').order('cliente_id').order('categoria_id')
        if (cliente) q = q.eq('cliente_id', parseInt(cliente))
        const { data: d } = await q
        resultado = d

      } else if (tipo === 'estado_cuenta') {
        let q = supabase.from('cobros')
          .select('*, clientes(nombre_razon_social), pagos(monto)')
          .order('periodo', { ascending: false })
        if (cliente) q = q.eq('cliente_id', parseInt(cliente))
        const { data: d } = await q
        resultado = d

      } else if (tipo === 'pagos_realizados') {
        // ── Fuente 1: créditos adelantados (dinero real del cliente) ──
        let qcr = supabase.from('creditos_cliente')
          .select('id, cliente_id, monto, fecha_pago, periodo_aplicar, observacion, aplicado, cobros(periodo), clientes(nombre_razon_social), usuarios(nombre_usuario)')
          .order('fecha_pago', { ascending: false })
        if (cliente) qcr = qcr.eq('cliente_id', parseInt(cliente))
        if (desde)   qcr = qcr.gte('fecha_pago', desde)
        if (hasta)   qcr = qcr.lte('fecha_pago', hasta)

        // ── Fuente 2: pagos directos al registrar cobro (tipo completo/parcial) ──
        let qpag = supabase.from('pagos')
          .select('id, monto, tipo, fecha_pago, medio_pago, cobros(periodo, cliente_id, clientes(nombre_razon_social)), usuarios(nombre_usuario)')
          .in('tipo', ['completo', 'parcial'])
          .order('fecha_pago', { ascending: false })
        if (desde) qpag = qpag.gte('fecha_pago', desde)
        if (hasta) qpag = qpag.lte('fecha_pago', hasta + 'T23:59:59')

        const [crRes, pagRes] = await Promise.all([qcr, qpag])

        const creditosNorm = (crRes.data || []).map(cr => ({
          _source: 'credito',
          fecha: cr.fecha_pago + 'T00:00:00',
          cliente_nombre: cr.clientes?.nombre_razon_social,
          periodo: cr.cobros?.periodo || cr.periodo_aplicar || '',
          monto: Number(cr.monto),
          tipo_label: 'Pago adelantado',
          medio: 'Efectivo',
          observacion: cr.observacion || '',
          usuario: cr.usuarios?.nombre_usuario || '',
        }))

        const pagosNorm = (pagRes.data || [])
          .filter(p => !cliente || p.cobros?.cliente_id === parseInt(cliente))
          .map(p => ({
            _source: 'pago',
            fecha: p.fecha_pago,
            cliente_nombre: p.cobros?.clientes?.nombre_razon_social,
            periodo: p.cobros?.periodo || '',
            monto: Number(p.monto),
            tipo_label: p.tipo === 'completo' ? 'Pago completo' : 'Pago parcial',
            medio: p.medio_pago === 'transferencia' ? 'Transferencia' : 'Efectivo',
            observacion: '',
            usuario: p.usuarios?.nombre_usuario || '',
          }))

        resultado = [...creditosNorm, ...pagosNorm]
          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

      } else {
        // bajas / salidas / reclasificados / movimiento_general
        const tipoMap = { bajas:'baja', salidas:'salida', reclasificados:'reclasificacion', movimiento_general: undefined }
        let qmov = supabase.from('movimientos')
          .select('*, clientes(nombre_razon_social), cat_ant:categorias!movimientos_categoria_anterior_id_fkey(nombre), cat_nva:categorias!movimientos_categoria_nueva_id_fkey(nombre), usuarios(nombre_usuario)')
          .order('fecha', { ascending: false })
        if (tipoMap[tipo]) qmov = qmov.eq('tipo', tipoMap[tipo])
        if (cliente) qmov = qmov.eq('cliente_id', parseInt(cliente))
        if (desde)   qmov = qmov.gte('fecha', desde)
        if (hasta)   qmov = qmov.lte('fecha', hasta + 'T23:59:59')

        const { data: movData } = await qmov

        if (tipo === 'movimiento_general') {
          // Agregar ingresos desde tabla animales
          let qanim = supabase.from('animales')
            .select('id, cliente_id, cantidad, fecha_ingreso, clientes(nombre_razon_social), categorias(nombre), usuarios(nombre_usuario)')
            .in('estado', ['activo', 'baja'])
          if (cliente) qanim = qanim.eq('cliente_id', parseInt(cliente))
          if (desde)   qanim = qanim.gte('fecha_ingreso', desde)
          if (hasta)   qanim = qanim.lte('fecha_ingreso', hasta)
          const { data: animData } = await qanim

          const ingresos = (animData || []).map(a => ({
            id: 'ing_' + a.id,
            fecha: a.fecha_ingreso + 'T00:00:00',
            tipo: 'ingreso',
            clientes: a.clientes,
            cat_ant: null,
            cat_nva: a.categorias,
            cantidad: a.cantidad,
            causa: '-',
            observacion: '-',
            usuarios: a.usuarios,
          }))

          resultado = [...(movData || []), ...ingresos]
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        } else {
          resultado = movData
        }
      }

      setData({ tipo, resultado })
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const exportarCSV = () => {
    if (!data?.resultado?.length) return
    const rows = data.resultado
    let headers, csvRows

    if (data.tipo === 'pagos_realizados') {
      headers = ['Fecha','Cliente','Período','Monto','Tipo','Medio','Observación','Usuario']
      csvRows = rows.map(r => [
        new Date(r.fecha).toLocaleDateString('es-PY'),
        r.cliente_nombre||'', periodoLabel(r.periodo)||'',
        r.monto||'', r.tipo_label||'', r.medio||'', r.observacion||'', r.usuario||'',
      ])
    } else if (data.tipo === 'bajas'||data.tipo==='salidas'||data.tipo==='reclasificados'||data.tipo==='movimiento_general') {
      headers = ['Fecha','Cliente','Tipo','Cat. anterior','Cat. nueva','Cantidad','Causa','Usuario']
      csvRows = rows.map(r => [
        new Date(r.fecha).toLocaleDateString('es-PY'),
        r.clientes?.nombre_razon_social||'', r.tipo||'',
        r.cat_ant?.nombre||'', r.cat_nva?.nombre||'',
        r.cantidad||'', r.causa||r.observacion||'', r.usuarios?.nombre_usuario||'',
      ])
    } else {
      headers = Object.keys(rows[0]||{}).filter(k=>typeof rows[0][k]!=='object')
      csvRows = rows.map(r=>headers.map(h=>r[h]??''))
    }

    const csv = [headers.join(','), ...csvRows.map(r=>r.map(v=>`"${v}"`).join(','))].join('\n')
    const blob = new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download=`reporte_${data.tipo}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const exportarPDF = () => {
    if (!data?.resultado?.length) return
    const tituloMap = {
      animales_activos:'Resumen de animales activos', estado_cuenta:'Estado de cuenta',
      pagos_realizados:'Pagos realizados', bajas:'Bajas de animales',
      salidas:'Salidas de animales', reclasificados:'Animales reclasificados',
      movimiento_general:'Movimiento general de animales',
    }
    const titulo = tituloMap[data.tipo]||data.tipo
    const clienteNombre = clientes.find(c=>c.id===parseInt(cliente))?.nombre_razon_social
    const filtrosTxt = [
      clienteNombre?`Cliente: ${clienteNombre}`:null,
      desde?`Desde: ${new Date(desde+'T00:00:00').toLocaleDateString('es-PY')}`:null,
      hasta?`Hasta: ${new Date(hasta+'T00:00:00').toLocaleDateString('es-PY')}`:null,
    ].filter(Boolean).join(' | ')

    const w = window.open('','_blank')
    w.document.write(htmlReporte(titulo, columnasPDF(data.tipo), filasPDF(data.tipo, data.resultado), filtrosTxt))
    w.document.close()
  }

  const hayResultados = data?.resultado?.length > 0

  return (
    <div>
      <div className="page-card">
        <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>Generar reporte</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Tipo de reporte *</label>
            <select value={tipo} onChange={e => { setTipo(e.target.value); setData(null) }}>
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
          {hayResultados && <>
            <button className="btn btn-green" onClick={exportarCSV}>Exportar CSV</button>
            <button className="btn btn-orange" onClick={exportarPDF}>Exportar PDF</button>
          </>}
        </div>
      </div>

      {data && (
        <div className="table-container">
          <div style={{ padding:'12px 16px', fontWeight:700, borderBottom:'1px solid var(--border)' }}>
            {TIPOS.find(t=>t.value===data.tipo)?.label} — {data.resultado?.length||0} registros
          </div>
          <div className="table-wrapper">

            {/* ── Animales activos ── */}
            {data.tipo === 'animales_activos' && (
              <table>
                <thead><tr><th>ID</th><th>Cliente</th><th>Categoría</th><th>Cantidad</th><th>Fecha Ingreso</th><th>Precio</th><th>Observaciones</th></tr></thead>
                <tbody>
                  {!hayResultados
                    ? <tr><td colSpan={7} className="table-empty">Sin resultados.</td></tr>
                    : data.resultado.map(r => (
                      <tr key={r.id}>
                        <td>{r.id}</td><td>{r.clientes?.nombre_razon_social}</td>
                        <td>{r.categorias?.nombre}</td><td>{r.cantidad}</td>
                        <td>{r.fecha_ingreso?new Date(r.fecha_ingreso+'T00:00:00').toLocaleDateString('es-PY'):'-'}</td>
                        <td>{gs(r.precio)} Gs.</td><td>{r.observaciones||'-'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}

            {/* ── Estado de cuenta ── */}
            {data.tipo === 'estado_cuenta' && (
              <table>
                <thead><tr><th>N°</th><th>Cliente</th><th>Período</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Estado</th></tr></thead>
                <tbody>
                  {!hayResultados
                    ? <tr><td colSpan={7} className="table-empty">Sin resultados.</td></tr>
                    : data.resultado.map(r => {
                      const pagado = r.pagos?.reduce((s,p)=>s+Number(p.monto),0)||0
                      return (
                        <tr key={r.id}>
                          <td>{r.id}</td><td>{r.clientes?.nombre_razon_social}</td>
                          <td>{periodoLabel(r.periodo)}</td>
                          <td>{gs(r.total)} Gs.</td><td>{gs(pagado)} Gs.</td>
                          <td>{gs(Number(r.total)-pagado)} Gs.</td>
                          <td><span className={`badge badge-${r.estado==='pagado'?'green':r.estado==='parcial'?'orange':'red'}`}>{r.estado}</span></td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            )}

            {/* ── Pagos realizados ── */}
            {data.tipo === 'pagos_realizados' && (
              <table>
                <thead><tr><th>Fecha</th><th>Cliente</th><th>Período</th><th>Monto</th><th>Tipo</th><th>Medio</th><th>Observación</th><th>Usuario</th></tr></thead>
                <tbody>
                  {!hayResultados
                    ? <tr><td colSpan={8} className="table-empty">Sin resultados.</td></tr>
                    : data.resultado.map((r,i) => (
                      <tr key={i}>
                        <td>{new Date(r.fecha).toLocaleDateString('es-PY')}</td>
                        <td style={{fontWeight:600}}>{r.cliente_nombre}</td>
                        <td>{periodoLabel(r.periodo)}</td>
                        <td style={{fontWeight:600}}>{gs(r.monto)} Gs.</td>
                        <td><span className={`badge badge-${r._source==='credito'?'purple':'green'}`}>{r.tipo_label}</span></td>
                        <td>{r.medio}</td>
                        <td>{r.observacion||'-'}</td>
                        <td>{r.usuario||'-'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}

            {/* ── Movimientos (bajas, salidas, reclasificados, movimiento_general) ── */}
            {(data.tipo==='bajas'||data.tipo==='salidas'||data.tipo==='reclasificados'||data.tipo==='movimiento_general') && (
              <table>
                <thead><tr>
                  <th>Fecha</th><th>Cliente</th><th>Tipo</th>
                  <th>Categoría anterior</th><th>Categoría nueva</th>
                  <th>Cantidad</th><th>Causa</th><th>Usuario</th>
                </tr></thead>
                <tbody>
                  {!hayResultados
                    ? <tr><td colSpan={8} className="table-empty">Sin resultados.</td></tr>
                    : data.resultado.map((r,i) => (
                      <tr key={r.id||i}>
                        <td>{new Date(r.fecha).toLocaleDateString('es-PY')}</td>
                        <td>{r.clientes?.nombre_razon_social}</td>
                        <td><span className={`badge badge-${tipoColor[r.tipo]||'blue'}`}>{r.tipo}</span></td>
                        <td>{r.cat_ant?.nombre||'-'}</td>
                        <td>{r.cat_nva?.nombre||'-'}</td>
                        <td>{r.cantidad}</td>
                        <td>{r.causa||r.observacion||'-'}</td>
                        <td>{r.usuarios?.nombre_usuario||'-'}</td>
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
