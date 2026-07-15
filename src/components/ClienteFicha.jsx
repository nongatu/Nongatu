import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { gs, periodoLabel } from '../utils/helpers'
import Modal from './ui/Modal.jsx'

const TIPO_BADGE = {
  pastaje: { cls: 'blue',   label: 'Pastaje' },
  ventas:  { cls: 'orange', label: 'Ventas' },
  mixto:   { cls: 'purple', label: 'Pastaje + Ventas' },
}

const TABS = [
  { key: 'datos',    label: 'Datos' },
  { key: 'animales', label: 'Animales en pastura' },
  { key: 'cobros',   label: 'Historial de cobros' },
  { key: 'ventas',   label: 'Ventas' },
]

const FORMA_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia', fiado: 'Fiado' }

export default function ClienteFicha({ cliente, onClose, onEditar }) {
  const [tab, setTab] = useState('datos')
  const [animales, setAnimales] = useState([])
  const [cobros, setCobros] = useState([])
  const [ventas, setVentas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [cliente.id])

  const cargar = async () => {
    setLoading(true)
    const [{ data: an }, { data: cb }, { data: vt }] = await Promise.all([
      supabase.from('animales')
        .select('cantidad,fecha_ingreso,precio,categorias(nombre,especies(nombre))')
        .eq('cliente_id', cliente.id).eq('estado', 'activo'),
      supabase.from('cobros')
        .select('id,periodo,total,estado,pagos(monto)')
        .eq('cliente_id', cliente.id)
        .order('periodo', { ascending: false }),
      supabase.from('ventas')
        .select('id,numero,fecha,total,estado,forma_pago,venta_cobros(monto)')
        .eq('cliente_id', cliente.id)
        .order('id', { ascending: false }),
    ])
    setAnimales(an || [])
    setCobros(cb || [])
    setVentas(vt || [])
    setLoading(false)
  }

  const saldoFiado = ventas.filter(v => v.estado === 'pendiente').reduce((s, v) => {
    const cobrado = v.venta_cobros?.reduce((ss, vc) => ss + Number(vc.monto), 0) || 0
    return s + Math.max(0, Number(v.total) - cobrado)
  }, 0)

  const tipo = TIPO_BADGE[cliente.tipo] || TIPO_BADGE.pastaje
  const iniciales = (cliente.nombre_razon_social || '?').trim().slice(0, 2).toUpperCase()

  return (
    <Modal
      size="lg"
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dbeafe', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
            {iniciales}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{cliente.nombre_razon_social}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
              {cliente.ruc ? `RUC ${cliente.ruc}` : cliente.cedula ? `C.I. ${cliente.cedula}` : 'Sin documento'}
              <span className={`badge badge-${tipo.cls}`}>{tipo.label}</span>
            </div>
          </div>
        </div>
      }
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
          <button className="btn btn-blue" onClick={() => onEditar(cliente)}>Editar cliente</button>
        </>
      }
    >
      <div className="tabs">
        {TABS.map(t => (
          <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'datos' && (
        <div style={{ fontSize: 13.5, lineHeight: 1.9 }}>
          <div><b>Teléfono:</b> {cliente.telefono || '—'}</div>
          <div><b>Email:</b> {cliente.email || '—'}</div>
          <div><b>Dirección:</b> {cliente.direccion || '—'}</div>
          <div><b>Cédula:</b> {cliente.cedula || '—'}</div>
          <div><b>RUC:</b> {cliente.ruc || '—'}</div>
          <div><b>Cliente desde:</b> {cliente.fecha_alta ? new Date(cliente.fecha_alta).toLocaleDateString('es-PY') : '—'}</div>
        </div>
      )}

      {tab === 'animales' && (
        loading ? <div className="spinner" /> : animales.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sin animales en pastura.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Especie</th><th>Categoría</th><th>Cantidad</th><th>Ingreso</th><th>Precio</th></tr>
              </thead>
              <tbody>
                {animales.map((a, i) => (
                  <tr key={i}>
                    <td>{a.categorias?.especies?.nombre || '—'}</td>
                    <td>{a.categorias?.nombre || '—'}</td>
                    <td>{a.cantidad}</td>
                    <td>{a.fecha_ingreso ? new Date(a.fecha_ingreso).toLocaleDateString('es-PY') : '—'}</td>
                    <td>{gs(a.precio)} Gs.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'cobros' && (
        loading ? <div className="spinner" /> : cobros.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sin cobros registrados.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Período</th><th>Total</th><th>Pagado</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {cobros.map(c => {
                  const pagado = c.pagos?.reduce((s, p) => s + Number(p.monto), 0) || 0
                  return (
                    <tr key={c.id}>
                      <td>{periodoLabel(c.periodo)}</td>
                      <td>{gs(c.total)} Gs.</td>
                      <td>{gs(pagado)} Gs.</td>
                      <td>
                        <span className={`badge badge-${c.estado === 'pagado' ? 'green' : c.estado === 'parcial' ? 'orange' : 'red'}`}>
                          {c.estado === 'pagado' ? 'Pagado' : c.estado === 'parcial' ? 'Parcial' : 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}
      {tab === 'ventas' && (
        loading ? <div className="spinner" /> : (
          <>
            <div style={{ fontSize: 13, marginBottom: 10 }}>
              Saldo fiado pendiente: <b style={{ color: saldoFiado > 0 ? 'var(--red)' : 'var(--green)' }}>{gs(saldoFiado)} Gs.</b>
            </div>
            {ventas.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sin ventas registradas.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>N°</th><th>Fecha</th><th>Total</th><th>Forma de pago</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    {ventas.map(v => (
                      <tr key={v.id}>
                        <td>{String(v.numero).padStart(4, '0')}</td>
                        <td>{new Date(v.fecha + 'T00:00:00').toLocaleDateString('es-PY')}</td>
                        <td>{gs(v.total)} Gs.</td>
                        <td>{FORMA_LABEL[v.forma_pago] || v.forma_pago}</td>
                        <td>
                          <span className={`badge badge-${v.estado === 'pagada' ? 'green' : v.estado === 'anulada' ? 'gray' : 'orange'}`}>
                            {v.estado === 'pagada' ? 'Pagada' : v.estado === 'anulada' ? 'Anulada' : 'Pendiente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )
      )}
    </Modal>
  )
}
