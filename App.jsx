import { useState, useEffect } from 'react'
import Login from './Login.jsx'
import Layout from './Layout.jsx'
import Dashboard from './Dashboard.jsx'
import Clientes from './Clientes.jsx'
import Animales from './Animales.jsx'
import Cobros from './Cobros.jsx'
import Reportes from './Reportes.jsx'
import Usuarios from './Usuarios.jsx'
import Categorias from './Categorias.jsx'

export default function App() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('dashboard')

  useEffect(() => {
    const saved = localStorage.getItem('nongatu_user')
    if (saved) setUser(JSON.parse(saved))
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
    dashboard: Dashboard,
    clientes: Clientes,
    animales: Animales,
    cobros: Cobros,
    reportes: Reportes,
    usuarios: Usuarios,
    categorias: Categorias,
  }
  const PageComponent = pages[page] || Dashboard

  return (
    <Layout user={user} currentPage={page} onNavigate={setPage} onLogout={handleLogout}>
      <PageComponent user={user} />
    </Layout>
  )
}
