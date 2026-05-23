import { useState, useEffect } from 'react'
import Login from './components/Login.jsx'
import Layout from './components/Layout.jsx'
import Dashboard from './components/Dashboard.jsx'
import Clientes from './components/Clientes.jsx'
import Animales from './components/Animales.jsx'
import Cobros from './components/Cobros.jsx'
import Reportes from './components/Reportes.jsx'
import Usuarios from './components/Usuarios.jsx'
import Categorias from './components/Categorias.jsx'
import Perfil from './components/Perfil.jsx'
import Configuracion, { aplicarFavicon } from './components/Configuracion.jsx'

export default function App() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('dashboard')

  useEffect(() => {
    const saved = localStorage.getItem('nongatu_user')
    if (saved) setUser(JSON.parse(saved))
    // Aplicar favicon personalizado si existe
    const fav = localStorage.getItem('nongatu_favicon')
    if (fav) aplicarFavicon(fav)
  }, [])

  const handleLogin = (u) => {
    setUser(u)
    localStorage.setItem('nongatu_user', JSON.stringify(u))
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('nongatu_user')
    setPage('dashboard')
  }

  if (!user) return <Login onLogin={handleLogin} />

  const pages = {
    dashboard: Dashboard, clientes: Clientes, animales: Animales,
    cobros: Cobros, reportes: Reportes, usuarios: Usuarios, categorias: Categorias,
    perfil: Perfil, configuracion: Configuracion,
  }
  const PageComponent = pages[page] || Dashboard

  return (
    <Layout user={user} currentPage={page} onNavigate={setPage} onLogout={handleLogout}>
      <PageComponent user={user} onNavigate={setPage} />
    </Layout>
  )
}
