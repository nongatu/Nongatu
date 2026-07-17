import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { gs, periodoLabel, fechaHoy } from '../utils/helpers'
import { getFraseHoy } from './Configuracion'
import Toast from './ui/Toast.jsx'

const PRODUCTO_COLORS = ['#f59e0b','#10b981','#22c55e','#ef4444','#3b82f6','#8b5cf6','#06b6d4']

const FRASES_DEFAULT = [
  '¡Que los números y el campo te acompañen hoy!',
  '¡Un buen día para mantener todo bajo control!',
  '¡El trabajo constante construye grandes resultados!',
  'Recordá revisar los cobros pendientes del mes.',
  '¡El campo bien gestionado es un campo próspero!',
  'Cada detalle registrado hoy es una decisión mejor mañana.',
  '¡Adelante, el trabajo bien hecho siempre vale la pena!',
  'Revisá si hay animales nuevos para registrar hoy.',
  '¡Los datos precisos son la base de un buen negocio!',
  'No olvides verificar los vencimientos de esta semana.',
  '¡Buen comienzo es medio camino andado!',
  '¡La organización es la clave del éxito ganadero!',
]

const fechaCorta = (f) => new Date(f + 'T00:00:00').toLocaleDateString('es-PY', { day: 'numeric', month: 'numeric' })

