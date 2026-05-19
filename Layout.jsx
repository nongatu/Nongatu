import { useState } from 'react'

const NAV = [
  { key: 'dashboard', label: 'Inicio' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'animales', label: 'Animales' },
  { key: 'cobros', label: 'Cobros' },
  { key: 'reportes', label: 'Reportes' },
  { key: 'usuarios', label: 'Usuarios' },
]

export default function Layout({ user, currentPage, onNavigate, onLogout, children }) {
  const [open, setOpen] = useState(false)
  const perms = user?.permisos || {}

  const canSee = (key) => {
    if (user?.rol === 'Administrador') return true
    const map = { clientes: 'ver_clientes', animales: 'ver_animales', cobros: 'ver_cobros', reportes: 'ver_reportes', usuarios: false }
    return map[key] ? perms[map[key]] : key === 'dashboard'
  }

  const navigate = (key) => { onNavigate(key); setOpen(false) }

  return (
    <div className="app-layout">
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-title">ÑONGATU</div>
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
        <div className="sidebar-logout">
          <div className="sidebar-user">{user?.nombre_usuario} ({user?.rol})</div>
          <button onClick={onLogout} style={{ marginTop: 8 }}>Cerrar sesión</button>
        </div>
      </aside>
      <div className="main-content">
        <div className="topbar">
          <button className="hamburger" onClick={() => setOpen(!open)}>
            <span /><span /><span />
          </button>
          <span className="topbar-title">
            {NAV.find(n => n.key === currentPage)?.label || 'Inicio'}
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
