import { useState } from 'react'
import { supabase } from '../supabase'
import { gs, periodoLabel } from '../utils/helpers'
import { printHeader, printFooter, printDocument, abrirVentanaImpresion } from '../utils/printTemplate'
import { exportarExcel } from '../utils/exportExcel'

// ── Ganadería: reportes ya existentes, sin cambios ────────────────────────────
const TIPOS = [
  { value: 'animales_activos',   label: 'Resumen de animales activos (detallado)' },
  { value: 'estado_cuenta',      label: 'Estado de cuenta por cliente' },
  { value: 'caja_chica',         label: 'Movimiento de caja (débito / crédito)' },
  { value: 'pagos_realizados',   label: 'Pagos realizados' },
  { value: 'bajas',              label: 'Bajas de animales' },
  { value: 'salidas',            label: 'Salidas de animales' },
  { value: 'reclasificados',     label: 'Animales reclasificados' },
  { value: 'movimiento_general', label: 'Movimiento general de animales' },
]

// ── Ventas / Gastos / Finanzas: reportes nuevos ───────────────────────────────
const TIPOS_VENTAS = [
  { value: 'ventas_detallado',     label: 'Ventas — detallado' },
  { value: 'ventas_por_producto',  label: 'Ventas — por producto' },
  { value: 'ventas_por_cliente',   label: 'Ventas — por cliente' },
]
const TIPOS_GASTOS = [
  { value: 'gastos_por_categoria', label: 'Gastos — por categoría' },
  { value: 'gastos_por_proveedor', label: 'Gastos — por proveedor' },
]
const TIPOS_FINANZAS = [
  { value: 'finanzas_ingresos_gastos', label: 'Finanzas — Ingresos vs gastos' },
  { value: 'finanzas_cuentas_cobrar',  label: 'Finanzas — Cuentas por cobrar' },
]
const GRUPOS_TIPOS = [
  { grupo: 'Ventas',     tipos: TIPOS_VENTAS },
  { grupo: 'Gastos',     tipos: TIPOS_GASTOS },
  { grupo: 'Finanzas',   tipos: TIPOS_FINANZAS },
  { grupo: 'Ganadería',  tipos: TIPOS },
]
const NUEVOS_TIPOS = [...TIPOS_VENTAS, ...TIPOS_GASTOS, ...TIPOS_FINANZAS].map(t => t.value)
const ALL_TIPOS = GRUPOS_TIPOS.flatMap(g => g.tipos)

const FORMA_LABEL_V  = { efectivo: 'Efectivo', transferencia: 'Transferencia', fiado: 'Fiado' }
const ESTADO_LABEL_V = { pagada: 'Pagada', pendiente: 'Pendiente', anulada: 'Anulada' }

// ── colSpec: define columnas + cómo leer cada valor, reusado por la tabla en
// pantalla, el PDF, el CSV y el Excel de los reportes nuevos ─────────────────
function colSpecNuevos(tipo) {
  if (tipo === 'ventas_detallado') return [
    { header: 'Fecha',        get: v => new Date(v.fecha + 'T00:00:00').toLocaleDateString('es-PY') },
    { header: 'N° Venta',     get: v => String(v.numero).padStart(4, '0') },
    { header: 'Cliente',      get: v => v.cliente_nombre },
    { header: 'Productos',    get: v => (v.venta_items || []).map(it => `${it.productos?.nombre || ''} ×${it.cantidad}`).join(', ') },
    { header: 'Forma de pago', get: v => FORMA_LABEL_V[v.forma_pago] || v.forma_pago },
    { header: 'Estado',       get: v => ESTADO_LABEL_V[v.estado] || v.estado },
    { header: 'Total',        get: v => Number(v.total), type: 'money' },
  ]
  if (tipo === 'ventas_por_producto') return [
    { header: 'Producto',         get: p => p.nombre },
    { header: 'Cantidad vendida', get: p => Number(p.cantidad), type: 'number' },
    { header: 'Monto',            get: p => Number(p.monto), type: 'money' },
    { header: '% del total',      get: p => Number(p.porcentaje), type: 'percent' },
  ]
  if (tipo === 'ventas_por_cliente') return [
    { header: 'Cliente',                 get: c => c.nombre },
    { header: 'Cantidad de ventas',      get: c => Number(c.cantidad), type: 'number' },
    { header: 'Total comprado',          get: c => Number(c.total), type: 'money' },
    { header: 'Saldo fiado pendiente',   get: c => Number(c.saldoFiado), type: 'money' },
  ]
  if (tipo === 'gastos_por_categoria' || tipo === 'gastos_por_proveedor') return [
    { header: tipo === 'gastos_por_categoria' ? 'Categoría' : 'Proveedor', get: c => c.nombre },
    { header: 'Cantidad de comprobantes', get: c => Number(c.cantidad), type: 'number' },
    { header: 'Monto',                    get: c => Number(c.monto), type: 'money' },
    { header: '% del total',              get: c => Number(c.porcentaje), type: 'percent' },
  ]
  if (tipo === 'finanzas_ingresos_gastos') return [
    { header: 'Período',         get: m => periodoLabel(m.mes) },
    { header: 'Pastaje cobrado', get: m => Number(m.pastaje), type: 'money' },
    { header: 'Ventas',          get: m => Number(m.ventas), type: 'money' },
    { header: 'Total ingresos',  get: m => Number(m.totalIngresos), type: 'money' },
    { header: 'Gastos',          get: m => Number(m.gastos), type: 'money' },
    { header: 'Resultado',       get: m => Number(m.resultado), type: 'money' },
  ]
  if (tipo === 'finanzas_cuentas_cobrar') return [
    { header: 'Cliente',         get: r => r.cliente },
    { header: 'Origen',          get: r => r.origen },
    { header: 'Referencia',      get: r => r.referencia },
    { header: 'Vencimiento',     get: r => r.vencimiento ? new Date(r.vencimiento + 'T00:00:00').toLocaleDateString('es-PY') : '-' },
    { header: 'Días de atraso',  get: r => Number(r.diasAtraso), type: 'number' },
    { header: 'Saldo',           get: r => Number(r.saldo), type: 'money' },
  ]
  return []
}

