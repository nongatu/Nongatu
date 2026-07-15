import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

// Permisos agrupados por módulo — cada sección tiene un color de acento
const PERMS_SECTIONS = [
  {
    key: 'clientes',
    label: '👤 Clientes',
    color: '#2563eb',
    perms: [
      { key: 'ver_clientes',          label: 'Ver listado de clientes' },
      { key: 'crear_editar_clientes', label: 'Crear y editar clientes' },
    ],
  },
  {
    key: 'animales',
    label: '🐄 Animales',
    color: '#059669',
    perms: [
      { key: 'ver_animales',      label: 'Ver animales' },
      { key: 'registrar_animales', label: 'Registrar y editar animales' },
    ],
  },
  {
    key: 'ventas',
    label: '🛒 Ventas',
    color: '#ea580c',
    perms: [
      { key: 'ver_ventas',   label: 'Ver ventas' },
      { key: 'crear_ventas', label: 'Registrar ventas, producción y crear clientes desde Ventas' },
    ],
  },
  {
    key: 'cobros',
    label: '💰 Cobros',
    color: '#7c3aed',
    perms: [
      { key: 'ver_cobros',      label: 'Ver cobros' },
      { key: 'generar_cobros',  label: 'Generar cobros pendientes' },
      { key: 'registrar_pagos', label: 'Registrar pagos y pagos adelantados' },
    ],
  },
  {
    key: 'reportes',
    label: '📊 Reportes',
    color: '#0891b2',
    perms: [
      { key: 'ver_reportes',  label: 'Ver reportes' },
      { key: 'exportar_pdf',  label: 'Exportar reportes en PDF' },
      { key: 'exportar_csv',  label: 'Exportar reportes en CSV / Excel' },
    ],
  },
  {
    key: 'categorias',
    label: '🗂️ Categorías y especies',
    color: '#d97706',
    perms: [
      { key: 'ver_categorias',       label: 'Ver categorías y especies' },
      { key: 'gestionar_categorias', label: 'Crear, editar y eliminar categorías y especies' },
    ],
  },
  {
    key: 'general',
    label: '⚙️ Acciones generales',
    color: '#dc2626',
    perms: [
      { key: 'eliminar_anular', label: 'Eliminar y anular registros (clientes, animales, cobros, ventas)' },
      { key: 'ver_tareas',      label: 'Ver y gestionar tareas pendientes en el dashboard' },
    ],
  },
]

// Lista plana para el marcar-todo
const ALL_PERMS = PERMS_SECTIONS.flatMap(s => s.perms)

const EMPTY = { nombre_usuario: '', password_hash: '', rol: 'Usuario', activo: true, permisos: {} }

// Resumen legible de los permisos de un usuario para mostrar en la tabla
function resumenPermisos(permisos) {
  if (!permisos || Object.keys(permisos).length === 0) return 'Sin permisos'
  const activos = ALL_PERMS.filter(p => permisos[p.key]).map(p => p.label)
  if (activos.length === 0) return 'Sin permisos'
  if (activos.length >= ALL_PERMS.length) return 'Acceso completo'
  return `${activos.length} de ${ALL_PERMS.length} permisos`
}

