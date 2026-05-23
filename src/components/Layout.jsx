import { useState, useEffect } from 'react'

const NAV = [
  { key: 'dashboard',     label: 'Inicio' },
  { key: 'clientes',      label: 'Clientes' },
  { key: 'animales',      label: 'Animales' },
  { key: 'cobros',        label: 'Cobros' },
  { key: 'reportes',      label: 'Reportes' },
  { key: 'categorias',    label: 'Categorías' },
  { key: 'usuarios',      label: 'Usuarios' },
  { key: 'configuracion', label: 'Configuración', adminOnly: true },
]

const ALL_LABELS = { ...Object.fromEntries(NAV.map(n=>[n.key,n.label])), perfil: 'Mi Perfil' }

export default function Layout({ user, currentPage, onNavigate, onLogout, children }) {
  const [open, setOpen]   = useState(false)
  const [foto, setFoto]   = useState(null)
  const perms = user?.permisos || {}

  // Reload photo when page changes (user may have just updated it)
  useEffect(() => {
    const key = `profile_photo_${user?.nombre_usuario}`
    setFoto(localStorage.getItem(key) || null)
  }, [currentPage, user?.nombre_usuario])

  const getDisplayName = () => {
    try {
      const saved = localStorage.getItem(`profile_data_${user?.nombre_usuario}`)
      if (saved) {
        const p = JSON.parse(saved)
        if (p.nombre_completo) return p.nombre_completo
      }
    } catch {}
    return user?.nombre_usuario || ''
  }

  const canSee = (key) => {
    const navItem = NAV.find(n => n.key === key)
    if (navItem?.adminOnly) return user?.rol === 'Administrador'
    if (user?.rol === 'Administrador') return true
    const map = {
      clientes:   'ver_clientes',
      animales:   'ver_animales',
      cobros:     'ver_cobros',
      reportes:   'ver_reportes',
      categorias: false,
      usuarios:   false,
    }
    return map[key] !== undefined ? (map[key] ? perms[map[key]] : false) : key === 'dashboard'
  }

  const navigate = (key) => { onNavigate(key); setOpen(false) }
  const displayName = getDisplayName()
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div className="app-layout">
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-title">🐄 ÑONGATU</div>

        <nav className="sidebar-nav">
          {NAV.filter(n => canSee(n.key)).map(n => (
            <button
              key={n.key}
              className={`nav-item ${currentPage === n.key ? 'active' : ''}`}
              onClick={() => navigate(n.key)}
            >
              {n.label}
            </button>
          ))}
        </nav>

        {/* ── Perfil / Logout ── */}
        <div className="sidebar-logout">
          <button
            className={`sidebar-profile-btn ${currentPage === 'perfil' ? 'active' : ''}`}
            onClick={() => navigate('perfil')}
          >
            <div className="sidebar-avatar">
              {foto
                ? <img src={foto} alt="perfil" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}} />
                : <span style={{fontSize:15,color:'#fff',fontWeight:700}}>{initial}</span>
              }
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{displayName}</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.55)',marginTop:1}}>{user?.rol}</div>
            </div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.4)'}}>›</div>
          </button>
          <button onClick={onLogout} className="sidebar-logout-btn">Cerrar sesión</button>
        </div>
      </aside>

      <div className="main-content">
        <div className="topbar">
          <button className="hamburger" onClick={() => setOpen(!open)}>
            <span /><span /><span />
          </button>
          <span className="topbar-title">
            {ALL_LABELS[currentPage] || 'Inicio'}
          </span>
          <span className="topbar-user">
            {user?.nombre_usuario} — {user?.rol}
          </span>
        </div>
        <div className="page-content">{children}</div>
      </div>
    </div>
  )
}
