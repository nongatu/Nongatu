import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { gs, periodoLabel } from '../utils/helpers'
import { getFraseHoy } from './Configuracion'

const ESPECIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316']
const ESPECIE_ICONS  = ['🐄','🐎','🐑','🐐','🐖','🐓','🐾']

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

// ── Gráfico de línea SVG (ingresos por mes) ───────────────────────────────────
function LineChart({ data }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
        {data?.length === 1 ? 'Solo un período con datos' : 'Sin datos suficientes aún'}
      </div>
    )
  }
  const W = 300, H = 72
  const maxVal = Math.max(...data.map(d => d.monto), 1)
  const pts = data.map((d, i) => ({
    x: 10 + (i / (data.length - 1)) * (W - 20),
    y: 8 + (1 - d.monto / maxVal) * (H - 18),
    ...d,
  }))
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', flex: 1, display: 'block' }}>
        <defs>
          <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#incGrad)" />
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#3b82f6" stroke="#fff" strokeWidth="1.5" />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 8px 0' }}>
        {data.map(d => (
          <div key={d.periodo} style={{ fontSize: 9, color: 'var(--text-secondary)', textAlign: 'center' }}>
            {new Date(d.periodo + '-15').toLocaleDateString('es-PY', { month: 'short' })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Gráfico de barras placeholder (cosecha pepinos) ───────────────────────────
function CosechaChart() {
  const BARS = [
    { label: 'Oct', val: 55 }, { label: 'Nov', val: 70 }, { label: 'Dic', val: 45 },
    { label: 'Ene', val: 80 }, { label: 'Feb', val: 95 }, { label: 'Mar', val: 60 },
    { label: 'Abr', val: 75 }, { label: 'May', val: 50 },
  ]
  const maxVal = Math.max(...BARS.map(b => b.val))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 68, padding: '0 2px' }}>
      {BARS.map((b, i) => (
        <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{
            width: '100%',
            height: `${Math.round((b.val / maxVal) * 54)}px`,
            background: i === 4 ? '#10b981' : '#cbd5e1',
            borderRadius: '3px 3px 0 0',
          }} />
          <div style={{ fontSize: 8, color: 'var(--text-secondary)' }}>{b.label}</div>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard({ user, onNavigate }) {
  const [stats, setStats]          = useState({ animales: 0, clientes: 0, cobrado: 0, pendiente: 0 })
  const [porEspecie, setPorEspecie] = useState([])
  const [recientes, setRecientes]  = useState([])
  const [mesesChart, setMesesChart] = useState([])
  const [ventasMes, setVentasMes]  = useState(0)
  const [loading, setLoading]      = useState(true)

  // Checklist local
  const [checklist, setChecklist] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nongatu_checklist') || '[]') } catch { return [] }
  })
  const [nuevoItem, setNuevoItem] = useState('')

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    try {
      const [animalesRes, { count: clientes }, cobrosRes, catRes, recientesRes] = await Promise.all([
        supabase.from('animales').select('cantidad').eq('estado', 'activo'),
        supabase.from('clientes').select('*', { count: 'exact', head: true }),
        supabase.from('cobros').select('total,estado,periodo,pagos(monto)'),
        supabase.from('animales')
          .select('cantidad,categorias(nombre,cobrable,especies(nombre))')
          .eq('estado', 'activo'),
        supabase.from('cobros')
          .select('id,periodo,estado,total,cliente_id,clientes(nombre_razon_social),pagos(monto)')
          .order('id', { ascending: false })
          .limit(5),
      ])

      const animales  = animalesRes.data?.reduce((s, a) => s + Number(a.cantidad), 0) || 0
      const cobrado   = cobrosRes.data?.reduce((s, c) => {
        const pag = c.pagos?.reduce((ps, p) => ps + Number(p.monto), 0) || 0
        return s + pag
      }, 0) || 0
      const pendiente = cobrosRes.data?.reduce((s, c) => {
        const pag = c.pagos?.reduce((ps, p) => ps + Number(p.monto), 0) || 0
        return s + Math.max(0, Number(c.total) - pag)
      }, 0) || 0

      setStats({ animales, clientes: clientes || 0, cobrado, pendiente })
      setRecientes(recientesRes.data || [])

      // Chart mensual
      const hoy = new Date()
      const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
      const mesMap = {}
      cobrosRes.data?.forEach(c => {
        if (!c.periodo) return
        const pag = c.pagos?.reduce((s, p) => s + Number(p.monto), 0) || 0
        mesMap[c.periodo] = (mesMap[c.periodo] || 0) + pag
      })
      const meses = Object.entries(mesMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-7)
        .map(([periodo, monto]) => ({ periodo, monto }))
      setMesesChart(meses)
      setVentasMes(mesMap[mesActual] || 0)

      // Por especie
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

  // Checklist helpers
  const agregarItem = () => {
    if (!nuevoItem.trim()) return
    const newList = [...checklist, { id: Date.now(), texto: nuevoItem.trim(), hecho: false }]
    setChecklist(newList)
    localStorage.setItem('nongatu_checklist', JSON.stringify(newList))
    setNuevoItem('')
  }
  const toggleItem = (id) => {
    const newList = checklist.map(i => i.id === id ? { ...i, hecho: !i.hecho } : i)
    setChecklist(newList)
    localStorage.setItem('nongatu_checklist', JSON.stringify(newList))
  }
  const eliminarItem = (id) => {
    const newList = checklist.filter(i => i.id !== id)
    setChecklist(newList)
    localStorage.setItem('nongatu_checklist', JSON.stringify(newList))
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
  const maxAnimales = Math.max(...porEspecie.map(e => e.total), 1)

  const estadoBadge = e => {
    if (e === 'pagado')  return { bg: '#d1fae5', color: '#065f46', label: 'Pagado' }
    if (e === 'parcial') return { bg: '#fef3c7', color: '#92400e', label: 'Parcial' }
    return { bg: '#fee2e2', color: '#991b1b', label: 'Pendiente' }
  }

  const CARDS = [
    { label: 'Animales activos', value: stats.animales.toLocaleString('es-PY'),  icon: '🐄', bg: 'linear-gradient(135deg,#10b981,#059669)', sub: 'cabezas en pastura' },
    { label: 'Clientes',         value: stats.clientes.toLocaleString('es-PY'),  icon: '👤', bg: 'linear-gradient(135deg,#3b82f6,#2563eb)', sub: 'contratos activos' },
    { label: 'Total cobrado',    value: gs(stats.cobrado) + ' Gs.',              icon: '✅', bg: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', sub: 'pagos recibidos' },
    { label: 'Total pendiente',  value: gs(stats.pendiente) + ' Gs.',            icon: '⏳', bg: 'linear-gradient(135deg,#f59e0b,#d97706)', sub: 'por cobrar' },
  ]

  if (loading) return <div className="spinner" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)', gap: 10, overflow: 'hidden' }}>

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
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onNavigate?.('animales')} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>🐄 Animales</button>
          <button onClick={() => onNavigate?.('cobros')}   style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>💰 Cobros</button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, flexShrink: 0 }}>
        {CARDS.map(card => (
          <div key={card.label} style={{ background: card.bg, borderRadius: 12, padding: '14px 16px', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: 12, top: 10, fontSize: 28, opacity: 0.22 }}>{card.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2, marginBottom: 4, wordBreak: 'break-word' }}>{card.value}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Cuerpo: 3 columnas ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 210px 290px', gap: 10, flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* ── COL IZQUIERDA: Animales en pastura + Resumen de producción ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflow: 'hidden' }}>

          {/* Animales en pastura */}
          <div style={{ background: 'var(--card-bg,#fff)', border: '1px solid var(--border)', borderRadius: 14, padding: '13px 16px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 1, flexShrink: 0 }}>Animales en pastura</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, flexShrink: 0 }}>Por especie y categoría</div>

            {porEspecie.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sin datos. Registrá categorías y animales.</p>
            ) : (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
                {/* Barras */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 110, flexShrink: 0, paddingBottom: 4, borderBottom: '2px solid var(--border)' }}>
                  {porEspecie.map((esp, i) => (
                    <div key={esp.especie} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1, minWidth: 40 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: ESPECIE_COLORS[i % ESPECIE_COLORS.length] }}>{esp.total}</div>
                      <div style={{ width: '100%', maxWidth: 46, height: `${Math.round((esp.total / maxAnimales) * 78) + 12}px`, background: ESPECIE_COLORS[i % ESPECIE_COLORS.length], borderRadius: '5px 5px 0 0', opacity: 0.9, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 3 }}>
                        <span style={{ fontSize: 14 }}>{ESPECIE_ICONS[i % ESPECIE_ICONS.length]}</span>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center', wordBreak: 'break-word' }}>{esp.especie}</div>
                    </div>
                  ))}
                </div>
                {/* Breakdown por categoría */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {porEspecie.map((esp, i) => (
                    <div key={esp.especie}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: ESPECIE_COLORS[i % ESPECIE_COLORS.length], marginBottom: 3 }}>{esp.especie} — {esp.total} cabezas</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {esp.categorias.map(cat => (
                          <div key={cat.nombre} style={{ background: 'var(--main-bg,#f9fafb)', border: '1px solid var(--border)', borderRadius: 5, padding: '2px 8px', fontSize: 12 }}>
                            <span style={{ fontWeight: 600 }}>{cat.nombre}</span>
                            <span style={{ marginLeft: 4, color: 'var(--text-secondary)' }}>{cat.cant}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Resumen de producción */}
          <div style={{ background: 'var(--card-bg,#fff)', border: '1px solid var(--border)', borderRadius: 14, padding: '13px 16px', display: 'flex', flexDirection: 'column', minHeight: 170, flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Resumen de producción</div>
              <span style={{ fontSize: 10, fontWeight: 700, background: '#f59e0b', color: '#fff', borderRadius: 10, padding: '2px 8px' }}>Próximamente</span>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 6, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)' }}>
                <div style={{ width: 12, height: 3, background: '#3b82f6', borderRadius: 2 }} /> Ingresos
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)', opacity: 0.4 }}>
                <div style={{ width: 12, height: 3, background: '#f59e0b', borderRadius: 2 }} /> Gastos
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <LineChart data={mesesChart} />
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Ventas del mes</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#2563eb' }}>{gs(ventasMes)} Gs.</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Gastos del mes</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', opacity: 0.55 }}>Próximamente</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── COL CENTRAL: Checklist Próximamente + Cosecha pepinos ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflow: 'hidden' }}>

          {/* Próximamente + checklist */}
          <div style={{ background: 'var(--card-bg,#fff)', border: '1px solid var(--border)', borderRadius: 14, padding: '13px 14px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, flexShrink: 0 }}>Próximamente</div>
            {/* Input nueva tarea */}
            <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexShrink: 0 }}>
              <input
                value={nuevoItem}
                onChange={e => setNuevoItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && agregarItem()}
                placeholder="Agregar ítem..."
                style={{ flex: 1, fontSize: 12, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--main-bg,#f9fafb)', color: 'var(--text-primary)', outline: 'none' }}
              />
              <button onClick={agregarItem} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 16, flexShrink: 0, lineHeight: 1 }}>+</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {checklist.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: '18px 0', lineHeight: 1.6 }}>
                  Sin ítems aún.<br />Agregá funciones que<br />vendrán pronto.
                </div>
              ) : checklist.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', background: 'var(--main-bg,#f9fafb)', borderRadius: 7, border: '1px solid var(--border)' }}>
                  <input
                    type="checkbox"
                    checked={item.hecho}
                    onChange={() => toggleItem(item.id)}
                    style={{ flexShrink: 0, cursor: 'pointer', accentColor: '#2563eb', width: 14, height: 14 }}
                  />
                  <span style={{ flex: 1, fontSize: 12, textDecoration: item.hecho ? 'line-through' : 'none', color: item.hecho ? 'var(--text-secondary)' : 'var(--text-primary)', wordBreak: 'break-word' }}>
                    {item.texto}
                  </span>
                  <button onClick={() => eliminarItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0, padding: '1px 3px', lineHeight: 1 }} title="Eliminar">✕</button>
                </div>
              ))}
            </div>
          </div>

          {/* Cosecha pepinos */}
          <div style={{ background: 'var(--card-bg,#fff)', border: '1px solid var(--border)', borderRadius: 14, padding: '13px 14px', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Cosecha de pepinos</div>
              <span style={{ fontSize: 10, fontWeight: 700, background: '#059669', color: '#fff', borderRadius: 10, padding: '2px 7px' }}>Próximamente</span>
            </div>
            <CosechaChart />
          </div>
        </div>

        {/* ── COL DERECHA: Actividad reciente ── */}
        <div style={{ background: 'var(--card-bg,#fff)', border: '1px solid var(--border)', borderRadius: 14, padding: '13px 14px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, flexShrink: 0 }}>Actividad reciente</div>

          {/* Placeholders próximamente */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10, flexShrink: 0 }}>
            <div style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', borderRadius: 10, padding: '10px 12px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>🥒 Venta de pepinillos</div>
                <div style={{ fontSize: 10, opacity: 0.75 }}>Módulo próximamente</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '2px 8px' }}>—</span>
            </div>
            <div style={{ background: 'linear-gradient(135deg,#10b981,#059669)', borderRadius: 10, padding: '10px 12px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>💸 Pago a proveedor</div>
                <div style={{ fontSize: 10, opacity: 0.75 }}>Módulo próximamente</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '2px 8px' }}>—</span>
            </div>
          </div>

          {/* Separador */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, flexShrink: 0 }}>Cobros recientes</div>

          {/* Cobros recientes */}
          {recientes.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sin cobros registrados.</p>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {recientes.map(c => {
                const pag   = c.pagos?.reduce((s, p) => s + Number(p.monto), 0) || 0
                const badge = estadoBadge(c.estado)
                return (
                  <div key={c.id} style={{ background: 'var(--main-bg,#f9fafb)', borderRadius: 9, padding: '9px 11px', border: '1px solid var(--border)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{c.clientes?.nombre_razon_social}</div>
                      <span style={{ background: badge.bg, color: badge.color, borderRadius: 10, padding: '2px 9px', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{badge.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>{periodoLabel(c.periodo)}</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{gs(Number(c.total))} Gs.</div>
                    {pag > 0 && <div style={{ fontSize: 12, color: '#10b981' }}>Pagado: {gs(pag)} Gs.</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
