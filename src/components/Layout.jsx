import { useState } from 'react'
import Toast from './ui/Toast.jsx'

const IconInicio = () => (
  <svg viewBox="0 0 24 24"><path d="M3 11.2 12 4l9 7.2"/><path d="M5.5 9.8V20h13V9.8"/></svg>
)
const IconClientes = () => (
  <svg viewBox="0 0 24 24"><circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3.1 2.9-4.7 5.5-4.7S13.9 15.9 14.5 19"/><path d="M15.5 6.4a2.8 2.8 0 1 1 1.6 5.2M17 14.6c2 .5 3.2 1.9 3.6 4.4"/></svg>
)
const IconAnimales = () => (
  <svg viewBox="0 0 24 24"><path d="M12 3.5c3.6 0 6.5 2.4 6.5 5.7 0 4.4-3.4 6-3.9 9.3-.1.9-1.1 1.5-2.6 1.5s-2.5-.6-2.6-1.5C8.9 15.2 5.5 13.6 5.5 9.2 5.5 5.9 8.4 3.5 12 3.5Z"/><path d="M9.7 9.5h.01M14.3 9.5h.01"/></svg>
)
const IconVentas = () => (
  <svg viewBox="0 0 24 24"><path d="M6 7.5h12l-1 12H7l-1-12Z"/><path d="M9 10V6.8a3 3 0 0 1 6 0V10"/></svg>
)
const IconCobros = () => (
  <svg viewBox="0 0 24 24"><rect x="3.5" y="6" width="17" height="12.5" rx="2.5"/><path d="M3.5 10h17"/><path d="M7 14.8h4"/></svg>
)
const IconGastos = () => (
  <svg viewBox="0 0 24 24"><path d="M4 12.5v5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5v-5"/><path d="M12 14V4M8.5 7.5 12 4l3.5 3.5"/></svg>
)
const IconProveedores = () => (
  <svg viewBox="0 0 24 24"><path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z"/><path d="M4 8.5 12 13l8-4.5M12 13v7"/></svg>
)
const IconReportes = () => (
  <svg viewBox="0 0 24 24"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>
)
const IconConfig = () => (
  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6"/></svg>
)
const IconSalarios = () => (
  <svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="11" r="2.2"/><path d="M6 16.5c.5-1.7 1.7-2.5 3-2.5s2.5.8 3 2.5M15 9.5h4M15 13h4"/></svg>
)
const IconCajaBancos = () => (
  <svg viewBox="0 0 24 24"><path d="M4 10 12 4.5 20 10"/><path d="M5.5 10V18M10 10v8M14 10v8M18.5 10V18"/><path d="M4 18h16M4 20.5h16"/></svg>
)
const IconSalir = () => (
  <svg viewBox="0 0 24 24"><path d="M9 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H9"/><path d="M15 8l4 4-4 4M19 12H9"/></svg>
)

const NAV = [
  { key: 'dashboard', label: 'Inicio',   Icon: IconInicio },
  { key: 'clientes',  label: 'Clientes', Icon: IconClientes },
  { key: 'animales',  label: 'Animales', Icon: IconAnimales },
  { key: 'ventas',    label: 'Ventas',   Icon: IconVentas },
  { key: 'cobros',    label: 'Cobros',   Icon: IconCobros },
  { key: 'gastos',      label: 'Gastos',      Icon: IconGastos },
  { key: 'proveedores', label: 'Proveedores', Icon: IconProveedores, badge: 'nuevo' },
  { key: 'reportes',    label: 'Reportes',    Icon: IconReportes },
]

const PROXIMAMENTE = [
  { label: 'Salarios',      Icon: IconSalarios,   msg: 'Módulo Salarios: planificado para una próxima etapa.' },
  { label: 'Caja y Bancos', Icon: IconCajaBancos, msg: 'Caja y Bancos: las cuentas de pago ya están preparadas para este módulo.' },
]

const ALL_LABELS = {
  ...Object.fromEntries(NAV.map(n => [n.key, n.label])),
  perfil: 'Mi Perfil',
  configuracion: 'Configuración',
  usuarios: 'Gestión de usuarios',
}

export default function Layout({ user, currentPage, onNavigate, onLogout, children }) {
  const [open, setOpen]   = useState(false)
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
      ventas:     'ver_ventas',
      cobros:     'ver_cobros',
      gastos:      'ver_gastos',
      proveedores: 'ver_gastos',
      reportes:    'ver_reportes',
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
            <span className="marca">ñ<span className="o">o</span>ngatu</span>
          </div>
          <span className="marca-min">ñ</span>
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
              <span className="nav-icon"><n.Icon /></span>
              <span className="nav-label">{n.label}</span>
              {n.badge && <span className="nav-badge nuevo">{n.badge}</span>}
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
              <span className="nav-icon"><p.Icon /></span>
              <span className="nav-label">{p.label}</span>
              <span className="nav-badge">pronto</span>
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
              <span className="nav-icon"><IconConfig /></span>
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
                : <span style={{fontSize:14,color:'var(--sb-bot)',fontWeight:700}}>{initial}</span>
              }
            </div>
            <div style={{flex:1,minWidth:0}} className="nav-label">
              <div style={{fontSize:12.5,fontWeight:600,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{displayName}</div>
              <div style={{fontSize:10,color:'#b9c8ea',marginTop:1}}>{user?.rol}</div>
            </div>
          </button>
          <button onClick={onLogout} className="sidebar-logout-btn" title="Cerrar sesión">
            <IconSalir />
            <span className="nav-label">Cerrar sesión</span>
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
