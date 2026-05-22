import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { gs } from '../utils/helpers'

export default function Dashboard() {
  const [stats, setStats] = useState({ animales: 0, clientes: 0, pendiente: 0, mes: 0 })
  const [porCategoria, setPorCategoria] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    try {
      const [animalesRes, { count: clientes }, cobrosRes, catRes] = await Promise.all([
        supabase.from('animales').select('cantidad').eq('estado', 'activo'),
        supabase.from('clientes').select('*', { count: 'exact', head: true }),
        supabase.from('cobros').select('total, estado, periodo, pagos(monto)'),
        supabase.from('animales').select('categoria_id, cantidad, categorias(nombre)').eq('estado', 'activo'),
      ])

      const ahora = new Date()
      const periodoActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`

      // Suma de cantidades, no conteo de filas
      const animales = animalesRes.data?.reduce((s, a) => s + Number(a.cantidad), 0) || 0

      // Saldo real: incluye cobros pendientes Y parciales
      const pendiente = cobrosRes.data?.reduce((s, c) => {
        const pagado = c.pagos?.reduce((ps, p) => ps + Number(p.monto), 0) || 0
        return s + Math.max(0, Number(c.total) - pagado)
      }, 0) || 0

      const mes = cobrosRes.data?.filter(c => c.periodo === periodoActual)
        .reduce((s, c) => s + Number(c.total), 0) || 0

      setStats({ animales, clientes: clientes || 0, pendiente, mes })

      const agrupado = {}
      catRes.data?.forEach(a => {
        const nombre = a.categorias?.nombre || 'Sin categoría'
        agrupado[nombre] = (agrupado[nombre] || 0) + Number(a.cantidad)
      })
      setPorCategoria(Object.entries(agrupado).sort((a, b) => b[1] - a[1]))
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  if (loading) return <div className="spinner" />

  return (
    <div>
      <div className="metric-cards">
        <div className="metric-card green">
          <div className="label">Animales activos</div>
          <div className="value">{stats.animales}</div>
        </div>
        <div className="metric-card blue">
          <div className="label">Clientes</div>
          <div className="value">{stats.clientes}</div>
        </div>
        <div className="metric-card orange">
          <div className="label">Pendiente de cobro</div>
          <div className="value" style={{ fontSize: 18 }}>{gs(stats.pendiente)} Gs.</div>
        </div>
        <div className="metric-card red">
          <div className="label">Total del mes</div>
          <div className="value" style={{ fontSize: 18 }}>{gs(stats.mes)} Gs.</div>
        </div>
      </div>

      <div className="page-card">
        <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>Animales por categoría</h3>
        {porCategoria.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>Sin datos aún. Registrá animales para ver estadísticas.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {porCategoria.map(([nombre, cant]) => (
              <div key={nombre} style={{ background: 'var(--main-bg)', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{nombre}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--sidebar-bg)' }}>{cant}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
