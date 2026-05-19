import { useState, useEffect } from 'react'
import Login from './components/Login'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Clientes from './components/Clientes'
import Animales from './components/Animales'
import Cobros from './components/Cobros'
import Reportes from './components/Reportes'
import Usuarios from './components/Usuarios'

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

  const pages = { dashboard: Dashboard, clientes: Clientes, animales: Animales, cobros: Cobros, reportes: Reportes, usuarios: Usuarios }
  const PageComponent = pages[page] || Dashboard

  return (
    <Layout user={user} currentPage={page} onNavigate={setPage} onLogout={handleLogout}>
      <PageComponent user={user} />
    </Layout>
  )
}
