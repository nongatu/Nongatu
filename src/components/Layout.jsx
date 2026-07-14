import { useState } from 'react'
import Toast from './ui/Toast.jsx'

const NAV = [
  { key: 'dashboard', label: 'Inicio',   icon: '🏠' },
  { key: 'clientes',  label: 'Clientes', icon: '👥' },
  { key: 'animales',  label: 'Animales', icon: '🐄' },
  { key: 'cobros',    label: 'Cobros',   icon: '💳' },
  { key: 'reportes',  label: 'Reportes', icon: '📊' },
]

const PROXIMAMENTE = [
  { label: 'Salarios',      icon: '🧾', msg: 'Módulo Salarios: planificado para una próxima etapa.' },
  { label: 'Caja y Bancos', icon: '🏦', msg: 'Caja y Bancos: las cuentas de pago ya están preparadas para este módulo.' },
]

const ALL_LABELS = {
  ...Object.fromEntries(NAV.map(n => [n.key, n.label])),
  perfil: 'Mi Perfil',
  configuracion: 'Configuración',
  usuarios: 'Gestión de usuarios',
}

export default function Layout({ user, currentPage, onNavigate, onLogout, children }) {
  const [open, setOpen]   = useState(false)
  const [logoOk, setLogoOk] = useState(true)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('nongatu_sidebar_collapsed') === 'true')
  const [toast, setToast] = useState(null)
  const perms = user?.permisos || {}

  const toggleCollapsed = () => {
    setCollapsed(c => {
      const next = !c
      localStorage.setItem('nongatu_sidebar_collapsed', String(next))
      return next
    })
  }

  const avisoProximamente = (msg) => setToast({ type: 'info', text: msg })

  // Foto: primero desde Supabase (foto_url), luego localStorage como fallback
  const foto = user?.foto_url || localStorage.getItem(`profile_photo_${user?.nombre_usuario}`) || null

  const getDisplayName = () => {
    try {
      const saved = localStorage.getItem(`profile_data_${user?.nombre_usuario}`)
      if (saved) {
        const p = JSON.parse(saved)
        return p.apodo?.trim() || p.nombre?.trim() || user?.nombre_usuario || ''
      }
    } catch {}
    return user?.nombre_usuario || ''
  }

  const canSee = (key) => {
    if (user?.rol === 'Administrador') return true
    const map = {
      clientes:   'ver_clientes',
      animales:   'ver_animales',
      cobros:     'ver_cobros',
      reportes:   'ver_reportes',
      categorias: 'ver_categorias',
    }
    return map[key] !== undefined ? (map[key] ? perms[map[key]] : false) : key === 'dashboard'
  }

  const navigate = (key) => { onNavigate(key); setOpen(false) }
  const displayName = getDisplayName()
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div className="app-layout">
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />

      <aside className={`sidebar ${open ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-title-row">
          <div className="sidebar-title">
            {logoOk
              ? <img
                  src="/nongatu-logo-sidebar.png"
                  alt="Ñongatu"
                  onError={() => setLogoOk(false)}
                  style={{ maxWidth: 180, maxHeight: 48, objectFit: 'contain', display: 'block' }}
                />
              : '🐄 ÑONGATU'
            }
          </div>
          <button
            className="sidebar-collapse-btn"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expandir menú' : 'Minimizar menú'}
          >
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV.filter(n => canSee(n.key)).map(n => (
            <button
              key={n.key}
              className={`nav-item ${currentPage === n.key ? 'active' : ''}`}
              onClick={() => navigate(n.key)}
              data-tip={n.label}
            >
              <span className="nav-icon">{n.icon}</span>
              <span className="nav-label">{n.label}</span>
            </button>
          ))}

          <div className="nav-sep">Próximamente</div>
          {PROXIMAMENTE.map(p => (
            <button
              key={p.label}
              className="nav-item soon"
              onClick={() => avisoProximamente(p.msg)}
              data-tip={p.label}
            >
              <span className="nav-icon">{p.icon}</span>
              <span className="nav-label">{p.label}</span>
            </button>
          ))}
        </nav>

        {/* ── Configuración (solo admin, fija encima del perfil) ── */}
        {user?.rol === 'Administrador' && (
          <div style={{ padding: '0 8px 6px' }}>
            <button
              className={`nav-item ${currentPage === 'configuracion' ? 'active' : ''}`}
              onClick={() => navigate('configuracion')}
              style={{ width: '100%' }}
              data-tip="Configuración"
            >
              <span className="nav-icon">⚙️</span>
              <span className="nav-label">Configuración</span>
            </button>
          </div>
        )}

        {/* ── Perfil / Logout ── */}
        <div className="sidebar-logout">
          <button
            className={`sidebar-profile-btn ${currentPage === 'perfil' ? 'active' : ''}`}
            onClick={() => navigate('perfil')}
            title="Mi perfil"
          >
            <div className="sidebar-avatar">
              {foto
                ? <img src={foto} alt="perfil" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}} />
                : <span style={{fontSize:15,color:'#fff',fontWeight:700}}>{initial}</span>
              }
            </div>
            <div style={{flex:1,minWidth:0}} className="nav-label">
              <div style={{fontSize:12,fontWeight:600,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{displayName}</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.55)',marginTop:1}}>{user?.rol}</div>
            </div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.4)'}} className="nav-label">›</div>
          </button>
          <button onClick={onLogout} className="sidebar-logout-btn" title="Cerrar sesión">
            {collapsed ? '⏻' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>

      <div className={`main-content ${collapsed ? 'collapsed' : ''}`}>
        {/* Topbar móvil — solo visible en pantallas chicas */}
        <div className="mobile-topbar">
          <button className="mobile-menu-btn" onClick={() => setOpen(true)}>
            <span /><span /><span />
          </button>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {ALL_LABELS[currentPage] || 'Ñongatu'}
          </div>
          <div style={{ width: 36 }} />
        </div>
        <div className="page-content">{children}</div>
      </div>

      {toast && <Toast text={toast.text} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
