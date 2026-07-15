import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { gs, periodoLabel } from '../utils/helpers'
import { getFraseHoy } from './Configuracion'

const ESPECIE_COLORS  = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316']
const ESPECIE_ICONS   = ['🐄','🐎','🐑','🐐','🐖','🐓','🐾']
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

// ── Barras: ventas del mes por producto ───────────────────────────────────────
function ProductoBars({ productos }) {
  if (!productos.length) {
    return <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sin ventas registradas este mes.</p>
  }
  const maxVal = Math.max(...productos.map(p => p.monto), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {productos.map((p, i) => (
        <div key={p.nombre} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
          <div style={{ background: 'var(--main-bg,#f1f5f9)', borderRadius: 6, height: 13, overflow: 'hidden' }}>
            <div style={{ width: `${Math.round((p.monto / maxVal) * 100)}%`, height: '100%', background: PRODUCTO_COLORS[i % PRODUCTO_COLORS.length], borderRadius: 6 }} />
          </div>
          <span style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>{gs(p.monto)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Barra vertical proporcional: crece con flex, ocupa toda la altura disponible ──
function VBar({ frac, color, title, children }) {
  return (
    <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} title={title}>
      <div style={{ flexGrow: Math.max(0, 1 - frac), flexShrink: 0 }} />
      <div style={{
        flexGrow: Math.max(frac, 0.02), flexShrink: 0, minHeight: 3,
        background: color, borderRadius: '4px 4px 0 0', opacity: 0.9,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 2,
      }}>
        {children}
      </div>
    </div>
  )
}

// ── Barras: ingresos vs gastos (últimos 6 meses) ──────────────────────────────
function IngresosGastosChart({ meses }) {
  if (!meses.length) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>Sin datos suficientes aún</div>
  }
  const maxVal = Math.max(...meses.flatMap(m => [m.ingresos, m.gastos]), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 10, flex: 1, minHeight: 0 }}>
        {meses.map(m => (
          <div key={m.periodo} style={{ flex: 1, minWidth: 0, display: 'flex', gap: 3, height: '100%' }}>
            <VBar frac={m.ingresos / maxVal} color="#10b981" title={`Ingresos: ${gs(m.ingresos)} Gs.`} />
            <VBar frac={m.gastos / maxVal} color="#f87171" title={`Gastos: ${gs(m.gastos)} Gs.`} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 4, flexShrink: 0 }}>
        {meses.map(m => (
          <span key={m.periodo} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'var(--text-secondary)' }}>
            {new Date(m.periodo + '-15').toLocaleDateString('es-PY', { month: 'short' })}
          </span>
        ))}
      </div>
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
  const [loading, setLoading]         = useState(true)

  // Checklist
  const puedeVerTareas = user?.rol === 'Administrador' || !!user?.permisos?.ver_tareas
  const [checklist, setChecklist] = useState([])
  const [nuevoItem, setNuevoItem] = useState('')
  const [nuevaVis, setNuevaVis]   = useState('admin')

  useEffect(() => { cargar() }, [])

  useEffect(() => {
    if (puedeVerTareas) cargarTareas()
  }, [puedeVerTareas])

  const cargar = async () => {
    setLoading(true)
    try {
      const hoy = new Date()
      const mesActualKey = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
      const last6Keys = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() - (5 - i), 1)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      })

      const [catRes, cobrosRes, recientesRes, ventasRes, gastosRes] = await Promise.all([
        supabase.from('animales')
          .select('cantidad,categorias(nombre,cobrable,especies(nombre))')
          .eq('estado', 'activo'),
        supabase.from('cobros').select('total,estado,periodo,pagos(monto)'),
        supabase.from('cobros')
          .select('id,periodo,estado,total,cliente_id,clientes(nombre_razon_social),pagos(monto),created_at')
          .order('id', { ascending: false })
          .limit(4),
        supabase.from('ventas')
          .select('id,numero,fecha,total,estado,cliente_nombre,venta_items(subtotal,productos(nombre)),venta_cobros(monto,fecha),created_at'),
        supabase.from('gastos').select('fecha,monto'),
      ])

      // ── Actividad reciente: cobros de pastaje + ventas, intercalados por fecha ──
      const cobroBadge = e => e === 'pagado' ? { bg: '#d1fae5', color: '#065f46', label: 'Pagado' }
        : e === 'parcial' ? { bg: '#fef3c7', color: '#92400e', label: 'Parcial' }
        : { bg: '#fee2e2', color: '#991b1b', label: 'Pendiente' }
      const ventaBadge = e => e === 'pagada' ? { bg: '#d1fae5', color: '#065f46', label: 'Pagada' }
        : e === 'anulada' ? { bg: '#f3f4f6', color: '#6b7280', label: 'Anulada' }
        : { bg: '#fed7aa', color: '#9a3412', label: 'Pendiente' }
      const ventasRecientes = [...(ventasRes.data || [])]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 4)
      const actividad = [
        ...(recientesRes.data || []).map(c => {
          const pag = c.pagos?.reduce((s, p) => s + Number(p.monto), 0) || 0
          return {
            id: 'c' + c.id, fecha: c.created_at,
            titulo: c.clientes?.nombre_razon_social || '',
            subtitulo: `Cobro pastaje · ${periodoLabel(c.periodo)}`,
            monto: Number(c.total), pagado: pag,
            badge: cobroBadge(c.estado),
          }
        }),
        ...ventasRecientes.map(v => ({
          id: 'v' + v.id, fecha: v.created_at,
          titulo: v.cliente_nombre || 'Consumidor final',
          subtitulo: `Venta N° ${String(v.numero).padStart(4, '0')}`,
          monto: Number(v.total), pagado: null,
          badge: ventaBadge(v.estado),
        })),
      ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 6)
      setActividadReciente(actividad)

      // ── Pastaje: cobrado del mes, pendiente total, ingresos por mes ──
      // Se agrupa por `periodo` (mes de servicio que factura el cobro), no por la
      // fecha real del pago: es el mismo criterio que usa el resto de la app
      // (Cobros, Actividad reciente) y el que tiene datos históricos consistentes.
      let cobradoMesPastaje = 0
      let pendientePastaje  = 0
      const ingresosPagosPorMes = {}
      cobrosRes.data?.forEach(c => {
        const pag = c.pagos?.reduce((s, p) => s + Number(p.monto), 0) || 0
        pendientePastaje += Math.max(0, Number(c.total) - pag)
        if (!c.periodo) return
        ingresosPagosPorMes[c.periodo] = (ingresosPagosPorMes[c.periodo] || 0) + pag
        if (c.periodo === mesActualKey) cobradoMesPastaje += pag
      })

      // ── Ventas: contado del mes, cobros de fiado, pendiente fiado, por producto ──
      const ventas = ventasRes.data || []
      let ventasContadoMes = 0
      let ventaCobrosMesTotal = 0
      let pendienteFiados = 0
      let ventasCountMes = 0
      const productoTotalesMes = {}
      const ventasIngresosPorMes = {}

      ventas.forEach(v => {
        const vMesKey = v.fecha?.slice(0, 7)
        const cobrosVenta = v.venta_cobros || []
        const cobradoVenta = cobrosVenta.reduce((s, vc) => s + Number(vc.monto), 0)

        if (v.estado === 'pagada') {
          ventasIngresosPorMes[vMesKey] = (ventasIngresosPorMes[vMesKey] || 0) + Number(v.total)
          if (vMesKey === mesActualKey) ventasContadoMes += Number(v.total)
        }
        if (v.estado === 'pendiente') {
          pendienteFiados += Math.max(0, Number(v.total) - cobradoVenta)
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

      // ── Gastos: total del mes, por mes ──
      const gastos = gastosRes.data || []
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

      // ── Por especie ──
      const mapa = {}
      catRes.data?.forEach(a => {
        const espNombre = a.categorias?.especies?.nombre
        if (!espNombre) return
        if (!mapa[espNombre]) mapa[espNombre] = { total: 0, categorias: {} }
        mapa[espNombre].total += Number(a.cantidad)
        const cat = a.categorias?.nombre
        if (cat) mapa[espNombre].categorias[cat] = (mapa[espNombre].categorias[cat] || 0) + Number(a.cantidad)
      })
      const lista = Object.entries(mapa).map(([especie, v]) => ({
        especie, total: v.total,
        categorias: Object.entries(v.categorias).map(([nombre, cant]) => ({ nombre, cant })).sort((a, b) => b.cant - a.cant),
      })).sort((a, b) => b.total - a.total)
      setPorEspecie(lista)
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
  const maxAnimales = Math.max(...porEspecie.map(e => e.total), 1)
  const totalAnimales = porEspecie.reduce((s, e) => s + e.total, 0)

  const resultadoMes = fin.ingresosMes - fin.gastosMes
  const porCobrarTotal = fin.pendientePastaje + fin.pendienteFiados

  const CARDS = [
    { label: 'Ingresos del mes', value: gs(fin.ingresosMes) + ' Gs.', icon: '📈', cls: 'green',
      detalle: `Pastaje ${gs(fin.cobradoMesPastaje)} · Ventas ${gs(fin.ingresosVentasMes)}` },
    { label: 'Gastos del mes', value: gs(fin.gastosMes) + ' Gs.', icon: '📉', cls: 'red',
      detalle: fin.gastosMesCount > 0 ? `${fin.gastosMesCount} comprobante(s)` : 'Sin gastos registrados' },
    { label: 'Resultado del mes', value: (resultadoMes >= 0 ? '+' : '') + gs(resultadoMes) + ' Gs.', icon: '🧮', cls: 'purple',
      detalle: `Ingresos − gastos · ${mesLabelCap}` },
    { label: 'Por cobrar', value: gs(porCobrarTotal) + ' Gs.', icon: '⏳', cls: 'orange',
      detalle: `Fiados ${gs(fin.pendienteFiados)} · Pastaje ${gs(fin.pendientePastaje)}` },
  ]

  if (loading) return <div className="spinner" />

  return (
    <div className="dash-shell">

      {/* ── Bienvenida ── */}
      <div style={{
        background: 'linear-gradient(135deg,#1e3a5f 0%,#2563eb 60%,#3b82f6 100%)',
        borderRadius: 14, padding: '14px 20px', color: '#fff',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 8, flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.3px', marginBottom: 4 }}>
            Bienvenida a Ñongatu, {nombreSaludo}
          </div>
          <div style={{ fontSize: 16, opacity: 0.85, marginBottom: 4 }}>{fechaCap}</div>
          <div style={{ fontSize: 15, opacity: 0.75, fontStyle: 'italic' }}>{frase}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => onNavigate?.('ventas')} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Nueva venta</button>
          <button onClick={() => onNavigate?.('gastos')} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Nuevo gasto</button>
          <button onClick={() => onNavigate?.('cobros')}   style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cobros</button>
        </div>
      </div>

      {/* ── 4 tarjetas de indicadores ── */}
      <div className="metric-cards dash-stats" style={{ marginBottom: 0 }}>
        {CARDS.map(card => (
          <div key={card.label} className={`metric-card ${card.cls}`} style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: 12, top: 10, fontSize: 26, opacity: 0.3 }}>{card.icon}</div>
            <div className="label" style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>{card.label}</div>
            <div className="value" style={{ fontSize: 20 }}>{card.value}</div>
            <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 4 }}>{card.detalle}</div>
          </div>
        ))}
      </div>

      {/* ── Cuerpo: columna principal (2fr) | columna derecha (1fr) ── */}
      <div className="dash-body">

        {/* ── Columna principal ── */}
        <div className="dash-col" style={{ gridTemplateRows: 'auto minmax(0,1fr)' }}>

          {/* Ventas del mes por producto */}
          <div className="dash-card">
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 1 }}>Ventas del mes por producto</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
              {mesLabelCap} · {ventasMesInfo.cantidad} venta{ventasMesInfo.cantidad === 1 ? '' : 's'} · {gs(ventasMesInfo.total)} Gs.
            </div>
            <ProductoBars productos={productosMes} />
          </div>

          <div className="dash-row2">
            {/* Ingresos vs gastos */}
            <div className="dash-card dash-card-flex">
              <div style={{ fontSize: 14, fontWeight: 700, flexShrink: 0 }}>Ingresos vs gastos</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 6, flexShrink: 0 }}>Últimos 6 meses</div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 4, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--text-secondary)' }}>
                  <div style={{ width: 10, height: 3, background: '#10b981', borderRadius: 2 }} /> Ingresos
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--text-secondary)' }}>
                  <div style={{ width: 10, height: 3, background: '#f87171', borderRadius: 2 }} /> Gastos
                </div>
              </div>
              <IngresosGastosChart meses={chartMeses} />
            </div>

            {/* Animales en pastura */}
            <div className="dash-card dash-card-flex">
              <div style={{ fontSize: 14, fontWeight: 700, flexShrink: 0 }}>Animales en pastura</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 6, flexShrink: 0 }}>
                {porEspecie.length === 0 ? 'Por especie y categoría' : `${totalAnimales} cabezas en total`}
              </div>
              {porEspecie.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sin datos. Registrá categorías y animales.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 6, flex: 1, minHeight: 0, paddingBottom: 4, borderBottom: '2px solid var(--border)' }}>
                    {porEspecie.map((esp, i) => (
                      <VBar key={esp.especie} frac={esp.total / maxAnimales} color={ESPECIE_COLORS[i % ESPECIE_COLORS.length]} title={`${esp.especie}: ${esp.total}`}>
                        <span style={{ fontSize: 11 }}>{ESPECIE_ICONS[i % ESPECIE_ICONS.length]}</span>
                      </VBar>
                    ))}
                  </div>
                  <div className="dash-scroll" style={{ flexShrink: 0, maxHeight: '38%', display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: 5, marginTop: 8 }}>
                    {porEspecie.flatMap((esp, i) =>
                      esp.categorias.map(cat => (
                        <span key={esp.especie + cat.nombre} style={{ background: 'var(--main-bg,#f9fafb)', border: `1px solid ${ESPECIE_COLORS[i % ESPECIE_COLORS.length]}55`, borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {cat.nombre} <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{cat.cant}</span>
                        </span>
                      ))
                    )}
                  </div>
                  <button onClick={() => onNavigate?.('animales')} className="btn btn-outline btn-sm" style={{ marginTop: 8, alignSelf: 'flex-start', flexShrink: 0, minHeight: 30, padding: '4px 12px' }}>Ver módulo</button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Columna derecha ── */}
        <div className="dash-col" style={{ gridTemplateRows: 'minmax(0,1fr) auto' }}>

          {/* Tareas pendientes */}
          {puedeVerTareas && (
            <div className="dash-card dash-card-flex">
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, flexShrink: 0 }}>Tareas pendientes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8, flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  <input
                    value={nuevoItem}
                    onChange={e => setNuevoItem(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && agregarItem()}
                    placeholder="Agregar tarea..."
                    style={{ flex: 1, fontSize: 12, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--main-bg,#f9fafb)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                  <button onClick={agregarItem} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 16, flexShrink: 0, lineHeight: 1 }}>+</button>
                </div>
                {user?.rol === 'Administrador' && (
                  <select
                    value={nuevaVis}
                    onChange={e => setNuevaVis(e.target.value)}
                    style={{ fontSize: 11, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--main-bg,#f9fafb)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    <option value="admin">Solo administradores</option>
                    <option value="todos">Todos (usuarios con permiso)</option>
                  </select>
                )}
              </div>
              <div className="dash-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {checklist.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: '16px 0', lineHeight: 1.7 }}>
                    Sin tareas aún.<br />Agregá lo que tenés<br />pendiente hoy.
                  </div>
                ) : checklist.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', background: 'var(--main-bg,#f9fafb)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div
                      onClick={() => toggleItem(item.id, item.hecha)}
                      className={`check-circle ${item.hecha ? 'checked' : ''}`}
                    />
                    <span style={{ flex: 1, fontSize: 12, textDecoration: item.hecha ? 'line-through' : 'none', color: item.hecha ? 'var(--text-secondary)' : 'var(--text-primary)', wordBreak: 'break-word', lineHeight: 1.4 }}>
                      {item.texto}
                      {user?.rol === 'Administrador' && item.visibilidad === 'todos' && (
                        <span style={{ marginLeft: 5, fontSize: 9, background: '#e0f2fe', color: '#0369a1', borderRadius: 4, padding: '1px 4px', fontWeight: 600 }}>Todos</span>
                      )}
                    </span>
                    <button onClick={() => eliminarItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0, padding: '1px 3px', lineHeight: 1 }} title="Eliminar">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actividad reciente */}
          <div className="dash-card" style={{ maxHeight: 300, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 1, flexShrink: 0 }}>Actividad reciente</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, flexShrink: 0 }}>Cobros y ventas</div>
            {actividadReciente.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sin actividad registrada.</p>
            ) : (
              <div className="dash-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {actividadReciente.map(a => (
                  <div key={a.id} style={{ background: 'var(--main-bg,#f9fafb)', borderRadius: 9, padding: '9px 11px', border: '1px solid var(--border)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '58%' }}>{a.titulo}</div>
                      <span style={{ background: a.badge.bg, color: a.badge.color, borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{a.badge.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>{a.subtitulo}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{gs(a.monto)} Gs.</div>
                    {a.pagado > 0 && <div style={{ fontSize: 11, color: '#10b981' }}>Pagado: {gs(a.pagado)} Gs.</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
