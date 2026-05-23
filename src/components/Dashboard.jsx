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

const PROXIMAS = [
  { icon: '📊', titulo: 'Reportes avanzados', desc: 'Gráficos históricos por período y cliente' },
  { icon: '📱', titulo: 'Notificaciones', desc: 'Alertas de vencimientos y cobros pendientes' },
  { icon: '📤', titulo: 'Exportación masiva', desc: 'Exportar todo a Excel con un solo click' },
  { icon: '🔄', titulo: 'Historial de cambios', desc: 'Trazabilidad completa de movimientos' },
  { icon: '🧾', titulo: 'Facturación electrónica', desc: 'Integración con SIFEN Paraguay' },
]

export default function Dashboard({ user, onNavigate }) {
  const [stats, setStats]           = useState({ animales:0, clientes:0, cobrado:0, pendiente:0 })
  const [porEspecie, setPorEspecie]  = useState([])
  const [recientes, setRecientes]   = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    try {
      const [animalesRes, { count: clientes }, cobrosRes, catRes, recientesRes] = await Promise.all([
        supabase.from('animales').select('cantidad').eq('estado','activo'),
        supabase.from('clientes').select('*',{count:'exact',head:true}),
        supabase.from('cobros').select('total,estado,periodo,pagos(monto)'),
        supabase.from('animales')
          .select('cantidad,categorias(nombre,cobrable,especies(nombre))')
          .eq('estado','activo'),
        supabase.from('cobros')
          .select('id,periodo,estado,total,cliente_id,clientes(nombre_razon_social),pagos(monto)')
          .order('id',{ascending:false})
          .limit(5),
      ])

      const animales  = animalesRes.data?.reduce((s,a)=>s+Number(a.cantidad),0)||0
      const cobrado   = cobrosRes.data?.reduce((s,c)=>{
        const pag = c.pagos?.reduce((ps,p)=>ps+Number(p.monto),0)||0
        return s + pag
      },0)||0
      const pendiente = cobrosRes.data?.reduce((s,c)=>{
        const pag = c.pagos?.reduce((ps,p)=>ps+Number(p.monto),0)||0
        return s+Math.max(0,Number(c.total)-pag)
      },0)||0

      setStats({ animales, clientes:clientes||0, cobrado, pendiente })
      setRecientes(recientesRes.data||[])

      const mapa = {}
      catRes.data?.forEach(a => {
        const espNombre = a.categorias?.especies?.nombre
        if (!espNombre) return
        if (!mapa[espNombre]) mapa[espNombre] = { total:0, categorias:{} }
        mapa[espNombre].total += Number(a.cantidad)
        const cat = a.categorias?.nombre
        if (cat) mapa[espNombre].categorias[cat] = (mapa[espNombre].categorias[cat]||0)+Number(a.cantidad)
      })
      const lista = Object.entries(mapa).map(([especie,v])=>({
        especie, total:v.total,
        categorias: Object.entries(v.categorias).map(([nombre,cant])=>({nombre,cant})).sort((a,b)=>b.cant-a.cant)
      })).sort((a,b)=>b.total-a.total)
      setPorEspecie(lista)
    } catch(e){ console.error(e) }
    setLoading(false)
  }

  const hoy    = new Date()
  const frase  = getFraseHoy() ?? FRASES_DEFAULT[hoy.getDate() % FRASES_DEFAULT.length]

  // Nombre de saludo: apodo → primer nombre → usuario
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
  const fechaStr = hoy.toLocaleDateString('es-PY',{weekday:'long',year:'numeric',month:'long',day:'numeric'})
  // Capitalize first letter
  const fechaCap = fechaStr.charAt(0).toUpperCase() + fechaStr.slice(1)

  const maxAnimales = Math.max(...porEspecie.map(e=>e.total), 1)

  const estadoBadge = e => {
    if (e==='pagado')  return {bg:'#d1fae5',color:'#065f46',label:'Pagado'}
    if (e==='parcial') return {bg:'#fef3c7',color:'#92400e',label:'Parcial'}
    return {bg:'#fee2e2',color:'#991b1b',label:'Pendiente'}
  }

  const CARDS = [
    { label:'Animales activos', value: stats.animales.toLocaleString('es-PY'),    icon:'🐄', bg:'linear-gradient(135deg,#10b981,#059669)', sub:'cabezas en pastura' },
    { label:'Clientes',         value: stats.clientes.toLocaleString('es-PY'),    icon:'👤', bg:'linear-gradient(135deg,#3b82f6,#2563eb)', sub:'contratos activos' },
    { label:'Total cobrado',    value: gs(stats.cobrado)+' Gs.',                  icon:'✅', bg:'linear-gradient(135deg,#8b5cf6,#7c3aed)', sub:'pagos recibidos' },
    { label:'Total pendiente',  value: gs(stats.pendiente)+' Gs.',                icon:'⏳', bg:'linear-gradient(135deg,#f59e0b,#d97706)', sub:'por cobrar' },
  ]

  if (loading) return <div className="spinner"/>

  return (
    <div style={{
      display:'flex', flexDirection:'column',
      height:'calc(100vh - 92px)',
      gap:10, overflow:'hidden'
    }}>

      {/* ── Bienvenida ── */}
      <div style={{
        background:'linear-gradient(135deg,#1e3a5f 0%,#2563eb 60%,#3b82f6 100%)',
        borderRadius:14, padding:'14px 20px', color:'#fff',
        display:'flex', justifyContent:'space-between', alignItems:'center',
        flexWrap:'wrap', gap:8, flexShrink:0
      }}>
        <div>
          <div style={{fontSize:22,fontWeight:800,letterSpacing:'-0.3px',marginBottom:4}}>
            Bienvenida a Ñongatu, {nombreSaludo}
          </div>
          <div style={{fontSize:16,opacity:0.85,marginBottom:4}}>{fechaCap}</div>
          <div style={{fontSize:15,opacity:0.75,fontStyle:'italic'}}>{frase}</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>onNavigate?.('animales')} style={{
            background:'rgba(255,255,255,0.15)', color:'#fff',
            border:'1px solid rgba(255,255,255,0.3)', borderRadius:8,
            padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer'
          }}>🐄 Animales</button>
          <button onClick={()=>onNavigate?.('cobros')} style={{
            background:'rgba(255,255,255,0.15)', color:'#fff',
            border:'1px solid rgba(255,255,255,0.3)', borderRadius:8,
            padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer'
          }}>💰 Cobros</button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, flexShrink:0
      }}>
        {CARDS.map(card=>(
          <div key={card.label} style={{
            background:card.bg, borderRadius:12, padding:'14px 16px', color:'#fff',
            boxShadow:'0 4px 12px rgba(0,0,0,0.12)', position:'relative', overflow:'hidden'
          }}>
            <div style={{position:'absolute',right:12,top:10,fontSize:28,opacity:0.22}}>{card.icon}</div>
            <div style={{fontSize:12,fontWeight:600,opacity:0.85,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>{card.label}</div>
            <div style={{fontSize:22,fontWeight:800,lineHeight:1.2,marginBottom:4,wordBreak:'break-word'}}>{card.value}</div>
            <div style={{fontSize:12,opacity:0.7}}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Cuerpo: panel izquierdo + actividad reciente ── */}
      <div style={{
        display:'grid', gridTemplateColumns:'1fr 290px', gap:10,
        flex:1, minHeight:0, overflow:'hidden'
      }}>

        {/* Panel izquierdo: gráfico + categorías + próximamente */}
        <div style={{
          background:'var(--card-bg,#fff)', border:'1px solid var(--border)',
          borderRadius:14, padding:'14px 18px',
          display:'flex', flexDirection:'column', overflow:'hidden'
        }}>
          <div style={{fontSize:16,fontWeight:700,marginBottom:2,flexShrink:0}}>Animales en pastura</div>
          <div style={{fontSize:13,color:'var(--text-secondary)',marginBottom:10,flexShrink:0}}>Por especie y categoría</div>

          {porEspecie.length === 0 ? (
            <p style={{color:'var(--text-secondary)',fontSize:13,paddingTop:8}}>
              Sin datos. Registrá categorías y animales.
            </p>
          ) : (
            <div style={{flex:1,minHeight:0,display:'flex',flexDirection:'column',gap:10,overflow:'hidden'}}>
              {/* Barras */}
              <div style={{
                display:'flex', alignItems:'flex-end', gap:14,
                height:140, flexShrink:0,
                paddingBottom:4, borderBottom:'2px solid var(--border)'
              }}>
                {porEspecie.map((esp,i)=>(
                  <div key={esp.especie} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,flex:1,minWidth:52}}>
                    <div style={{fontSize:13,fontWeight:700,color:ESPECIE_COLORS[i%ESPECIE_COLORS.length]}}>{esp.total}</div>
                    <div style={{
                      width:'100%', maxWidth:54,
                      height:`${Math.round((esp.total/maxAnimales)*100)+12}px`,
                      background:ESPECIE_COLORS[i%ESPECIE_COLORS.length],
                      borderRadius:'6px 6px 0 0', opacity:0.9,
                      display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:4
                    }}>
                      <span style={{fontSize:16}}>{ESPECIE_ICONS[i%ESPECIE_ICONS.length]}</span>
                    </div>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',textAlign:'center',wordBreak:'break-word'}}>{esp.especie}</div>
                  </div>
                ))}
              </div>

              {/* Desglose categorías */}
              <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:6}}>
                {porEspecie.map((esp,i)=>(
                  <div key={esp.especie}>
                    <div style={{fontSize:13,fontWeight:700,color:ESPECIE_COLORS[i%ESPECIE_COLORS.length],marginBottom:4}}>
                      {esp.especie} — {esp.total} cabezas
                    </div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                      {esp.categorias.map(cat=>(
                        <div key={cat.nombre} style={{
                          background:'var(--main-bg,#f9fafb)',border:'1px solid var(--border)',
                          borderRadius:6, padding:'3px 10px', fontSize:13
                        }}>
                          <span style={{fontWeight:600}}>{cat.nombre}</span>
                          <span style={{marginLeft:5,color:'var(--text-secondary)'}}>{cat.cant}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Próximamente */}
          <div style={{flexShrink:0,borderTop:'1px solid var(--border)',marginTop:10,paddingTop:10}}>
            <div style={{fontSize:11,fontWeight:700,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:7}}>
              Próximamente en Ñongatu
            </div>
            <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
              {PROXIMAS.map(f=>(
                <div key={f.titulo} style={{
                  display:'flex',alignItems:'center',gap:6,
                  background:'var(--main-bg,#f9fafb)',border:'1px solid var(--border)',
                  borderRadius:8,padding:'5px 10px',flex:'1 1 160px',minWidth:0
                }}>
                  <span style={{fontSize:15,flexShrink:0}}>{f.icon}</span>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:11,fontWeight:700,color:'var(--text-primary)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{f.titulo}</div>
                    <div style={{fontSize:10,color:'var(--text-secondary)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actividad reciente */}
        <div style={{
          background:'var(--card-bg,#fff)', border:'1px solid var(--border)',
          borderRadius:14, padding:'14px 16px',
          display:'flex', flexDirection:'column', overflow:'hidden'
        }}>
          <div style={{fontSize:16,fontWeight:700,marginBottom:10,flexShrink:0}}>Actividad reciente</div>
          {recientes.length===0 ? (
            <p style={{color:'var(--text-secondary)',fontSize:13}}>Sin cobros registrados.</p>
          ) : (
            <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:8}}>
              {recientes.map(c=>{
                const pag = c.pagos?.reduce((s,p)=>s+Number(p.monto),0)||0
                const badge = estadoBadge(c.estado)
                return (
                  <div key={c.id} style={{
                    background:'var(--main-bg,#f9fafb)',borderRadius:9,
                    padding:'9px 11px',border:'1px solid var(--border)',flexShrink:0
                  }}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                      <div style={{fontSize:13,fontWeight:700,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'60%'}}>{c.clientes?.nombre_razon_social}</div>
                      <span style={{background:badge.bg,color:badge.color,borderRadius:10,padding:'2px 9px',fontSize:12,fontWeight:700,flexShrink:0}}>{badge.label}</span>
                    </div>
                    <div style={{fontSize:12,color:'var(--text-secondary)',marginBottom:2}}>{periodoLabel(c.periodo)}</div>
                    <div style={{fontSize:14,fontWeight:600}}>{gs(Number(c.total))} Gs.</div>
                    {pag > 0 && <div style={{fontSize:12,color:'#10b981'}}>Pagado: {gs(pag)} Gs.</div>}
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