// Formato compacto para el centro de la dona (+77,1M / -320k / +5.000)
const formatCompacto = (n) => {
  const sign = n < 0 ? '-' : '+'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}k`
  return `${sign}${gs(abs)}`
}

// ── Barras: ventas del mes por producto ───────────────────────────────────────
function ProductoBars({ productos }) {
  if (!productos.length) {
    return <p style={{ color: 'var(--texto-2)', fontSize: 13 }}>Sin ventas registradas este mes.</p>
  }
  const maxVal = Math.max(...productos.map(p => p.monto), 1)
  return (
    <div className="num" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {productos.map((p, i) => (
        <div key={p.nombre} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
          <div style={{ background: 'var(--borde-suave)', borderRadius: 6, height: 12, overflow: 'hidden' }}>
            <div style={{ width: `${Math.round((p.monto / maxVal) * 100)}%`, height: '100%', background: PRODUCTO_COLORS[i % PRODUCTO_COLORS.length], borderRadius: 6 }} />
          </div>
          <span style={{ textAlign: 'right', fontWeight: 600, color: '#33405e' }}>{gs(p.monto)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard({ user, onNavigate }) {
  const [fin, setFin] = useState({
    ingresosMes: 0, gastosMes: 0, gastosMesCount: 0,
    cobradoMesPastaje: 0, ingresosVentasMes: 0,
    pendientePastaje: 0, pendienteFiados: 0,
  })
  const [chartMeses, setChartMeses]   = useState([])
  const [productosMes, setProductosMes] = useState([])
  const [ventasMesInfo, setVentasMesInfo] = useState({ cantidad: 0, total: 0 })
  const [porEspecie, setPorEspecie]   = useState([])
  const [actividadReciente, setActividadReciente] = useState([])
  const [pendientes, setPendientes]   = useState([])
  const [hoyStats, setHoyStats] = useState({ ventasCount: 0, ventasTotal: 0, gastosCount: 0, gastosTotal: 0, fiadosPorVencer: 0 })
  const [loading, setLoading]         = useState(true)

  // Cobro de venta fiada (desde "Pendientes de cobro")
  const [cuentasPago, setCuentasPago] = useState([])
  const [modalCobroVenta, setModalCobroVenta] = useState(null)
  const [cobroVentaForm, setCobroVentaForm] = useState({ fecha: '', monto: '', forma: 'efectivo', cuenta_id: '' })
  const [procesandoCobro, setProcesandoCobro] = useState(false)
  const [toast, setToast] = useState(null)

  // Checklist
  const puedeVerTareas = user?.rol === 'Administrador' || !!user?.permisos?.ver_tareas
  const [checklist, setChecklist] = useState([])
  const [nuevoItem, setNuevoItem] = useState('')
  const [nuevaVis, setNuevaVis]   = useState('admin')

  useEffect(() => {
    cargar()
    supabase.from('cuentas_pago').select('*').eq('activo', true).order('nombre').then(({ data }) => setCuentasPago(data || []))
  }, [])

  useEffect(() => {
    if (puedeVerTareas) cargarTareas()
  }, [puedeVerTareas])

  const cargar = async () => {
    setLoading(true)
    try {
      const hoy = new Date()
      const hoyStr = fechaHoy()
      const mesActualKey = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
      const last6Keys = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() - (5 - i), 1)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      })
      const en7dias = new Date(hoy); en7dias.setDate(en7dias.getDate() + 7)

      const [catRes, cobrosRes, ventasRes, gastosRes] = await Promise.all([
        supabase.from('animales')
          .select('cantidad,categorias(nombre,especies(nombre))')
          .eq('estado', 'activo'),
        supabase.from('cobros')
          .select('id,cliente_id,clientes(nombre_razon_social),total,estado,periodo,fecha_vencimiento,created_at,pagos(monto)'),
        supabase.from('ventas')
          .select('id,numero,fecha,fecha_vencimiento,total,estado,cliente_id,cliente_nombre,venta_items(cantidad,precio_unitario,subtotal,productos(nombre,unidad)),venta_cobros(monto,fecha),created_at'),
        supabase.from('gastos').select('id,fecha,monto,proveedor,descripcion,categorias_gasto(nombre),created_at'),
      ])

      const ventas = ventasRes.data || []
      const gastos = gastosRes.data || []

      // ── Actividad reciente: cobros de pastaje + ventas + gastos, por fecha ──
      const ventasRecientes = [...ventas].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4)
      const gastosRecientes = [...gastos].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4)
      const cobrosRecientes = [...(cobrosRes.data || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4)

      const actividad = [
        ...cobrosRecientes.map(c => ({
          id: 'c' + c.id, fecha: c.created_at,
          titulo: c.clientes?.nombre_razon_social || '',
          subtitulo: `Cobro pastaje · ${periodoLabel(c.periodo)}`,
          monto: Number(c.total), icon: '✔', bg: 'var(--azul-suave)',
        })),
        ...ventasRecientes.map(v => ({
          id: 'v' + v.id, fecha: v.created_at,
          titulo: v.cliente_nombre || 'Consumidor final',
          subtitulo: `Venta N° ${String(v.numero).padStart(4, '0')}`,
          monto: Number(v.total),
          icon: v.estado === 'pendiente' ? '🧾' : v.estado === 'anulada' ? '✕' : '💰',
          bg: v.estado === 'pendiente' ? 'var(--ambar-suave)' : v.estado === 'anulada' ? '#f1f4f9' : 'var(--verde-suave)',
        })),
        ...gastosRecientes.map(g => ({
          id: 'g' + g.id, fecha: g.created_at,
          titulo: g.proveedor || g.descripcion,
          subtitulo: `Gasto · ${g.categorias_gasto?.nombre || 'Sin categoría'}`,
          monto: Number(g.monto), icon: '💸', bg: 'var(--rojo-suave)',
        })),
      ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 8)
      setActividadReciente(actividad)

      // ── Pastaje: cobrado del mes, pendiente total, ingresos por mes ──
      // Se agrupa por `periodo` (mes de servicio que factura el cobro), no por la
      // fecha real del pago: es el mismo criterio que usa el resto de la app
      // (Cobros, Actividad reciente) y el que tiene datos históricos consistentes.
      let cobradoMesPastaje = 0
      let pendientePastaje  = 0
      const ingresosPagosPorMes = {}
      const cobrosPendientesList = []
      cobrosRes.data?.forEach(c => {
        const pag = c.pagos?.reduce((s, p) => s + Number(p.monto), 0) || 0
        const saldo = Number(c.total) - pag
        pendientePastaje += Math.max(0, saldo)
        if (saldo > 0.009) {
          cobrosPendientesList.push({
            id: 'pc' + c.id, tipo: 'pastaje',
            cliente: c.clientes?.nombre_razon_social || '',
            sub: `Pastaje · ${periodoLabel(c.periodo)}`,
            saldo, vencimiento: c.fecha_vencimiento || `${c.periodo}-28`,
          })
        }
        if (!c.periodo) return
        ingresosPagosPorMes[c.periodo] = (ingresosPagosPorMes[c.periodo] || 0) + pag
        if (c.periodo === mesActualKey) cobradoMesPastaje += pag
      })

      // ── Ventas: contado del mes, cobros de fiado, pendiente fiado, por producto ──
      let ventasContadoMes = 0
      let ventaCobrosMesTotal = 0
      let pendienteFiados = 0
      let ventasCountMes = 0
      const productoTotalesMes = {}
      const ventasIngresosPorMes = {}
      const ventasPendientesList = []

      ventas.forEach(v => {
        const vMesKey = v.fecha?.slice(0, 7)
        const cobrosVenta = v.venta_cobros || []
        const cobradoVenta = cobrosVenta.reduce((s, vc) => s + Number(vc.monto), 0)

        if (v.estado === 'pagada') {
          ventasIngresosPorMes[vMesKey] = (ventasIngresosPorMes[vMesKey] || 0) + Number(v.total)
          if (vMesKey === mesActualKey) ventasContadoMes += Number(v.total)
        }
        if (v.estado === 'pendiente') {
          const saldo = Number(v.total) - cobradoVenta
          pendienteFiados += Math.max(0, saldo)
          if (saldo > 0.009) {
            ventasPendientesList.push({
              id: 'pv' + v.id, tipo: 'venta',
              cliente: v.cliente_nombre || 'Consumidor final',
              sub: `Fiado ${String(v.numero).padStart(4, '0')}${v.fecha_vencimiento ? ' · vence ' + fechaCorta(v.fecha_vencimiento) : ''}`,
              saldo, vencimiento: v.fecha_vencimiento || v.fecha, venta: v,
            })
          }
        }
        cobrosVenta.forEach(vc => {
          const cKey = vc.fecha?.slice(0, 7)
          if (!cKey) return
          ventasIngresosPorMes[cKey] = (ventasIngresosPorMes[cKey] || 0) + Number(vc.monto)
          if (cKey === mesActualKey) ventaCobrosMesTotal += Number(vc.monto)
        })
        if (vMesKey === mesActualKey && v.estado !== 'anulada') {
          ventasCountMes++
          v.venta_items?.forEach(it => {
            const nombre = it.productos?.nombre || 'Otro'
            productoTotalesMes[nombre] = (productoTotalesMes[nombre] || 0) + Number(it.subtotal)
          })
        }
      })
      const ingresosVentasMes = ventasContadoMes + ventaCobrosMesTotal
      const listaProductos = Object.entries(productoTotalesMes)
        .map(([nombre, monto]) => ({ nombre, monto }))
        .sort((a, b) => b.monto - a.monto)
      setProductosMes(listaProductos)
      setVentasMesInfo({ cantidad: ventasCountMes, total: listaProductos.reduce((s, p) => s + p.monto, 0) })

      setPendientes(
        [...ventasPendientesList, ...cobrosPendientesList]
          .sort((a, b) => new Date(a.vencimiento) - new Date(b.vencimiento))
      )

      // ── Gastos: total del mes, por mes ──
      let gastosMesTotal = 0
      let gastosMesCount = 0
      const gastosPorMes = {}
      gastos.forEach(g => {
        const key = g.fecha?.slice(0, 7)
        if (!key) return
        gastosPorMes[key] = (gastosPorMes[key] || 0) + Number(g.monto)
        if (key === mesActualKey) { gastosMesTotal += Number(g.monto); gastosMesCount++ }
      })

      setFin({
        ingresosMes: cobradoMesPastaje + ingresosVentasMes,
        gastosMes: gastosMesTotal,
        gastosMesCount,
        cobradoMesPastaje,
        ingresosVentasMes,
        pendientePastaje,
        pendienteFiados,
      })

      setChartMeses(last6Keys.map(key => ({
        periodo: key,
        ingresos: (ingresosPagosPorMes[key] || 0) + (ventasIngresosPorMes[key] || 0),
        gastos: gastosPorMes[key] || 0,
      })))

      // ── "Parte del día": ventas de hoy, gastos de hoy, fiados por vencer ──
      const ventasHoyArr = ventas.filter(v => v.fecha === hoyStr && v.estado !== 'anulada')
      const gastosHoyArr = gastos.filter(g => g.fecha === hoyStr)
      const fiadosPorVencer = ventas.filter(v => {
        if (v.estado !== 'pendiente' || !v.fecha_vencimiento) return false
        const fv = new Date(v.fecha_vencimiento + 'T00:00:00')
        return fv >= new Date(hoyStr + 'T00:00:00') && fv <= en7dias
      }).length
      setHoyStats({
        ventasCount: ventasHoyArr.length,
        ventasTotal: ventasHoyArr.reduce((s, v) => s + Number(v.total), 0),
        gastosCount: gastosHoyArr.length,
        gastosTotal: gastosHoyArr.reduce((s, g) => s + Number(g.monto), 0),
        fiadosPorVencer,
      })

      // ── Por especie (solo totales, sin desglose por categoría) ──
      const mapa = {}
      catRes.data?.forEach(a => {
        const espNombre = a.categorias?.especies?.nombre
        if (!espNombre) return
        mapa[espNombre] = (mapa[espNombre] || 0) + Number(a.cantidad)
      })
      setPorEspecie(
        Object.entries(mapa).map(([especie, total]) => ({ especie, total })).sort((a, b) => b.total - a.total)
      )
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  // Checklist — Supabase
  const cargarTareas = async () => {
    const { data } = await supabase.from('tareas').select('*').order('created_at')
    // Admins ven todas; usuarios con ver_tareas solo ven las de visibilidad 'todos'
    const filtradas = (data || []).filter(t =>
      user?.rol === 'Administrador' || t.visibilidad === 'todos'
    )
    setChecklist(filtradas)
  }
  const agregarItem = async () => {
    if (!nuevoItem.trim()) return
    const { data } = await supabase.from('tareas')
      .insert({ texto: nuevoItem.trim(), hecha: false, visibilidad: nuevaVis })
      .select().single()
    if (data) setChecklist(prev => [...prev, data])
    setNuevoItem('')
    setNuevaVis('admin')
  }
  const toggleItem = async (id, hecha) => {
    await supabase.from('tareas').update({ hecha: !hecha }).eq('id', id)
    setChecklist(prev => prev.map(i => i.id === id ? { ...i, hecha: !i.hecha } : i))
  }
  const eliminarItem = async (id) => {
    await supabase.from('tareas').delete().eq('id', id)
    setChecklist(prev => prev.filter(i => i.id !== id))
  }

  // ── Cobro de una venta fiada pendiente ──
  const abrirCobroVenta = (venta) => {
    const cobrado = venta.venta_cobros?.reduce((s, vc) => s + Number(vc.monto), 0) || 0
    const saldo = Number(venta.total) - cobrado
    setCobroVentaForm({ fecha: fechaHoy(), monto: String(saldo), forma: 'efectivo', cuenta_id: '' })
    setModalCobroVenta(venta)
  }
  const registrarCobroVenta = async () => {
    const venta = modalCobroVenta
    const { fecha, monto, forma, cuenta_id } = cobroVentaForm
    if (!monto || Number(monto) <= 0) return setToast({ type: 'error', text: 'Ingresá un monto válido.' })
    if (forma === 'transferencia' && !cuenta_id) return setToast({ type: 'error', text: 'Seleccioná la cuenta.' })
    setProcesandoCobro(true)
    const montoNum = Number(monto)
    const { error } = await supabase.from('venta_cobros').insert({
      venta_id: venta.id, fecha, monto: montoNum, forma,
      cuenta_id: forma === 'transferencia' ? parseInt(cuenta_id) : null,
      usuario: user?.nombre_usuario,
    })
    if (error) { setProcesandoCobro(false); return setToast({ type: 'error', text: 'Error al registrar el cobro.' }) }

    const cobradoPrevio = venta.venta_cobros?.reduce((s, vc) => s + Number(vc.monto), 0) || 0
    const saldoRestante = Number(venta.total) - (cobradoPrevio + montoNum)

    if (saldoRestante <= 0) {
      await supabase.from('ventas').update({ estado: 'pagada' }).eq('id', venta.id)
      const { data: recActuales } = await supabase.from('recibos').select('id').order('id', { ascending: false }).limit(1)
      const maxId = recActuales?.[0]?.id || 0
      const numero = String(maxId + 1).padStart(6, '0')
      await supabase.from('recibos').insert({
        numero, fecha, cliente_id: venta.cliente_id, total: Number(venta.total),
        detalle: {
          origen: 'venta', venta_id: venta.id, numero_venta: venta.numero, cliente_nombre: venta.cliente_nombre,
          items: (venta.venta_items || []).map(it => ({
            nombre: it.productos?.nombre || '', unidad: it.productos?.unidad || '',
            cantidad: it.cantidad, precio_unitario: it.precio_unitario, subtotal: it.subtotal,
          })),
        },
      })
    }
    setModalCobroVenta(null)
    setToast({ type: 'success', text: saldoRestante <= 0 ? 'Cobro registrado. La venta quedó pagada.' : 'Cobro parcial registrado.' })
    setProcesandoCobro(false)
    cargar()
  }

  const hoy   = new Date()
  const frase = getFraseHoy() ?? FRASES_DEFAULT[hoy.getDate() % FRASES_DEFAULT.length]

  const nombreSaludo = (() => {
    try {
      const saved = localStorage.getItem(`profile_data_${user?.nombre_usuario}`)
      if (saved) {
        const p = JSON.parse(saved)
        return p.apodo?.trim() || p.nombre?.trim() || null
      }
    } catch {}
    return null
  })() || user?.nombre_usuario || ''

  const fechaStr = hoy.toLocaleDateString('es-PY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const fechaCap = fechaStr.charAt(0).toUpperCase() + fechaStr.slice(1)
  const mesLabelStr = hoy.toLocaleDateString('es-PY', { month: 'long' })
  const mesLabelCap = mesLabelStr.charAt(0).toUpperCase() + mesLabelStr.slice(1)
  const totalAnimales = porEspecie.reduce((s, e) => s + e.total, 0)

  const resultadoMes = fin.ingresosMes - fin.gastosMes
  const porCobrarTotal = fin.pendientePastaje + fin.pendienteFiados

  const parteTexto = [
    hoyStats.ventasCount > 0
      ? `Hoy: ${hoyStats.ventasCount} venta${hoyStats.ventasCount === 1 ? '' : 's'} por ${gs(hoyStats.ventasTotal)} Gs.`
      : 'Hoy: ninguna venta todavía',
    hoyStats.gastosCount > 0
      ? `${hoyStats.gastosCount} gasto${hoyStats.gastosCount === 1 ? '' : 's'} por ${gs(hoyStats.gastosTotal)} Gs.`
      : 'ningún gasto todavía',
    hoyStats.fiadosPorVencer > 0
      ? `${hoyStats.fiadosPorVencer} fiado${hoyStats.fiadosPorVencer === 1 ? '' : 's'} por vencer esta semana`
      : 'sin fiados por vencer esta semana',
  ].join(' · ')

  const CARDS = [
    { label: 'Ingresos del mes', value: gs(fin.ingresosMes) + ' Gs.', cls: 'green',
      detalle: `Pastaje ${gs(fin.cobradoMesPastaje)} · Ventas ${gs(fin.ingresosVentasMes)}` },
    { label: 'Gastos del mes', value: gs(fin.gastosMes) + ' Gs.', cls: 'red',
      detalle: fin.gastosMesCount > 0 ? `${fin.gastosMesCount} comprobante${fin.gastosMesCount === 1 ? '' : 's'} · todo al contado` : 'Sin gastos registrados' },
    { label: 'Resultado del mes', value: (resultadoMes >= 0 ? '+' : '') + gs(resultadoMes) + ' Gs.', cls: 'purple',
      detalle: `Ingresos − gastos · ${mesLabelCap}` },
    { label: 'Por cobrar', value: gs(porCobrarTotal) + ' Gs.', cls: 'orange',
      detalle: `Fiados ${gs(fin.pendienteFiados)} · Pastaje ${gs(fin.pendientePastaje)}` },
  ]

  // ── Dona: ingresos vs gastos, últimos 6 meses acumulados ──
  const ingresos6 = chartMeses.reduce((s, m) => s + m.ingresos, 0)
  const gastos6   = chartMeses.reduce((s, m) => s + m.gastos, 0)
  const resultado6 = ingresos6 - gastos6
  const total6 = ingresos6 + gastos6
  const CIRCUNF = 2 * Math.PI * 38
  const ingresosLen = total6 > 0 ? (ingresos6 / total6) * CIRCUNF : 0
  const mesCorto = (periodo) => {
    const [y, m] = periodo.split('-')
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-PY', { month: 'short' }).replace('.', '')
  }
  const rangoMeses = chartMeses.length === 6
    ? `${mesCorto(chartMeses[0].periodo)}–${mesCorto(chartMeses[5].periodo)} ${chartMeses[5].periodo.split('-')[0]}`
    : ''

  if (loading) return <div className="spinner" />

  const rightColRows = puedeVerTareas ? 'auto auto minmax(0,1fr)' : 'auto minmax(0,1fr)'

  return (
    <div className="dash-shell">

      {/* ── Bienvenida ── */}
      <div style={{
        background: 'linear-gradient(92deg, var(--sb-top), var(--sb-bot))',
        borderRadius: 'var(--r)', padding: '14px 20px', color: '#fff',
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', flexShrink: 0,
      }}>
        <div>
          <div style={{ fontFamily: 'var(--disp)', fontSize: 19, fontWeight: 600, letterSpacing: '-0.3px' }}>
            Bienvenida a Ñongatu, {nombreSaludo}
          </div>
          <div style={{ fontSize: 11.5, color: '#c4d2f0', marginTop: 2 }}>{fechaCap}{frase ? ` · ${frase}` : ''}</div>
          <div className="num" style={{ fontSize: 12, color: '#eaf0fd', marginTop: 6, display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--hoja)', flexShrink: 0 }} />
            {parteTexto}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-green" onClick={() => onNavigate?.('ventas')}>+ Nueva venta</button>
          <button className="btn btn-outline" onClick={() => onNavigate?.('gastos')}>+ Nuevo gasto</button>
          <button className="btn btn-outline" onClick={() => onNavigate?.('cobros')}>Cobros</button>
        </div>
      </div>

      {/* ── 4 tarjetas de indicadores ── */}
      <div className="metric-cards dash-stats" style={{ marginBottom: 0 }}>
        {CARDS.map(card => (
          <div key={card.label} className={`metric-card ${card.cls}`}>
            <div className="label">{card.label}</div>
            <div className="value num">{card.value}</div>
            <div className="num" style={{ fontSize: 11, color: 'var(--texto-2)', marginTop: 2 }}>{card.detalle}</div>
          </div>
        ))}
      </div>

      {/* ── Cuerpo: columna principal (2fr) | columna derecha (1fr) ── */}
      <div className="dash-body">

        {/* ── Columna principal ── */}
        <div className="dash-col" style={{ gridTemplateRows: 'auto minmax(0,1fr)' }}>

          {/* Animales en pastura */}
          <div className="dash-card c-past" style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 2 }}>Animales en pastura</div>
            <div style={{ fontSize: 12, color: 'var(--texto-2)', marginBottom: 6 }}>
              El número grande, de un vistazo · el detalle vive en Animales y Reportes
            </div>
            {porEspecie.length === 0 ? (
              <p style={{ color: 'var(--texto-2)', fontSize: 13 }}>Sin datos. Registrá categorías y animales.</p>
            ) : (
              <div className="num" style={{ display: 'flex', gap: 22, alignItems: 'flex-end', flexWrap: 'wrap', margin: '4px 0 2px' }}>
                {porEspecie.map(esp => (
                  <div key={esp.especie}>
                    <div style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 46, letterSpacing: '-1.5px', lineHeight: 1, color: 'var(--navy-900)' }}>{esp.total}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--texto-2)', marginTop: 4 }}>{esp.especie}</div>
                  </div>
                ))}
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 46, letterSpacing: '-1.5px', lineHeight: 1, color: 'var(--verde)' }}>{totalAnimales}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--texto-2)', marginTop: 4 }}>Total en pastura</div>
                </div>
              </div>
            )}
          </div>

          <div className="dash-row2">
            {/* Pendientes de cobro */}
            <div className="dash-card dash-card-flex c-pend">
              <div style={{ fontSize: 14.5, fontWeight: 600, flexShrink: 0 }}>Pendientes de cobro</div>
              <div className="num" style={{ fontSize: 12, color: 'var(--texto-2)', marginBottom: 6, flexShrink: 0 }}>Total: {gs(porCobrarTotal)} Gs.</div>
              <div className="dash-scroll">
                {pendientes.length === 0 ? (
                  <p style={{ color: 'var(--texto-2)', fontSize: 13 }}>Sin pendientes de cobro. 🎉</p>
                ) : pendientes.map(p => (
                  <div key={p.id} className="num" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--borde-suave)', fontSize: 12.5 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cliente}</div>
                      <div style={{ fontSize: 11, color: 'var(--texto-2)' }}>{p.sub}</div>
                    </div>
                    <span style={{ fontWeight: 700, flexShrink: 0 }}>{gs(p.saldo)}</span>
                    {p.tipo === 'venta'
                      ? <button className="btn btn-green btn-sm" onClick={() => abrirCobroVenta(p.venta)}>Cobrar</button>
                      : <button className="btn btn-outline btn-sm" onClick={() => onNavigate?.('cobros')}>Ver</button>}
                  </div>
                ))}
              </div>
            </div>

            {/* Actividad reciente */}
            <div className="dash-card dash-card-flex c-acti">
              <div style={{ fontSize: 14.5, fontWeight: 600, flexShrink: 0 }}>Actividad reciente</div>
              <div style={{ fontSize: 12, color: 'var(--texto-2)', marginBottom: 6, flexShrink: 0 }}>Ventas, gastos y cobros</div>
              <div className="dash-scroll">
                {actividadReciente.length === 0 ? (
                  <p style={{ color: 'var(--texto-2)', fontSize: 13 }}>Sin actividad registrada.</p>
                ) : actividadReciente.map(a => (
                  <div key={a.id} className="num" style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--borde-suave)', fontSize: 12.5, alignItems: 'flex-start' }}>
                    <div style={{ flex: 'none', width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, background: a.bg }}>{a.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo}</div>
                      <div style={{ fontSize: 11, color: 'var(--texto-2)', marginTop: 1 }}>{a.subtitulo}</div>
                    </div>
                    <div style={{ fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>{gs(a.monto)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Columna derecha ── */}
        <div className="dash-col" style={{ gridTemplateRows: rightColRows }}>

          {/* Tareas pendientes */}
          {puedeVerTareas && (
            <div className="dash-card dash-card-flex c-tar">
              <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 2, flexShrink: 0 }}>Tareas pendientes</div>
              <div style={{ fontSize: 12, color: 'var(--texto-2)', marginBottom: 8, flexShrink: 0 }}>Círculo para completar · ✕ para eliminar</div>
              <div className="dash-scroll" style={{ flex: 1 }}>
                {checklist.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--texto-2)', textAlign: 'center', padding: '16px 0', lineHeight: 1.7 }}>
                    Sin tareas aún.<br />Agregá lo que tenés<br />pendiente hoy.
                  </div>
                ) : checklist.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--borde-suave)' }}>
                    <div onClick={() => toggleItem(item.id, item.hecha)} className={`check-circle ${item.hecha ? 'checked' : ''}`} style={{ marginTop: 1 }} />
                    <span style={{ flex: 1, fontSize: 12.5, lineHeight: 1.45, cursor: 'pointer', textDecoration: item.hecha ? 'line-through' : 'none', color: item.hecha ? '#93a1bd' : 'var(--texto)' }} onClick={() => toggleItem(item.id, item.hecha)}>
                      {item.texto}
                      {user?.rol === 'Administrador' && item.visibilidad === 'todos' && (
                        <span style={{ marginLeft: 5, fontSize: 9, background: 'var(--azul-suave)', color: '#1e40af', borderRadius: 4, padding: '1px 4px', fontWeight: 600 }}>Todos</span>
                      )}
                    </span>
                    <button onClick={() => eliminarItem(item.id)} style={{ flex: 'none', background: 'none', border: 'none', color: '#c4cede', fontSize: 14, cursor: 'pointer', padding: '0 2px', lineHeight: 1.4 }} title="Eliminar">✕</button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 9, flexShrink: 0 }}>
                <input
                  value={nuevoItem}
                  onChange={e => setNuevoItem(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && agregarItem()}
                  placeholder="Agregar tarea…"
                  style={{ flex: 1, fontSize: 12.5, padding: '7px 10px', border: '1px solid #cdd6e4', borderRadius: 9, background: '#fff', color: 'var(--texto)', outline: 'none' }}
                />
                <button onClick={agregarItem} className="btn btn-green btn-sm">+</button>
              </div>
              {user?.rol === 'Administrador' && (
                <select
                  value={nuevaVis}
                  onChange={e => setNuevaVis(e.target.value)}
                  style={{ marginTop: 6, fontSize: 11, padding: '4px 7px', border: '1px solid #cdd6e4', borderRadius: 8, background: '#fff', color: 'var(--texto-2)', cursor: 'pointer', flexShrink: 0 }}
                >
                  <option value="admin">Solo administradores</option>
                  <option value="todos">Todos (usuarios con permiso)</option>
                </select>
              )}
            </div>
          )}

          {/* Ingresos vs gastos — dona */}
          <div className="dash-card c-donut" style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Ingresos vs gastos</div>
            <div className="num" style={{ fontSize: 12, color: 'var(--texto-2)', marginBottom: 10 }}>Últimos 6 meses (acumulado){rangoMeses ? ` · ${rangoMeses}` : ''}</div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <svg width="90" height="90" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
                <circle cx="50" cy="50" r="38" fill="none" stroke="var(--borde-suave)" strokeWidth="13" />
                {total6 > 0 && <>
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#10b981" strokeWidth="13"
                    strokeDasharray={`${ingresosLen} ${CIRCUNF - ingresosLen}`}
                    transform="rotate(-90 50 50)" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#f87171" strokeWidth="13"
                    strokeDasharray={`${CIRCUNF - ingresosLen} ${ingresosLen}`}
                    strokeDashoffset={-ingresosLen}
                    transform="rotate(-90 50 50)" />
                </>}
                <text x="50" y="47" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--navy-900)">{formatCompacto(resultado6)}</text>
                <text x="50" y="59" textAnchor="middle" fontSize="7" fill="var(--texto-2)">resultado</text>
              </svg>
              <div className="num" style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: '#10b981', flexShrink: 0 }} />Ingresos · {gs(ingresos6)}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: '#f87171', flexShrink: 0 }} />Gastos · {gs(gastos6)}</span>
              </div>
            </div>
          </div>

          {/* Ventas del mes por producto */}
          <div className="dash-card dash-card-flex c-prod">
            <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 1, flexShrink: 0 }}>Ventas del mes por producto</div>
            <div className="num" style={{ fontSize: 12, color: 'var(--texto-2)', marginBottom: 10, flexShrink: 0 }}>
              {ventasMesInfo.cantidad} venta{ventasMesInfo.cantidad === 1 ? '' : 's'} · {gs(ventasMesInfo.total)} Gs.
            </div>
            <div className="dash-scroll">
              <ProductoBars productos={productosMes} />
            </div>
          </div>
        </div>

      </div>

      {/* ── Modal: registrar cobro de venta fiada ── */}
      {modalCobroVenta && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModalCobroVenta(null) }}>
          <div className="modal">
            <h3>Registrar cobro</h3>
            <p style={{ marginBottom: 4, fontSize: 14 }}>Cliente: <strong>{modalCobroVenta.cliente_nombre}</strong></p>
            <p style={{ marginBottom: 4, fontSize: 14 }}>Venta N°: <strong>{String(modalCobroVenta.numero).padStart(4, '0')}</strong></p>
            <p className="num" style={{ marginBottom: 16, fontSize: 14, color: 'var(--rojo)' }}>
              Saldo: <strong>{gs(Number(modalCobroVenta.total) - (modalCobroVenta.venta_cobros?.reduce((s, vc) => s + Number(vc.monto), 0) || 0))} Gs.</strong>
            </p>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Fecha *</label>
              <input type="date" value={cobroVentaForm.fecha} onChange={e => setCobroVentaForm({ ...cobroVentaForm, fecha: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Monto (Gs.) *</label>
              <input type="number" min="1" value={cobroVentaForm.monto} onChange={e => setCobroVentaForm({ ...cobroVentaForm, monto: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Forma de pago *</label>
              <select value={cobroVentaForm.forma} onChange={e => setCobroVentaForm({ ...cobroVentaForm, forma: e.target.value, cuenta_id: '' })}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>
            {cobroVentaForm.forma === 'transferencia' && (
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Cuenta *</label>
                <select value={cobroVentaForm.cuenta_id} onChange={e => setCobroVentaForm({ ...cobroVentaForm, cuenta_id: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {cuentasPago.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModalCobroVenta(null)}>Cancelar</button>
              <button className="btn btn-green" onClick={registrarCobroVenta} disabled={procesandoCobro}>{procesandoCobro ? 'Procesando...' : 'Confirmar cobro'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast text={toast.text} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