export default function Usuarios({ user }) {
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [verPermisos, setVerPermisos] = useState(null) // id del usuario cuya fila está expandida

  if (user?.rol !== 'Administrador') {
    return <div className="page-card" style={{ color: 'var(--text-secondary)' }}>Solo los administradores pueden gestionar usuarios.</div>
  }

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    const { data } = await supabase.from('usuarios').select('id,nombre_usuario,rol,activo,fecha_creacion,permisos').order('fecha_creacion')
    setLista(data || [])
    setLoading(false)
  }

  const abrirNuevo = () => {
    setForm(EMPTY); setEditId(null); setMsg(null); setModal(true)
  }

  const abrirEditar = (u) => {
    setForm({ nombre_usuario: u.nombre_usuario, password_hash: '', rol: u.rol, activo: u.activo, permisos: u.permisos || {} })
    setEditId(u.id); setMsg(null); setModal(true)
  }

  const togglePerm = (key) => {
    setForm(f => ({ ...f, permisos: { ...f.permisos, [key]: !f.permisos[key] } }))
  }

  const marcarSeccion = (seccionKey, val) => {
    const sec = PERMS_SECTIONS.find(s => s.key === seccionKey)
    if (!sec) return
    const permisos = { ...form.permisos }
    sec.perms.forEach(p => { permisos[p.key] = val })
    setForm(f => ({ ...f, permisos }))
  }

  const marcarTodo = (val) => {
    const permisos = {}
    ALL_PERMS.forEach(p => { permisos[p.key] = val })
    setForm(f => ({ ...f, permisos }))
  }

  const seccionCompleta = (sec) => sec.perms.every(p => !!form.permisos[p.key])
  const seccionParcial  = (sec) => sec.perms.some(p => !!form.permisos[p.key]) && !seccionCompleta(sec)

  const guardar = async () => {
    if (!form.nombre_usuario.trim()) return setMsg({ type: 'error', text: 'El nombre de usuario es obligatorio.' })
    if (!editId && !form.password_hash.trim()) return setMsg({ type: 'error', text: 'La contraseña es obligatoria.' })
    setSaving(true); setMsg(null)
    try {
      const payload = { nombre_usuario: form.nombre_usuario, rol: form.rol, activo: form.activo, permisos: form.permisos }
      if (form.password_hash.trim()) payload.password_hash = form.password_hash
      if (editId) {
        await supabase.from('usuarios').update(payload).eq('id', editId)
      } else {
        await supabase.from('usuarios').insert({ ...payload, fecha_creacion: new Date().toISOString() })
      }
      setModal(false); cargar()
    } catch { setMsg({ type: 'error', text: 'Error al guardar.' }) }
    setSaving(false)
  }

  const eliminar = async (id) => {
    if (id === user?.id) return alert('No podés eliminar tu propio usuario.')
    if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return
    const { error } = await supabase.rpc('eliminar_usuario', { user_id: id })
    if (error) {
      alert('No se pudo eliminar el usuario: ' + error.message)
    } else {
      cargar()
    }
  }

  return (
    <div>
      <div className="section-header">
        <h2>Gestión de usuarios</h2>
        <button className="btn btn-blue" onClick={abrirNuevo}>+ Nuevo usuario</button>
      </div>

      <div className="table-container">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Permisos</th>
                <th>Fecha creación</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="table-empty">Cargando...</td></tr>
              ) : lista.map(u => (
                <>
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td style={{ fontWeight: 600 }}>{u.nombre_usuario}</td>
                    <td><span className={`badge badge-${u.rol === 'Administrador' ? 'blue' : 'gray'}`}>{u.rol}</span></td>
                    <td><span className={`badge badge-${u.activo ? 'green' : 'red'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td>
                      {u.rol === 'Administrador' ? (
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>Acceso total</span>
                      ) : (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => setVerPermisos(verPermisos === u.id ? null : u.id)}
                          style={{ fontSize: 11 }}
                        >
                          {resumenPermisos(u.permisos)} {verPermisos === u.id ? '▲' : '▼'}
                        </button>
                      )}
                    </td>
                    <td>{u.fecha_creacion ? new Date(u.fecha_creacion).toLocaleDateString('es-PY') : '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-blue btn-sm" onClick={() => abrirEditar(u)}>Editar</button>
                        {u.id !== user?.id && <button className="btn btn-red btn-sm" onClick={() => eliminar(u.id)}>Eliminar</button>}
                      </div>
                    </td>
                  </tr>
                  {verPermisos === u.id && u.rol !== 'Administrador' && (
                    <tr key={`perms-${u.id}`}>
                      <td colSpan={7} style={{ padding: '8px 16px 16px', background: 'var(--main-bg,#f9fafb)' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                          {PERMS_SECTIONS.map(sec => (
                            <div key={sec.key} style={{ minWidth: 200 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: sec.color, marginBottom: 6 }}>{sec.label}</div>
                              {sec.perms.map(p => (
                                <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                  <span style={{
                                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                                    background: u.permisos?.[p.key] ? '#10b981' : '#e5e7eb',
                                    border: `1px solid ${u.permisos?.[p.key] ? '#059669' : '#d1d5db'}`,
                                  }} />
                                  <span style={{ fontSize: 12, color: u.permisos?.[p.key] ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                    {p.label}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <h3>{editId ? 'Editar usuario' : 'Nuevo usuario'}</h3>
            {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

            <div className="form-grid-2">
              <div className="form-group">
                <label>Nombre de usuario *</label>
                <input value={form.nombre_usuario} onChange={e => setForm({ ...form, nombre_usuario: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Contraseña {editId ? '(dejar vacío para no cambiar)' : '*'}</label>
                <input type="password" value={form.password_hash} onChange={e => setForm({ ...form, password_hash: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Rol *</label>
                <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
                  <option value="Administrador">Administrador</option>
                  <option value="Usuario">Usuario</option>
                </select>
              </div>
              <div className="form-group">
                <label>Estado</label>
                <select value={form.activo} onChange={e => setForm({ ...form, activo: e.target.value === 'true' })}>
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </div>
            </div>

            {form.rol !== 'Administrador' && (
              <div style={{ marginBottom: 16 }}>
                {/* Encabezado permisos + acciones rápidas */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Permisos del usuario</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => marcarTodo(true)}>✅ Marcar todo</button>
                    <button className="btn btn-outline btn-sm" onClick={() => marcarTodo(false)}>❌ Desmarcar todo</button>
                  </div>
                </div>

                {/* Secciones de permisos */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {PERMS_SECTIONS.map(sec => (
                    <div key={sec.key} style={{
                      border: `1px solid ${sec.color}33`,
                      borderRadius: 10,
                      overflow: 'hidden',
                    }}>
                      {/* Encabezado de sección con checkbox de sección completa */}
                      <div style={{
                        background: `${sec.color}12`,
                        borderBottom: `1px solid ${sec.color}33`,
                        padding: '8px 14px',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}>
                        <input
                          type="checkbox"
                          checked={seccionCompleta(sec)}
                          ref={el => { if (el) el.indeterminate = seccionParcial(sec) }}
                          onChange={e => marcarSeccion(sec.key, e.target.checked)}
                          style={{ width: 15, height: 15, cursor: 'pointer' }}
                        />
                        <span style={{ fontWeight: 700, fontSize: 13, color: sec.color }}>{sec.label}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                          {sec.perms.filter(p => !!form.permisos[p.key]).length} / {sec.perms.length} activos
                        </span>
                      </div>

                      {/* Permisos individuales */}
                      <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px 24px' }}>
                        {sec.perms.map(p => (
                          <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                            <input
                              type="checkbox"
                              checked={!!form.permisos[p.key]}
                              onChange={() => togglePerm(p.key)}
                              style={{ width: 14, height: 14, cursor: 'pointer' }}
                            />
                            {p.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10 }}>
                  {ALL_PERMS.filter(p => !!form.permisos[p.key]).length} de {ALL_PERMS.length} permisos activos
                </div>
              </div>
            )}

            {form.rol === 'Administrador' && (
              <div style={{
                background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
                padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#1e40af'
              }}>
                ℹ️ Los administradores tienen acceso completo a todos los módulos sin restricciones.
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-green" onClick={guardar} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