const fmtCell = (col, row) => {
  const v = col.get(row)
  if (col.type === 'money')   return `${gs(v)} Gs.`
  if (col.type === 'percent') return `${Number(v).toFixed(1)}%`
  return v ?? '-'
}
const rawCell = (col, row) => {
  const v = col.get(row)
  if (col.type === 'number' || col.type === 'money') return Number(v) || 0
  if (col.type === 'percent') return Number(Number(v).toFixed(1))
  return v ?? ''
}

// ── Ventas — detallado: agrupa por día con fila de subtotal ───────────────────
function filasConSubtotalDia(ventas) {
  const filas = []
  let grupoFecha = null, subtotal = 0
  const ordenadas = [...ventas].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero - b.numero)
  ordenadas.forEach(v => {
    if (grupoFecha !== null && v.fecha !== grupoFecha) {
      filas.push({ __subtotal: true, fecha: grupoFecha, total: subtotal })
      subtotal = 0
    }
    grupoFecha = v.fecha
    subtotal += Number(v.total)
    filas.push(v)
  })
  if (grupoFecha !== null) filas.push({ __subtotal: true, fecha: grupoFecha, total: subtotal })
  return filas
}

function totalRowNuevos(tipo, resultado) {
  if (tipo === 'ventas_detallado') {
    const cols = colSpecNuevos(tipo)
    return cols.map((c, i) => i === 0 ? 'TOTAL GENERAL' : i === cols.length - 1 ? resultado.reduce((s, v) => s + Number(v.total), 0) : '')
  }
  if (tipo === 'ventas_por_producto') return [
    'TOTAL GENERAL',
    resultado.reduce((s, p) => s + Number(p.cantidad), 0),
    resultado.reduce((s, p) => s + Number(p.monto), 0),
    100,
  ]
  if (tipo === 'ventas_por_cliente') return [
    'TOTAL GENERAL',
    resultado.reduce((s, c) => s + Number(c.cantidad), 0),
    resultado.reduce((s, c) => s + Number(c.total), 0),
    resultado.reduce((s, c) => s + Number(c.saldoFiado), 0),
  ]
  if (tipo === 'gastos_por_categoria' || tipo === 'gastos_por_proveedor') return [
    'TOTAL GENERAL',
    resultado.reduce((s, c) => s + Number(c.cantidad), 0),
    resultado.reduce((s, c) => s + Number(c.monto), 0),
    100,
  ]
  if (tipo === 'finanzas_ingresos_gastos') return [
    'TOTAL GENERAL',
    resultado.reduce((s, m) => s + Number(m.pastaje), 0),
    resultado.reduce((s, m) => s + Number(m.ventas), 0),
    resultado.reduce((s, m) => s + Number(m.totalIngresos), 0),
    resultado.reduce((s, m) => s + Number(m.gastos), 0),
    resultado.reduce((s, m) => s + Number(m.resultado), 0),
  ]
  if (tipo === 'finanzas_cuentas_cobrar') return [
    'TOTAL GENERAL', '', '', '', '',
    resultado.reduce((s, r) => s + Number(r.saldo), 0),
  ]
  return null
}

// ── headers/filas/totalRow crudos (números como Number) para CSV y Excel ─────
function datosExportNuevos(tipo, resultado) {
  const cols = colSpecNuevos(tipo)
  const headers = cols.map(c => c.header)
  const totalRow = totalRowNuevos(tipo, resultado)
  if (tipo === 'ventas_detallado') {
    const rows = filasConSubtotalDia(resultado).map(row => row.__subtotal
      ? cols.map((c, i) => i === 0 ? `Subtotal ${new Date(row.fecha + 'T00:00:00').toLocaleDateString('es-PY')}` : i === cols.length - 1 ? row.total : '')
      : cols.map(c => rawCell(c, row))
    )
    return { headers, rows, totalRow }
  }
  return { headers, rows: resultado.map(r => cols.map(c => rawCell(c, r))), totalRow }
}

