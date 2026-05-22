import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { gs, periodoLabel } from '../utils/helpers'

// Colores por especie
const ESPECIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316']

export default function Dashboard({ user }) {
  const [stats, setStats]         = useState({ animales:0, clientes:0, cobrado:0, pendiente:0 })
  const [porEspecie, setPorEspecie] = useState([])   // [{especie, total, categorias:[{nombre,cant}]}]
  const [recientes, setRecientes]  = useState([])    // últimos cobros
  const [loading, setLoading]      = useState(true)

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    try {
      const [animalesRes, { count: clientes }, cobrosRes, catRes, recientesRes] = await Promise.all([
        supabase.from('animales').select('cantidad').eq('estado','activo'),
        supabase.from('clientes').select('*',{count:'exact',head:true}),
        supabase.from('cobros').select('total,estado,periodo,pagos(monto),clientes(nombre_razon_social)'),
        supabase.from('animales')
          .select('cantidad,categorias(nombre,cobrable,especies(nombre))')
          .eq('estado','activo'),
        supabase.from('cobros')
          .select('id,periodo,estado,total,cliente_id,clientes(nombre_razon_social),pagos(monto)')
          .order('id',{ascending:false})
          .limit(5),
      ])

      const animales  = animalesRes.data?.reduce((s,a)=>s+Number(a.cantidad),0)||0
      const cobrado   = cobrosRes.data?.filter(c=>c.estado==='pagado').reduce((s,c)=>s+Number(c.total),0)||0
      const pendiente = cobrosRes.data?.reduce((s,c)=>{
        const pag = c.pagos?.reduce((ps,p)=>ps+Number(p.monto),0)||0
        return s+Math.max(0,Number(c.total)-pag)
      },0)||0

      setStats({ animales, clientes:clientes||0, cobrado, pendiente })
      setRecientes(recientesRes.data||[])

      // Agrupar por especie → categoría
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

  const hoy = new Date()
  const fechaStr = hoy.toLocaleDateString('es-PY',{weekday:'long',year:'numeric',month:'long',day:'numeric'})
  const maxAnimales = Math.max(...porEspecie.map(e=>e.total), 1)

  const estadoBadge = e => {
    if (e==='pagado')  return {bg:'#d1fae5',color:'#065f46',label:'Pagado'}
    if (e==='parcial') return {bg:'#fef3c7',color:'#92400e',label:'Parcial'}
    return {bg:'#fee2e2',color:'#991b1b',label:'Pendiente'}
  }

  if (loading) return <div className="spinner"/>

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>

      {/* ── Header bienvenida ── */}
      <div style={{
        background:'linear-gradient(135deg,#1e3a5f 0%,#2563eb 60%,#3b82f6 100%)',
        borderRadius:16,padding:'24px 28px',color:'#fff',
        display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12
      }}>
        <div>
          <div style={{fontSize:22,fontWeight:800,letterSpacing:'-0.5px',marginBottom:4}}>
            Bienvenido a Ñongatu{user?.nombre_usuario ? `, ${user.nombre_usuario}` : ''}
          </div>
          <div style={{fontSize:13,opacity:0.8,textTransform:'capitalize'}}>{fechaStr}</div>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <a href="#/animales" style={{background:'rgba(255,255,255,0.15)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,textDecoration:'none',backdropFilter:'blur(4px)'}}>
            🐄 Animales
          </a>
          <a href="#/cobros" style={{background:'rgba(255,255,255,0.15)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,textDecoration:'none',backdropFilter:'blur(4px)'}}>
            💰 Cobros
          </a>
        </div>
      </div>

      {/* ── Cards de estadísticas ── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:14}}>
        {[
          { label:'Animales activos', value:stats.animales, icon:'🐄', bg:'linear-gradient(135deg,#10b981,#059669)', sub:'cabezas en pastura' },
          { label:'Clientes',         value:stats.clientes,  icon:'👤', bg:'linear-gradient(135deg,#3b82f6,#2563eb)', sub:'contratos activos' },
          { label:'Total cobrado',    value:gs(stats.cobrado)+' Gs.',  icon:'✅', bg:'linear-gradient(135deg,#8b5cf6,#7c3aed)', sub:'cobros saldados' },
          { label:'Total pendiente',  value:gs(stats.pendiente)+' Gs.', icon:'⏳', bg:'linear-gradient(135deg,#f59e0b,#d97706)', sub:'por cobrar' },
        ].map(card=>(
          <div key={card.label} style={{
            background:card.bg,borderRadius:14,padding:'20px 20px 16px',color:'#fff',
            boxShadow:'0 4px 15px rgba(0,0,0,0.12)',position:'relative',overflow:'hidden'
          }}>
            <div style={{position:'absolute',right:14,top:14,fontSize:28,opacity:0.3}}>{card.icon}</div>
            <div style={{fontSize:12,fontWeight:600,opacity:0.85,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>{card.label}</div>
            <div style={{fontSize:typeof card.value==='number'?34:20,fontWeight:800,lineHeight:1.1,marginBottom:4}}>{card.value}</div>
            <div style={{fontSize:11,opacity:0.75}}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Cuerpo: gráfico + actividad reciente ── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:16,alignItems:'start'}}>

        {/* ── Gráfico por especie ── */}
        <div style={{background:'var(--card-bg,#fff)',border:'1px solid var(--border)',borderRadius:14,padding:'20px 24px'}}>
          <h3 style={{fontSize:15,fontWeight:700,marginBottom:4}}>Animales en pastura</h3>
          <p style={{fontSize:12,color:'var(--text-secondary)',marginBottom:20}}>Agrupados por especie</p>

          {porEspecie.length === 0 ? (
            <p style={{color:'var(--text-secondary)',fontSize:13,padding:'20px 0'}}>
              Sin datos. Cargá especies en Categorías y registrá animales.
            </p>
          ) : (
            <>
              {/* Barras */}
              <div style={{display:'flex',alignItems:'flex-end',gap:20,height:160,marginBottom:12,paddingBottom:4,borderBottom:'2px solid var(--border)'}}>
                {porEspecie.map((esp,i)=>(
                  <div key={esp.especie} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,flex:1,minWidth:60}}>
                    <div style={{fontSize:11,fontWeight:700,color:ESPECIE_COLORS[i%ESPECIE_COLORS.length]}}>{esp.total}</div>
                    <div style={{
                      width:'100%',maxWidth:60,
                      height:`${Math.round((esp.total/maxAnimales)*130)+10}px`,
                      background:ESPECIE_COLORS[i%ESPECIE_COLORS.length],
                      borderRadius:'6px 6px 0 0',
                      opacity:0.9,
                      transition:'height 0.3s ease',
                      position:'relative',
                    }}>
                      <div style={{position:'absolute',top:6,left:'50%',transform:'translateX(-50%)',fontSize:18}}>
                        {i===0?'🐄':i===1?'🐎':i===2?'🐑':i===3?'🐐':'🐾'}
                      </div>
                    </div>
                    <div style={{fontSize:11,fontWeight:600,color:'var(--text-secondary)',textAlign:'center',wordBreak:'break-word'}}>{esp.especie}</div>
                  </div>
                ))}
              </div>

              {/* Desglose por categoría */}
              <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:16}}>
                {porEspecie.map((esp,i)=>(
                  <div key={esp.especie}>
                    <div style={{fontSize:12,fontWeight:700,color:ESPECIE_COLORS[i%ESPECIE_COLORS.length],marginBottom:6}}>
                      {esp.especie} — {esp.total} cabezas
                    </div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                      {esp.categorias.map(cat=>(
                        <div key={cat.nombre} style={{
                          background:'var(--main-bg,#f9fafb)',border:'1px solid var(--border)',
                          borderRadius:8,padding:'4px 10px',fontSize:11
                        }}>
                          <span style={{fontWeight:600}}>{cat.nombre}</span>
                          <span style={{marginLeft:6,color:'var(--text-secondary)'}}>{cat.cant}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Actividad reciente ── */}
        <div style={{background:'var(--card-bg,#fff)',border:'1px solid var(--border)',borderRadius:14,padding:'20px 20px'}}>
          <h3 style={{fontSize:15,fontWeight:700,marginBottom:16}}>Actividad reciente</h3>
          {recientes.length===0 ? (
            <p style={{color:'var(--text-secondary)',fontSize:13}}>Sin cobros registrados.</p>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {recientes.map(c=>{
                const pag = c.pagos?.reduce((s,p)=>s+Number(p.monto),0)||0
                const badge = estadoBadge(c.estado)
                return (
                  <div key={c.id} style={{
                    background:'var(--main-bg,#f9fafb)',borderRadius:10,
                    padding:'10px 12px',border:'1px solid var(--border)'
                  }}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                      <div style={{fontSize:12,fontWeight:700,color:'var(--text-primary)'}}>{c.clientes?.nombre_razon_social}</div>
                      <span style={{background:badge.bg,color:badge.color,borderRadius:12,padding:'2px 8px',fontSize:10,fontWeight:700}}>{badge.label}</span>
                    </div>
                    <div style={{fontSize:11,color:'var(--text-secondary)',marginBottom:2}}>{periodoLabel(c.periodo)}</div>
                    <div style={{fontSize:12,fontWeight:600}}>{gs(Number(c.total))} Gs.</div>
                    {pag > 0 && <div style={{fontSize:11,color:'#10b981'}}>Pagado: {gs(pag)} Gs.</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Módulos futuros ── */}
      <div style={{background:'var(--card-bg,#fff)',border:'1px solid var(--border)',borderRadius:14,padding:'20px 24px'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
          <h3 style={{fontSize:15,fontWeight:700}}>Módulos Ñongatu</h3>
          <span style={{background:'#eff6ff',color:'#2563eb',borderRadius:12,padding:'2px 10px',fontSize:11,fontWeight:600}}>Próximamente</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12}}>
          {[
            {icon:'🥒',nombre:'Pepinillos',color:'#d1fae5',text:'#065f46',desc:'Cosecha y ventas'},
            {icon:'🧀',nombre:'Quesos',color:'#fef3c7',text:'#92400e',desc:'Producción láctea'},
            {icon:'🚚',nombre:'Proveedores',color:'#ede9fe',text:'#5b21b6',desc:'Gestión de compras'},
            {icon:'📊',nombre:'Producción',color:'#dbeafe',text:'#1e40af',desc:'Reportes avanzados'},
          ].map(mod=>(
            <div key={mod.nombre} style={{
              background:mod.color,borderRadius:12,padding:'14px 16px',
              display:'flex',flexDirection:'column',gap:6,opacity:0.75,
              border:`1px solid ${mod.color}`
            }}>
              <div style={{fontSize:28}}>{mod.icon}</div>
              <div style={{fontSize:13,fontWeight:700,color:mod.text}}>{mod.nombre}</div>
              <div style={{fontSize:11,color:mod.text,opacity:0.8}}>{mod.desc}</div>
              <div style={{fontSize:10,fontWeight:700,color:mod.text,marginTop:4,opacity:0.6}}>EN DESARROLLO</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