// ── HTML con membrete para impresión (plantilla común) ────────────────────────
function htmlReporte(titulo, columnas, filas, filtrosTxt, usuario) {
  const bodyHtml = `
    ${printHeader({ titulo, filtrosTxt, usuario })}
    <h3 style="font-size:12px;font-weight:700;margin-bottom:8px">${filas.length} registros</h3>
    <table>
      <thead><tr>${columnas.map(c => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${filas.map(f => `<tr>${f.map(c => `<td>${c ?? '-'}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
    ${printFooter()}
  `
  return printDocument({ titleTag: titulo, bodyHtml })
}

// ── HTML especial para caja chica ─────────────────────────────────────────────
function htmlCajaChica(clienteNombre, filas, filtrosTxt, usuario) {
  const totalDeb = filas.reduce((s,r)=>s+r.debito,0)
  const totalCre = filas.reduce((s,r)=>s+r.credito,0)
  const saldoFinal = filas.length ? filas[filas.length-1].saldo : 0
  const fmt = n => n.toLocaleString('es-PY')
  const bodyHtml = `
    ${printHeader({ titulo: 'Movimiento de Caja', subtitulo: `Cliente: ${clienteNombre}`, filtrosTxt, usuario })}
    <table>
      <thead><tr>
        <th>Fecha</th><th>Concepto</th>
        <th style="text-align:right">Débito (Gs.)</th>
        <th style="text-align:right">Crédito (Gs.)</th>
        <th style="text-align:right">Saldo (Gs.)</th>
      </tr></thead>
      <tbody>
        ${filas.map(r=>`<tr>
          <td>${new Date(r.fecha).toLocaleDateString('es-PY')}</td>
          <td>${r.concepto}</td>
          <td style="text-align:right">${r.debito>0?fmt(r.debito):'-'}</td>
          <td style="text-align:right">${r.credito>0?fmt(r.credito):'-'}</td>
          <td style="text-align:right;font-weight:700;color:${r.saldo>0?'#c0392b':'#27ae60'}">${fmt(r.saldo)}</td>
        </tr>`).join('')}
        <tr class="pt-total-row">
          <td colspan="2">TOTALES</td>
          <td style="text-align:right">${fmt(totalDeb)}</td>
          <td style="text-align:right">${fmt(totalCre)}</td>
          <td style="text-align:right;color:${saldoFinal>0?'#c0392b':'#27ae60'}">${fmt(saldoFinal)}</td>
        </tr>
      </tbody>
    </table>
    ${printFooter()}
  `
  return printDocument({ titleTag: 'Movimiento de Caja', bodyHtml })
}

// ── PDF genérico para los reportes nuevos (Ventas/Gastos/Finanzas) ────────────
function htmlReporteNuevo(titulo, tipo, resultado, filtrosTxt, usuario) {
  const cols = colSpecNuevos(tipo)
  const totalRow = totalRowNuevos(tipo, resultado)
  const filas = tipo === 'ventas_detallado' ? filasConSubtotalDia(resultado) : resultado
  const filasHtml = filas.map(row => {
    if (row.__subtotal) {
      return `<tr class="pt-subtotal-row"><td colspan="${cols.length - 1}">Subtotal ${new Date(row.fecha + 'T00:00:00').toLocaleDateString('es-PY')}</td><td style="text-align:right">${gs(row.total)} Gs.</td></tr>`
    }
    return `<tr>${cols.map(c => `<td style="text-align:${c.type && c.type !== 'text' ? 'right' : 'left'}">${fmtCell(c, row)}</td>`).join('')}</tr>`
  }).join('')
  const totalHtml = totalRow
    ? `<tr class="pt-total-row">${totalRow.map((v, i) => {
        if (v === '' || v == null) return '<td></td>'
        if (i === 0) return `<td>${v}</td>`
        const display = cols[i]?.type === 'percent' ? `${Number(v).toFixed(1)}%` : `${gs(v)} Gs.`
        return `<td style="text-align:right">${display}</td>`
      }).join('')}</tr>`
    : ''

  const bodyHtml = `
    ${printHeader({ titulo, filtrosTxt, usuario })}
    <h3 style="font-size:12px;font-weight:700;margin-bottom:8px">${resultado.length} registros</h3>
    <table>
      <thead><tr>${cols.map(c => `<th style="text-align:${c.type && c.type !== 'text' ? 'right' : 'left'}">${c.header}</th>`).join('')}</tr></thead>
      <tbody>${filasHtml}${totalHtml}</tbody>
    </table>
    ${printFooter()}
  `
  return printDocument({ titleTag: titulo, bodyHtml })
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

export default function Reportes({ user, onNavigate }) {
  const perms = user?.rol === 'Administrador' ? { todo: true } : (user?.permisos || {})
  const puedeExportarPDF   = perms.todo || perms.exportar_pdf
  const puedeExportarCSV   = perms.todo || perms.exportar_csv
  const puedeExportarExcel = perms.todo || perms.exportar_excel
  const [tipo, setTipo] = useState('')
  const [cliente, setCliente] = useState('')
  const [proveedorFiltro, setProveedorFiltro] = useState('')
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
          .eq('estado', 'activo').order('fecha_ingreso', { ascending: true }).order('cliente_id')
        if (cliente) q = q.eq('cliente_id', parseInt(cliente))
        if (desde)   q = q.gte('fecha_ingreso', desde)
        if (hasta)   q = q.lte('fecha_ingreso', hasta)
        const { data: d } = await q
        resultado = d

      } else if (tipo === 'estado_cuenta') {
        let q = supabase.from('cobros')
          .select('*, clientes(nombre_razon_social), pagos(monto)')
          .order('periodo', { ascending: true })
        if (cliente) q = q.eq('cliente_id', parseInt(cliente))
        if (desde)   q = q.gte('fecha_generacion', desde)
        if (hasta)   q = q.lte('fecha_generacion', hasta)
        const { data: d } = await q
        resultado = d

      } else if (tipo === 'caja_chica') {
        if (!cliente) {
          setData({ tipo, resultado: [], error: 'Seleccioná un cliente para generar este reporte.' })
          setLoading(false); return
        }
        const cid = parseInt(cliente)

        // Cobros del cliente → Débito
        let qcob = supabase.from('cobros')
          .select('id,periodo,fecha_generacion,total')
          .eq('cliente_id', cid)
          .order('fecha_generacion')
        if (desde) qcob = qcob.gte('fecha_generacion', desde)
        if (hasta) qcob = qcob.lte('fecha_generacion', hasta)

        // Créditos adelantados del cliente → Crédito
        let qcr = supabase.from('creditos_cliente')
          .select('id,monto,fecha_pago,periodo_aplicar,cobros(periodo),observacion')
          .eq('cliente_id', cid)
          .order('fecha_pago')
        if (desde) qcr = qcr.gte('fecha_pago', desde)
        if (hasta) qcr = qcr.lte('fecha_pago', hasta)

        // Pagos directos (completo/parcial) → Crédito
        let qpag = supabase.from('pagos')
          .select('id,monto,tipo,fecha_pago,cobros(periodo,cliente_id)')
          .in('tipo', ['completo', 'parcial'])
          .order('fecha_pago')
        if (desde) qpag = qpag.gte('fecha_pago', desde)
        if (hasta) qpag = qpag.lte('fecha_pago', hasta + 'T23:59:59')

        const [cobRes, crRes, pagRes] = await Promise.all([qcob, qcr, qpag])

        const events = []

        ;(cobRes.data || []).forEach(c => {
          events.push({
            fecha:    c.fecha_generacion + 'T00:00:00',
            concepto: `Cobro ${periodoLabel(c.periodo)} (N°${c.id})`,
            debito:   Number(c.total),
            credito:  0,
          })
        })

        ;(crRes.data || []).forEach(cr => {
          const per = cr.cobros?.periodo || cr.periodo_aplicar || ''
          events.push({
            fecha:    cr.fecha_pago + 'T00:00:00',
            concepto: `Pago adelantado${per ? ' — ' + periodoLabel(per) : ''}`,
            debito:   0,
            credito:  Number(cr.monto),
          })
        })

        ;(pagRes.data || [])
          .filter(p => p.cobros?.cliente_id === cid)
          .forEach(p => {
            const per = p.cobros?.periodo || ''
            events.push({
              fecha:    p.fecha_pago,
              concepto: `Pago ${p.tipo === 'completo' ? 'completo' : 'parcial'}${per ? ' — ' + periodoLabel(per) : ''}`,
              debito:   0,
              credito:  Number(p.monto),
            })
          })

        // Ordenar por fecha y calcular saldo acumulado
        events.sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
        let saldo = 0
        resultado = events.map(ev => {
          saldo = saldo + ev.debito - ev.credito
          return { ...ev, saldo }
        })

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
          .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))

      } else if (tipo === 'ventas_detallado' || tipo === 'ventas_por_producto' || tipo === 'ventas_por_cliente') {
        let q = supabase.from('ventas')
          .select('id,numero,fecha,cliente_id,cliente_nombre,total,estado,forma_pago,venta_items(cantidad,subtotal,productos(nombre)),venta_cobros(monto)')
          .neq('estado', 'anulada')
          .order('fecha', { ascending: true }).order('numero', { ascending: true })
        if (cliente) q = q.eq('cliente_id', parseInt(cliente))
        if (desde)   q = q.gte('fecha', desde)
        if (hasta)   q = q.lte('fecha', hasta)
        const { data: ventasData } = await q

        if (tipo === 'ventas_detallado') {
          resultado = ventasData || []
        } else if (tipo === 'ventas_por_producto') {
          const mapa = {}
          ;(ventasData || []).forEach(v => v.venta_items?.forEach(it => {
            const nombre = it.productos?.nombre || 'Otro'
            if (!mapa[nombre]) mapa[nombre] = { nombre, cantidad: 0, monto: 0 }
            mapa[nombre].cantidad += Number(it.cantidad)
            mapa[nombre].monto += Number(it.subtotal)
          }))
          const totalGeneral = Object.values(mapa).reduce((s, p) => s + p.monto, 0)
          resultado = Object.values(mapa)
            .map(p => ({ ...p, porcentaje: totalGeneral > 0 ? (p.monto / totalGeneral) * 100 : 0 }))
            .sort((a, b) => b.monto - a.monto)
        } else {
          // ventas_por_cliente
          const mapa = {}
          ;(ventasData || []).forEach(v => {
            const key = v.cliente_id || 'consumidor_final'
            if (!mapa[key]) mapa[key] = { nombre: v.cliente_nombre || 'Consumidor final', cantidad: 0, total: 0, saldoFiado: 0 }
            mapa[key].cantidad += 1
            mapa[key].total += Number(v.total)
            if (v.estado === 'pendiente') {
              const cobrado = v.venta_cobros?.reduce((s, vc) => s + Number(vc.monto), 0) || 0
              mapa[key].saldoFiado += Math.max(0, Number(v.total) - cobrado)
            }
          })
          resultado = Object.values(mapa).sort((a, b) => b.total - a.total)
        }

      } else if (tipo === 'gastos_por_categoria' || tipo === 'gastos_por_proveedor') {
        let q = supabase.from('gastos').select('fecha,monto,proveedor,categorias_gasto(nombre)').order('fecha', { ascending: true })
        if (proveedorFiltro) q = q.ilike('proveedor', `%${proveedorFiltro}%`)
        if (desde) q = q.gte('fecha', desde)
        if (hasta) q = q.lte('fecha', hasta)
        const { data: gastosData } = await q

        const mapa = {}
        ;(gastosData || []).forEach(g => {
          const key = tipo === 'gastos_por_categoria' ? (g.categorias_gasto?.nombre || 'Sin categoría') : (g.proveedor || 'Sin proveedor')
          if (!mapa[key]) mapa[key] = { nombre: key, cantidad: 0, monto: 0 }
          mapa[key].cantidad += 1
          mapa[key].monto += Number(g.monto)
        })
        const totalGeneral = Object.values(mapa).reduce((s, c) => s + c.monto, 0)
        resultado = Object.values(mapa)
          .map(c => ({ ...c, porcentaje: totalGeneral > 0 ? (c.monto / totalGeneral) * 100 : 0 }))
          .sort((a, b) => b.monto - a.monto)

      } else if (tipo === 'finanzas_ingresos_gastos') {
        const [{ data: cobrosData }, { data: ventasData }, { data: gastosData }] = await Promise.all([
          supabase.from('cobros').select('periodo,pagos(monto,fecha_pago)'),
          supabase.from('ventas').select('fecha,total,estado,venta_cobros(monto,fecha)').neq('estado', 'anulada'),
          supabase.from('gastos').select('fecha,monto'),
        ])
        const dentroRango = (f) => (!desde || f >= desde) && (!hasta || f <= hasta + 'T23:59:59')

        const ingresosPorMes = {}
        ;(cobrosData || []).forEach(c => {
          if (!c.periodo) return
          ;(c.pagos || []).forEach(p => {
            if (!p.fecha_pago || !dentroRango(p.fecha_pago)) return
            if (!ingresosPorMes[c.periodo]) ingresosPorMes[c.periodo] = { pastaje: 0, ventas: 0 }
            ingresosPorMes[c.periodo].pastaje += Number(p.monto)
          })
        })
        const addVentaIngreso = (fecha, monto) => {
          if (!fecha || !dentroRango(fecha)) return
          const key = fecha.slice(0, 7)
          if (!ingresosPorMes[key]) ingresosPorMes[key] = { pastaje: 0, ventas: 0 }
          ingresosPorMes[key].ventas += monto
        }
        ;(ventasData || []).forEach(v => {
          if (v.estado === 'pagada') addVentaIngreso(v.fecha, Number(v.total))
          ;(v.venta_cobros || []).forEach(vc => addVentaIngreso(vc.fecha, Number(vc.monto)))
        })
        const gastosPorMes = {}
        ;(gastosData || []).forEach(g => {
          if (!g.fecha || !dentroRango(g.fecha)) return
          const key = g.fecha.slice(0, 7)
          gastosPorMes[key] = (gastosPorMes[key] || 0) + Number(g.monto)
        })

        const meses = new Set([...Object.keys(ingresosPorMes), ...Object.keys(gastosPorMes)])
        resultado = [...meses].sort().map(mes => {
          const ing = ingresosPorMes[mes] || { pastaje: 0, ventas: 0 }
          const gastosMes = gastosPorMes[mes] || 0
          const totalIngresos = ing.pastaje + ing.ventas
          return { mes, pastaje: ing.pastaje, ventas: ing.ventas, totalIngresos, gastos: gastosMes, resultado: totalIngresos - gastosMes }
        })

      } else if (tipo === 'finanzas_cuentas_cobrar') {
        let qc = supabase.from('cobros').select('id,periodo,total,estado,fecha_vencimiento,cliente_id,clientes(nombre_razon_social),pagos(monto)')
        let qv = supabase.from('ventas').select('id,numero,cliente_id,cliente_nombre,total,estado,fecha_vencimiento,venta_cobros(monto)').eq('estado', 'pendiente')
        if (cliente) { qc = qc.eq('cliente_id', parseInt(cliente)); qv = qv.eq('cliente_id', parseInt(cliente)) }
        const [{ data: cobrosData }, { data: ventasData }] = await Promise.all([qc, qv])

        const hoy = new Date()
        const filas = []
        ;(cobrosData || []).forEach(c => {
          const pag = c.pagos?.reduce((s, p) => s + Number(p.monto), 0) || 0
          const saldo = Number(c.total) - pag
          if (saldo <= 0) return
          const venc = c.fecha_vencimiento ? new Date(c.fecha_vencimiento + 'T00:00:00') : null
          const diasAtraso = venc && venc < hoy ? Math.floor((hoy - venc) / 86400000) : 0
          filas.push({ cliente: c.clientes?.nombre_razon_social || '—', origen: 'Pastaje', referencia: periodoLabel(c.periodo), vencimiento: c.fecha_vencimiento, diasAtraso, saldo })
        })
        ;(ventasData || []).forEach(v => {
          const cobrado = v.venta_cobros?.reduce((s, vc) => s + Number(vc.monto), 0) || 0
          const saldo = Number(v.total) - cobrado
          if (saldo <= 0) return
          const venc = v.fecha_vencimiento ? new Date(v.fecha_vencimiento + 'T00:00:00') : null
          const diasAtraso = venc && venc < hoy ? Math.floor((hoy - venc) / 86400000) : 0
          filas.push({ cliente: v.cliente_nombre, origen: 'Venta', referencia: `N° ${String(v.numero).padStart(4, '0')}`, vencimiento: v.fecha_vencimiento, diasAtraso, saldo })
        })
        resultado = filas.sort((a, b) => b.diasAtraso - a.diasAtraso)

      } else {
        // bajas / salidas / reclasificados / movimiento_general
        const tipoMap = { bajas:'baja', salidas:'salida', reclasificados:'reclasificacion', movimiento_general: undefined }
        let qmov = supabase.from('movimientos')
          .select('*, clientes(nombre_razon_social), cat_ant:categorias!movimientos_categoria_anterior_id_fkey(nombre), cat_nva:categorias!movimientos_categoria_nueva_id_fkey(nombre), usuarios(nombre_usuario)')
          .order('fecha', { ascending: true })
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
            .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
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

    if (data.tipo === 'caja_chica') {
      headers = ['Fecha','Concepto','Débito (Gs.)','Crédito (Gs.)','Saldo (Gs.)']
      csvRows = rows.map(r => [
        new Date(r.fecha).toLocaleDateString('es-PY'),
        r.concepto,
        r.debito || '',
        r.credito || '',
        r.saldo,
      ])
    } else if (data.tipo === 'pagos_realizados') {
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
    } else if (NUEVOS_TIPOS.includes(data.tipo)) {
      const { headers: h, rows: r, totalRow } = datosExportNuevos(data.tipo, rows)
      headers = h; csvRows = totalRow ? [...r, totalRow] : r
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
    const clienteNombre = clientes.find(c=>c.id===parseInt(cliente))?.nombre_razon_social || ''
    const filtrosTxt = [
      clienteNombre ? `Cliente: ${clienteNombre}` : null,
      proveedorFiltro ? `Proveedor: ${proveedorFiltro}` : null,
      desde ? `Desde: ${new Date(desde+'T00:00:00').toLocaleDateString('es-PY')}` : null,
      hasta ? `Hasta: ${new Date(hasta+'T00:00:00').toLocaleDateString('es-PY')}` : null,
    ].filter(Boolean).join(' | ')
    const usuario = user?.nombre_usuario

    // Caja chica tiene su propio template
    if (data.tipo === 'caja_chica') {
      abrirVentanaImpresion(htmlCajaChica(clienteNombre, data.resultado, filtrosTxt, usuario))
      return
    }

    if (NUEVOS_TIPOS.includes(data.tipo)) {
      const titulo = ALL_TIPOS.find(t => t.value === data.tipo)?.label || data.tipo
      abrirVentanaImpresion(htmlReporteNuevo(titulo, data.tipo, data.resultado, filtrosTxt, usuario))
      return
    }

    const tituloMap = {
      animales_activos:'Resumen de animales activos', estado_cuenta:'Estado de cuenta',
      pagos_realizados:'Pagos realizados', bajas:'Bajas de animales',
      salidas:'Salidas de animales', reclasificados:'Animales reclasificados',
      movimiento_general:'Movimiento general de animales',
    }
    const titulo = tituloMap[data.tipo] || data.tipo
    abrirVentanaImpresion(htmlReporte(titulo, columnasPDF(data.tipo), filasPDF(data.tipo, data.resultado), filtrosTxt, usuario))
  }

  const exportarExcelHandler = async () => {
    if (!data?.resultado?.length) return
    const rows = data.resultado
    let headers, excelRows, totalRow = null

    if (data.tipo === 'caja_chica') {
      headers = ['Fecha','Concepto','Débito (Gs.)','Crédito (Gs.)','Saldo (Gs.)']
      excelRows = rows.map(r => [new Date(r.fecha).toLocaleDateString('es-PY'), r.concepto, r.debito||0, r.credito||0, r.saldo])
      totalRow = ['TOTALES', '', rows.reduce((s,r)=>s+r.debito,0), rows.reduce((s,r)=>s+r.credito,0), rows.length?rows[rows.length-1].saldo:0]
    } else if (data.tipo === 'pagos_realizados') {
      headers = ['Fecha','Cliente','Período','Monto','Tipo','Medio','Observación','Usuario']
      excelRows = rows.map(r => [new Date(r.fecha).toLocaleDateString('es-PY'), r.cliente_nombre||'', periodoLabel(r.periodo)||'', Number(r.monto)||0, r.tipo_label||'', r.medio||'', r.observacion||'', r.usuario||''])
    } else if (data.tipo==='bajas'||data.tipo==='salidas'||data.tipo==='reclasificados'||data.tipo==='movimiento_general') {
      headers = ['Fecha','Cliente','Tipo','Cat. anterior','Cat. nueva','Cantidad','Causa','Usuario']
      excelRows = rows.map(r => [new Date(r.fecha).toLocaleDateString('es-PY'), r.clientes?.nombre_razon_social||'', r.tipo||'', r.cat_ant?.nombre||'', r.cat_nva?.nombre||'', Number(r.cantidad)||0, r.causa||r.observacion||'', r.usuarios?.nombre_usuario||''])
    } else if (data.tipo === 'animales_activos') {
      headers = ['ID','Cliente','Categoría','Cantidad','Fecha ingreso','Precio','Observaciones']
      excelRows = rows.map(r => [r.id, r.clientes?.nombre_razon_social||'', r.categorias?.nombre||'', Number(r.cantidad)||0, r.fecha_ingreso?new Date(r.fecha_ingreso+'T00:00:00').toLocaleDateString('es-PY'):'', Number(r.precio)||0, r.observaciones||''])
    } else if (data.tipo === 'estado_cuenta') {
      headers = ['N°','Cliente','Período','Total','Pagado','Saldo','Estado']
      excelRows = rows.map(r => {
        const pagado = r.pagos?.reduce((s,p)=>s+Number(p.monto),0)||0
        return [r.id, r.clientes?.nombre_razon_social||'', periodoLabel(r.periodo), Number(r.total)||0, pagado, Number(r.total)-pagado, r.estado]
      })
    } else if (NUEVOS_TIPOS.includes(data.tipo)) {
      const res = datosExportNuevos(data.tipo, rows)
      headers = res.headers; excelRows = res.rows; totalRow = res.totalRow
    } else {
      headers = Object.keys(rows[0]||{}).filter(k=>typeof rows[0][k]!=='object')
      excelRows = rows.map(r=>headers.map(h=>r[h]??''))
    }

    await exportarExcel({
      filename: `reporte_${data.tipo}_${new Date().toISOString().split('T')[0]}.xlsx`,
      sheetName: (ALL_TIPOS.find(t=>t.value===data.tipo)?.label || data.tipo).slice(0, 31),
      headers, rows: excelRows, totalRow,
    })
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
              {GRUPOS_TIPOS.map(g => (
                <optgroup key={g.grupo} label={g.grupo}>
                  {g.tipos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          {tipo === 'gastos_por_categoria' || tipo === 'gastos_por_proveedor' ? (
            <div className="form-group">
              <label>Proveedor</label>
              <input value={proveedorFiltro} onChange={e => setProveedorFiltro(e.target.value)} placeholder="Buscar..." />
            </div>
          ) : tipo !== 'finanzas_ingresos_gastos' ? (
            <div className="form-group">
              <label>Cliente</label>
              <select value={cliente} onChange={e => setCliente(e.target.value)}>
                <option value="">Todos</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre_razon_social}</option>)}
              </select>
            </div>
          ) : <div />}
          <div className="form-group">
            <label>Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} onKeyDown={e => e.key === 'Enter' && generar()} />
          </div>
          <div className="form-group">
            <label>Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} onKeyDown={e => e.key === 'Enter' && generar()} />
          </div>
        </div>
        <div className="btn-row">
          <button className="btn btn-blue" onClick={generar} disabled={!tipo || loading}>
            {loading ? 'Generando...' : 'Generar'}
          </button>
          {hayResultados && <>
            {puedeExportarCSV
              ? <button className="btn btn-green" onClick={exportarCSV}>Exportar CSV</button>
              : <span title="No tenés permiso para exportar CSV" style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 7, opacity: 0.6 }}>CSV bloqueado 🔒</span>
            }
            {puedeExportarExcel
              ? <button className="btn btn-purple" onClick={exportarExcelHandler}>Exportar Excel</button>
              : <span title="No tenés permiso para exportar Excel" style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 7, opacity: 0.6 }}>Excel bloqueado 🔒</span>
            }
            {puedeExportarPDF
              ? <button className="btn btn-orange" onClick={exportarPDF}>Exportar PDF</button>
              : <span title="No tenés permiso para exportar PDF" style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 7, opacity: 0.6 }}>PDF bloqueado 🔒</span>
            }
          </>}
        </div>
      </div>

      {data?.error && (
        <div className="alert alert-info">{data.error}</div>
      )}

      {data && !data.error && (
        <div className="table-container">
          <div style={{ padding:'12px 16px', fontWeight:700, borderBottom:'1px solid var(--border)' }}>
            {ALL_TIPOS.find(t=>t.value===data.tipo)?.label} — {data.resultado?.length||0} registros
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

            {/* ── Caja chica / movimiento de caja ── */}
            {data.tipo === 'caja_chica' && (() => {
              const totalDeb = data.resultado.reduce((s,r)=>s+r.debito,0)
              const totalCre = data.resultado.reduce((s,r)=>s+r.credito,0)
              const saldoFin = data.resultado.length ? data.resultado[data.resultado.length-1].saldo : 0
              return (
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Concepto</th>
                      <th style={{textAlign:'right'}}>Débito (Gs.)</th>
                      <th style={{textAlign:'right'}}>Crédito (Gs.)</th>
                      <th style={{textAlign:'right'}}>Saldo (Gs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!hayResultados
                      ? <tr><td colSpan={5} className="table-empty">Sin movimientos para el período seleccionado.</td></tr>
                      : <>
                          {data.resultado.map((r,i)=>(
                            <tr key={i}>
                              <td>{new Date(r.fecha).toLocaleDateString('es-PY')}</td>
                              <td>{r.concepto}</td>
                              <td style={{textAlign:'right',color:r.debito>0?'var(--red)':'var(--text-secondary)'}}>
                                {r.debito>0 ? gs(r.debito)+' Gs.' : '-'}
                              </td>
                              <td style={{textAlign:'right',color:r.credito>0?'var(--green)':'var(--text-secondary)'}}>
                                {r.credito>0 ? gs(r.credito)+' Gs.' : '-'}
                              </td>
                              <td style={{textAlign:'right',fontWeight:600,color:r.saldo>0?'var(--red)':'var(--green)'}}>
                                {gs(r.saldo)} Gs.
                              </td>
                            </tr>
                          ))}
                          <tr style={{background:'var(--table-head)',fontWeight:700}}>
                            <td colSpan={2} style={{fontWeight:700}}>TOTALES</td>
                            <td style={{textAlign:'right',color:'var(--red)',fontWeight:700}}>{gs(totalDeb)} Gs.</td>
                            <td style={{textAlign:'right',color:'var(--green)',fontWeight:700}}>{gs(totalCre)} Gs.</td>
                            <td style={{textAlign:'right',fontWeight:700,color:saldoFin>0?'var(--red)':'var(--green)'}}>
                              {gs(saldoFin)} Gs.
                            </td>
                          </tr>
                        </>
                    }
                  </tbody>
                </table>
              )
            })()}

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

            {/* ── Ventas / Gastos / Finanzas (reportes nuevos, tabla genérica) ── */}
            {NUEVOS_TIPOS.includes(data.tipo) && (() => {
              const cols = colSpecNuevos(data.tipo)
              const totalRow = totalRowNuevos(data.tipo, data.resultado)
              const filas = data.tipo === 'ventas_detallado' ? filasConSubtotalDia(data.resultado) : data.resultado
              return (
                <table>
                  <thead><tr>
                    {cols.map(c => <th key={c.header} style={{ textAlign: c.type && c.type !== 'text' ? 'right' : 'left' }}>{c.header}</th>)}
                  </tr></thead>
                  <tbody>
                    {!hayResultados
                      ? <tr><td colSpan={cols.length} className="table-empty">Sin resultados.</td></tr>
                      : <>
                          {filas.map((row, i) => row.__subtotal ? (
                            <tr key={'st'+i} style={{ background:'#eef2ff', fontWeight:700 }}>
                              <td colSpan={cols.length - 1}>Subtotal {new Date(row.fecha+'T00:00:00').toLocaleDateString('es-PY')}</td>
                              <td style={{ textAlign:'right' }}>{gs(row.total)} Gs.</td>
                            </tr>
                          ) : (
                            <tr key={row.id ?? i}>
                              {cols.map(c => <td key={c.header} style={{ textAlign: c.type && c.type !== 'text' ? 'right' : 'left' }}>{fmtCell(c, row)}</td>)}
                            </tr>
                          ))}
                          {totalRow && (
                            <tr style={{ background:'var(--table-head)', fontWeight:700 }}>
                              {totalRow.map((v, i) => {
                                let display = ''
                                if (v !== '' && v != null) {
                                  display = i === 0 ? v : cols[i]?.type === 'percent' ? `${Number(v).toFixed(1)}%` : `${gs(v)} Gs.`
                                }
                                return <td key={i} style={{ fontWeight:700, textAlign: i===0?'left':'right' }}>{display}</td>
                              })}
                            </tr>
                          )}
                        </>
                    }
                  </tbody>
                </table>
              )
            })()}

          </div>
        </div>
      )}
    </div>
  )
}
