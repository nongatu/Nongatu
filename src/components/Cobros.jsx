import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { gs, periodoActual, periodoLabel } from '../utils/helpers'

// ── Número a letras ───────────────────────────────────────────────────────────
const _u=['','Un','Dos','Tres','Cuatro','Cinco','Seis','Siete','Ocho','Nueve','Diez','Once','Doce','Trece','Catorce','Quince','Dieciséis','Diecisiete','Dieciocho','Diecinueve']
const _d=['','','Veinte','Treinta','Cuarenta','Cincuenta','Sesenta','Setenta','Ochenta','Noventa']
const _c=['','Cien','Doscientos','Trescientos','Cuatrocientos','Quinientos','Seiscientos','Setecientos','Ochocientos','Novecientos']
function _w(n){if(!n)return '';if(n<20)return _u[n];if(n<100){const r=n%10;return _d[Math.floor(n/10)]+(r?' y '+_u[r].toLowerCase():'')}if(n<1000){const r=n%100;return(n===100?'Cien':_c[Math.floor(n/100)])+(r?' '+_w(r).toLowerCase():'')}if(n<1000000){const m=Math.floor(n/1000),r=n%1000;return(m===1?'Mil':_w(m)+' Mil')+(r?' '+_w(r).toLowerCase():'')}const m=Math.floor(n/1000000),r=n%1000000;return(m===1?'Un Millón':_w(m)+' Millones')+(r?' '+_w(r).toLowerCase():'')}
const enLetras=(n)=>{const v=Math.round(Number(n)||0);return(v===0?'Cero':_w(v))+' Guaraníes'}

// ── HTML recibo ───────────────────────────────────────────────────────────────
function htmlRecibo(recibo,cliente,detalle){
  const filas=(detalle||[]).map(d=>`<tr><td>${d.categorias?.nombre||''}</td><td style="text-align:center">${d.cantidad||0}</td><td style="text-align:right">${gs(d.precio_unitario||0)}</td><td style="text-align:right">${gs(d.subtotal||0)}</td></tr>`).join('')
  const bloque=(copia)=>`<div class="recibo"><div class="header"><div class="empresa"><div class="nombre">QUERANDY S.A.</div><div>RUC: 80094734-7</div><div>Mcal. Estigarribia - Boquerón</div></div><div class="nro-box"><div class="nro-label">RECIBO N°</div><div class="nro">${String(recibo.numero||'').padStart(6,'0')}</div><div class="total-box">${gs(recibo.total)} Gs.</div></div></div><div class="linea"></div><table class="datos"><tr><td class="lbl">Fecha:</td><td>${new Date((recibo.fecha||'')+'T00:00:00').toLocaleDateString('es-PY')}</td></tr><tr><td class="lbl">Recibimos de:</td><td>${cliente}</td></tr><tr><td class="lbl">Importe en letras:</td><td>${enLetras(recibo.total)}</td></tr><tr><td class="lbl">Concepto:</td><td>Alquiler de Pastura - ${periodoLabel(recibo.periodo||'')}</td></tr></table><table class="detalle"><thead><tr><th>Detalle</th><th style="text-align:center">Cant.</th><th style="text-align:right">Precio</th><th style="text-align:right">Total</th></tr></thead><tbody>${filas}</tbody></table><div class="total-final">TOTAL PAGADO: ${gs(recibo.total)} Gs.</div><div class="firma">Firma</div><div class="copia">${copia}</div></div>`
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Recibo</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;padding:10px}.recibo{width:100%;max-width:680px;margin:0 auto 16px;border:1px solid #999;padding:14px}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}.empresa .nombre{font-size:16px;font-weight:700;margin-bottom:2px}.nro-box{text-align:right;min-width:180px}.nro-label{font-size:10px;font-weight:700;text-transform:uppercase}.nro{font-size:22px;font-weight:700}.total-box{font-size:15px;font-weight:700;border:2px solid #000;padding:4px 8px;margin-top:4px;text-align:center}.linea{border-top:1px solid #999;margin:8px 0}.datos{width:100%;margin-bottom:10px}.datos td{padding:2px 4px;vertical-align:top}.datos .lbl{font-weight:700;white-space:nowrap;width:140px}.detalle{width:100%;border-collapse:collapse;margin-bottom:10px}.detalle th,.detalle td{border:1px solid #ccc;padding:4px 6px;font-size:11px}.detalle th{background:#f0f0f0;font-weight:700}.total-final{text-align:right;font-weight:700;font-size:13px;border-top:2px solid #000;padding-top:6px;margin-bottom:20px}.firma{text-align:right;border-top:1px solid #000;width:200px;margin-left:auto;padding-top:2px;font-size:11px}.copia{text-align:right;font-size:10px;font-weight:700;margin-top:6px;color:#555}@media print{.recibo{page-break-inside:avoid}}</style></head><body>${bloque('ORIGINAL: CLIENTE')}${bloque('COPIA: CONTABILIDAD')}<script>window.onload=()=>{window.print()}<\/script></body></html>`
}

// ── Detectar períodos faltantes ───────────────────────────────────────────────
function calcularPeriodosFaltantes(animales, cobros, clientes) {
  const hoy = new Date()
  const periodoHoy = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`
  const resultado = []

  for (const cliente of clientes) {
    const animalesCli = animales.filter(a => a.cliente_id === cliente.id)
    if (!animalesCli.length) continue

    const fechas = animalesCli.map(a => new Date(a.fecha_ingreso+'T00:00:00'))
    const minFecha = new Date(Math.min(...fechas))
    const cobrosCliente = new Set(cobros.filter(c => c.cliente_id === cliente.id).map(c => c.periodo))

    const faltantes = []
    const cursor = new Date(minFecha.getFullYear(), minFecha.getMonth(), 1)
    const limite = new Date(hoy.getFullYear(), hoy.getMonth(), 1)

    while (cursor <= limite) {
      const p = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}`
      if (!cobrosCliente.has(p)) faltantes.push(p)
      cursor.setMonth(cursor.getMonth()+1)
    }

    if (faltantes.length) resultado.push({ cliente, periodos: faltantes })
  }
  return resultado
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Cobros({ user }) {
  const [tab, setTab] = useState('pagos')
  const [cobros, setCobros] = useState([])
  const [recibos, setRecibos] = useState([])
  const [clientes, setClientes] = useState([])
  const [animales, setAnimales] = useState([])
  const [creditos, setCreditos] = useState([])
  const [loading, setLoading] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [modal, setModal] = useState(null)
  const [modalForm, setModalForm] = useState({})
  const [msg, setMsg] = useState(null)
  const [filtroCliente, setFiltroCliente] = useState('')

  const perms = user?.rol === 'Administrador' ? { todo: true } : (user?.permisos || {})
  const puedeGenerar = perms.todo || perms.generar_cobros
  const puedeRegistrar = perms.todo || perms.registrar_pagos
  const puedeEliminar = perms.todo || perms.eliminar_anular

  useEffect(() => {
    Promise.all([
      supabase.from('clientes').select('id,nombre_razon_social,ruc').order('nombre_razon_social'),
      supabase.from('animales').select('id,cliente_id,categoria_id,cantidad,fecha_ingreso,precio,categorias(nombre,cobrable)').eq('estado','activo'),
    ]).then(([{ data: cl }, { data: an }]) => {
      setClientes(cl || [])
      setAnimales(an || [])
    })
    cargar()
  }, [])

  const cargar = async () => {
    setLoading(true)
    const [{ data: cb }, { data: rc }, { data: cr }] = await Promise.all([
      supabase.from('cobros').select('*, clientes(nombre_razon_social), pagos(monto,tipo)').order('periodo').order('cliente_id'),
      supabase.from('recibos').select('*, clientes(nombre_razon_social), cobros(periodo)').order('created_at', { ascending: false }),
      supabase.from('creditos_cliente').select('*, clientes(nombre_razon_social)').order('fecha_pago', { ascending: false }),
    ])
    setCobros(cb || [])
    setRecibos(rc || [])
    setCreditos(cr || [])
    setLoading(false)
  }

  const faltantes = calcularPeriodosFaltantes(animales, cobros, clientes)

  const stats = {
    pendiente: cobros.filter(c=>c.estado==='pendiente').reduce((s,c)=>s+Number(c.total),0),
    pagado: cobros.filter(c=>c.estado==='pagado').reduce((s,c)=>s+Number(c.total),0),
    parcial: cobros.filter(c=>c.estado==='parcial').reduce((s,c)=>s+Number(c.total),0),
    mes: cobros.filter(c=>c.periodo===periodoActual()).reduce((s,c)=>s+Number(c.total),0),
  }

  // ── Generar cobros faltantes ──────────────────────────────────────────────
  const generarFaltantes = async () => {
    if (!puedeGenerar || !faltantes.length) return
    setGenerando(true); setMsg(null)
    let total = 0

    for (const { cliente, periodos } of faltantes) {
      for (const periodo of periodos) {
        // Animales activos del cliente en ese período
        const [year, month] = periodo.split('-').map(Number)
        const finPeriodo = new Date(year, month, 0) // último día del mes
        const animalesCli = animales.filter(a =>
          a.cliente_id === cliente.id &&
          a.categorias?.cobrable &&
          new Date(a.fecha_ingreso+'T00:00:00') <= finPeriodo
        )
        if (!animalesCli.length) continue

        const detalles = {}
        animalesCli.forEach(a => {
          const cid = a.categoria_id
          if (!detalles[cid]) detalles[cid] = { categoria_id: cid, cantidad: 0, precio_unitario: Number(a.precio) }
          detalles[cid].cantidad += a.cantidad
        })
        const det = Object.values(detalles).map(d => ({ ...d, subtotal: d.cantidad * d.precio_unitario }))
        const gravada = det.reduce((s,d)=>s+d.subtotal,0)
        const iva = Math.round(gravada*0.1)
        const totalCobro = gravada+iva
        const venc = new Date(year, month, 10)

        const { data: cobro } = await supabase.from('cobros').insert({
          cliente_id: cliente.id, periodo,
          fecha_generacion: new Date().toISOString().split('T')[0],
          fecha_vencimiento: venc.toISOString().split('T')[0],
          gravada, iva, total: totalCobro, estado: 'pendiente'
        }).select().single()

        if (!cobro) continue
        await supabase.from('cobro_detalles').insert(det.map(d=>({...d, cobro_id: cobro.id})))

        // Aplicar créditos del período
        const creditosPeriodo = creditos.filter(cr =>
          cr.cliente_id === cliente.id &&
          !cr.aplicado &&
          (cr.periodo_aplicar === periodo || !cr.periodo_aplicar)
        ).sort((a,b) => new Date(a.fecha_pago)-new Date(b.fecha_pago))

        let saldoPendiente = totalCobro
        for (const cr of creditosPeriodo) {
          if (saldoPendiente <= 0) break
          const montoAplicar = Math.min(Number(cr.monto), saldoPendiente)
          const nroRecibo = String(recibos.length + 1).padStart(6,'0')
          const { data: pago } = await supabase.from('pagos').insert({
            cobro_id: cobro.id, monto: montoAplicar, tipo: 'credito_adelantado',
            fecha_pago: cr.fecha_pago+'T00:00:00', usuario_id: cr.usuario_id
          }).select().single()
          if (pago) {
            await supabase.from('creditos_cliente').update({ aplicado: true, cobro_id: cobro.id }).eq('id', cr.id)
            const detalleData = await supabase.from('cobro_detalles').select('*, categorias(nombre)').eq('cobro_id', cobro.id)
            await supabase.from('recibos').insert({
              pago_id: pago.id, cobro_id: cobro.id, numero: nroRecibo,
              fecha: cr.fecha_pago, cliente_id: cliente.id, total: montoAplicar,
              detalle: detalleData.data
            })
          }
          saldoPendiente -= montoAplicar
        }

        const nuevoEstado = saldoPendiente <= 0 ? 'pagado' : saldoPendiente < totalCobro ? 'parcial' : 'pendiente'
        await supabase.from('cobros').update({ estado: nuevoEstado }).eq('id', cobro.id)
        total++
      }
    }

    setMsg({ type: 'success', text: `Se generaron ${total} cobros y se aplicaron créditos automáticamente.` })
    await cargar()
    setGenerando(false)
  }

  // ── Registrar pago / cobro normal ─────────────────────────────────────────
  const abrirPago = (cobro) => {
    const pagado = cobro.pagos?.reduce((s,p)=>s+Number(p.monto),0) || 0
    const saldo = Number(cobro.total) - pagado
    setModalForm({ cobro, saldo, pagado, monto: saldo, tipo: 'completo', fecha_pago: new Date().toISOString().split('T')[0] })
    setModal('pago')
  }

  const registrarPago = async () => {
    const { cobro, monto, tipo, saldo, fecha_pago } = modalForm
    if (!monto || Number(monto) <= 0) return
    const montoNum = Number(monto)
    const { data: pago } = await supabase.from('pagos').insert({
      cobro_id: cobro.id, monto: montoNum, tipo,
      fecha_pago: fecha_pago+'T00:00:00', usuario_id: user?.id
    }).select().single()
    const nuevoEstado = montoNum >= saldo ? 'pagado' : 'parcial'
    await supabase.from('cobros').update({ estado: nuevoEstado }).eq('id', cobro.id)
    const nroRecibo = String(recibos.length + 1).padStart(6,'0')
    const detalleData = await supabase.from('cobro_detalles').select('*, categorias(nombre)').eq('cobro_id', cobro.id)
    await supabase.from('recibos').insert({
      pago_id: pago.id, cobro_id: cobro.id, numero: nroRecibo,
      fecha: fecha_pago, cliente_id: cobro.cliente_id, total: montoNum,
      detalle: detalleData.data
    })
    setModal(null); cargar()
  }

  // ── Registrar crédito / pago adelantado ───────────────────────────────────
  const abrirCredito = () => {
    setModalForm({ cliente_id: '', monto: '', fecha_pago: new Date().toISOString().split('T')[0], periodo_aplicar: '', observacion: '' })
    setModal('credito')
  }

  const registrarCredito = async () => {
    const { cliente_id, monto, fecha_pago, periodo_aplicar, observacion } = modalForm
    if (!cliente_id || !monto || !fecha_pago) return
    await supabase.from('creditos_cliente').insert({
      cliente_id: parseInt(cliente_id), monto: parseInt(monto),
      fecha_pago, periodo_aplicar: periodo_aplicar || null,
      observacion, aplicado: false, usuario_id: user?.id
    })
    setMsg({ type: 'success', text: 'Crédito registrado correctamente.' })
    setModal(null); cargar()
  }

  // ── Eliminar cobro ────────────────────────────────────────────────────────
  const eliminarCobro = async (id) => {
    if (!confirm('¿Eliminar este cobro? Esta acción no se puede deshacer.')) return
    try {
      const { data: pagosData } = await supabase.from('pagos').select('id').eq('cobro_id', id)
      const pagoIds = pagosData?.map(p=>p.id) || []
      if (pagoIds.length) await supabase.from('recibos').delete().in('pago_id', pagoIds)
      // Revertir créditos aplicados
      await supabase.from('creditos_cliente').update({ aplicado: false, cobro_id: null }).eq('cobro_id', id)
      await supabase.from('pagos').delete().eq('cobro_id', id)
      await supabase.from('cobro_detalles').delete().eq('cobro_id', id)
      await supabase.from('cobros').delete().eq('id', id)
      setMsg({ type: 'success', text: 'Cobro eliminado. Los créditos aplicados fueron restaurados.' })
      cargar()
    } catch { setMsg({ type: 'error', text: 'Error al eliminar el cobro.' }) }
  }

  const verPDF = (recibo) => {
    const cliente = recibo.clientes?.nombre_razon_social || ''
    const reciboConPeriodo = { ...recibo, periodo: recibo.cobros?.periodo || '' }
    const html = htmlRecibo(reciboConPeriodo, cliente, recibo.detalle || [])
    const w = window.open('','_blank'); w.document.write(html); w.document.close()
  }

  const cobrosFiltrados = cobros.filter(c => !filtroCliente || c.cliente_id === parseInt(filtroCliente))
  const getSaldo = (c) => Number(c.total) - (c.pagos?.reduce((s,p)=>s+Number(p.monto),0)||0)
  const getPagado = (c) => c.pagos?.reduce((s,p)=>s+Number(p.monto),0)||0

  // Créditos sin aplicar por cliente
  const saldoFavor = (clienteId) => creditos.filter(cr => cr.cliente_id === clienteId && !cr.aplicado).reduce((s,cr)=>s+Number(cr.monto),0)

  return (
    <div>
      {/* Banner períodos faltantes */}
      {!loading && faltantes.length > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <strong style={{ color: '#92400e' }}>⚠ Hay cobros pendientes de generar</strong>
            <div style={{ fontSize: 13, color: '#78350f', marginTop: 4 }}>
              {faltantes.map(f => `${f.cliente.nombre_razon_social}: ${f.periodos.map(p=>periodoLabel(p)).join(', ')}`).join(' — ')}
            </div>
          </div>
          {puedeGenerar && (
            <button className="btn btn-orange" onClick={generarFaltantes} disabled={generando}>
              {generando ? 'Generando...' : 'Generar todos'}
            </button>
          )}
        </div>
      )}

      <div className="cobro-cards">
        <div className="cobro-card"><div className="label">Total pendiente</div><div className="value red">{gs(stats.pendiente)} Gs.</div></div>
        <div className="cobro-card"><div className="label">Total pagado</div><div className="value green">{gs(stats.pagado)} Gs.</div></div>
        <div className="cobro-card"><div className="label">Parciales</div><div className="value orange">{gs(stats.parcial)} Gs.</div></div>
        <div className="cobro-card"><div className="label">Total del mes</div><div className="value blue">{gs(stats.mes)} Gs.</div></div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab==='pagos'?'active':''}`} onClick={()=>setTab('pagos')}>Pagos</button>
        <button className={`tab-btn ${tab==='recibos'?'active':''}`} onClick={()=>setTab('recibos')}>Recibos</button>
        <button className={`tab-btn ${tab==='creditos'?'active':''}`} onClick={()=>setTab('creditos')}>Créditos</button>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* ── Pagos ── */}
      {tab==='pagos' && (
        <>
          <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap', alignItems:'flex-end' }}>
            <div className="form-group" style={{ minWidth:220 }}>
              <label>Filtrar por cliente</label>
              <select value={filtroCliente} onChange={e=>setFiltroCliente(e.target.value)}>
                <option value="">Todos</option>
                {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre_razon_social}</option>)}
              </select>
            </div>
            {puedeRegistrar && <button className="btn btn-purple" onClick={abrirCredito}>+ Pago adelantado</button>}
          </div>

          <div className="table-container">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>N°</th><th>Cliente</th><th>Período</th><th>Total</th>
                    <th>Pagado</th><th>Saldo</th><th>S. Favor</th><th>Estado</th><th>Vencimiento</th>
                    {(puedeRegistrar||puedeEliminar)&&<th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? <tr><td colSpan={10} className="table-empty">Cargando...</td></tr>
                  : cobrosFiltrados.length===0 ? <tr><td colSpan={10} className="table-empty">Sin cobros generados.</td></tr>
                  : cobrosFiltrados.map(c=>{
                    const pagado=getPagado(c), saldo=getSaldo(c)
                    const sf=saldoFavor(c.cliente_id)
                    const venc=c.fecha_vencimiento&&new Date(c.fecha_vencimiento)<new Date()&&c.estado!=='pagado'
                    return (
                      <tr key={c.id} style={venc?{background:'#fff5f5'}:{}}>
                        <td>{c.id}</td>
                        <td style={{fontWeight:600}}>{c.clientes?.nombre_razon_social}</td>
                        <td>{periodoLabel(c.periodo)}</td>
                        <td>{gs(c.total)} Gs.</td>
                        <td>{gs(pagado)} Gs.</td>
                        <td style={{color:saldo>0?'var(--red)':'var(--green)',fontWeight:600}}>{gs(saldo)} Gs.</td>
                        <td style={{color:'var(--purple)',fontWeight:sf>0?600:400}}>{sf>0?gs(sf)+' Gs.':'-'}</td>
                        <td>
                          <span className={`badge badge-${c.estado==='pagado'?'green':c.estado==='parcial'?'orange':'red'}`}>
                            {c.estado==='pagado'?'Pagado':c.estado==='parcial'?'Parcial':'Pendiente'}
                          </span>
                          {venc&&<span className="badge badge-red" style={{marginLeft:4}}>Vencido</span>}
                        </td>
                        <td>{c.fecha_vencimiento?new Date(c.fecha_vencimiento+'T00:00:00').toLocaleDateString('es-PY'):'-'}</td>
                        {(puedeRegistrar||puedeEliminar)&&(
                          <td>
                            <div style={{display:'flex',gap:4}}>
                              {puedeRegistrar&&c.estado!=='pagado'&&<button className="btn btn-green btn-sm" onClick={()=>abrirPago(c)}>Registrar pago</button>}
                              {puedeEliminar&&<button className="btn btn-red btn-sm" onClick={()=>eliminarCobro(c.id)}>Eliminar</button>}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Recibos ── */}
      {tab==='recibos' && (
        <div className="table-container">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>N° Recibo</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Ver PDF</th></tr></thead>
              <tbody>
                {recibos.length===0 ? <tr><td colSpan={5} className="table-empty">Sin recibos generados.</td></tr>
                : recibos.map(r=>(
                  <tr key={r.id}>
                    <td style={{fontWeight:700}}>{String(r.numero||'').padStart(6,'0')}</td>
                    <td>{r.clientes?.nombre_razon_social}</td>
                    <td>{new Date((r.fecha||'')+'T00:00:00').toLocaleDateString('es-PY')}</td>
                    <td>{gs(r.total)} Gs.</td>
                    <td><button className="btn btn-blue btn-sm" onClick={()=>verPDF(r)}>Ver PDF</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Créditos ── */}
      {tab==='creditos' && (
        <>
          {puedeRegistrar && (
            <div style={{marginBottom:14}}>
              <button className="btn btn-purple" onClick={abrirCredito}>+ Registrar pago adelantado</button>
            </div>
          )}
          <div className="table-container">
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Cliente</th><th>Monto</th><th>Fecha pago</th><th>Período destino</th><th>Observación</th><th>Estado</th></tr></thead>
                <tbody>
                  {creditos.length===0 ? <tr><td colSpan={6} className="table-empty">Sin créditos registrados.</td></tr>
                  : creditos.map(cr=>(
                    <tr key={cr.id}>
                      <td style={{fontWeight:600}}>{cr.clientes?.nombre_razon_social}</td>
                      <td>{gs(cr.monto)} Gs.</td>
                      <td>{new Date(cr.fecha_pago+'T00:00:00').toLocaleDateString('es-PY')}</td>
                      <td>{cr.periodo_aplicar?periodoLabel(cr.periodo_aplicar):'Próximo cobro'}</td>
                      <td>{cr.observacion||'-'}</td>
                      <td><span className={`badge badge-${cr.aplicado?'green':'orange'}`}>{cr.aplicado?'Aplicado':'Pendiente'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal pago */}
      {modal==='pago' && (
        <div className="modal-overlay"><div className="modal">
          <h3>Registrar pago</h3>
          <p style={{marginBottom:8,fontSize:14}}>Cliente: <strong>{modalForm.cobro?.clientes?.nombre_razon_social}</strong></p>
          <p style={{marginBottom:4,fontSize:14}}>Período: <strong>{periodoLabel(modalForm.cobro?.periodo)}</strong></p>
          <p style={{marginBottom:4,fontSize:14,color:'var(--red)'}}>Saldo pendiente: <strong>{gs(modalForm.saldo)} Gs.</strong></p>
          <div className="form-group" style={{marginBottom:14}}>
            <label>Fecha del pago *</label>
            <input type="date" value={modalForm.fecha_pago} onChange={e=>setModalForm({...modalForm,fecha_pago:e.target.value})} />
          </div>
          <div className="form-group" style={{marginBottom:14}}>
            <label>Tipo de pago *</label>
            <select value={modalForm.tipo} onChange={e=>setModalForm({...modalForm,tipo:e.target.value,monto:e.target.value==='completo'?modalForm.saldo:modalForm.monto})}>
              <option value="completo">Pago completo</option>
              <option value="parcial">Pago parcial</option>
            </select>
          </div>
          <div className="form-group" style={{marginBottom:20}}>
            <label>Monto (Gs.) *</label>
            <input type="number" min="1" value={modalForm.monto} onChange={e=>setModalForm({...modalForm,monto:e.target.value})} readOnly={modalForm.tipo==='completo'} />
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={()=>setModal(null)}>Cancelar</button>
            <button className="btn btn-green" onClick={registrarPago}>Confirmar pago</button>
          </div>
        </div></div>
      )}

      {/* Modal crédito */}
      {modal==='credito' && (
        <div className="modal-overlay"><div className="modal">
          <h3>Registrar pago adelantado</h3>
          <p style={{marginBottom:16,fontSize:13,color:'var(--text-secondary)'}}>Este pago queda como crédito a favor del cliente y se descuenta automáticamente cuando se genere el cobro del período indicado.</p>
          <div className="form-group" style={{marginBottom:14}}>
            <label>Cliente *</label>
            <select value={modalForm.cliente_id} onChange={e=>setModalForm({...modalForm,cliente_id:e.target.value})}>
              <option value="">Seleccionar...</option>
              {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre_razon_social}</option>)}
            </select>
          </div>
          <div className="form-group" style={{marginBottom:14}}>
            <label>Monto (Gs.) *</label>
            <input type="number" min="1" value={modalForm.monto} onChange={e=>setModalForm({...modalForm,monto:e.target.value})} />
          </div>
          <div className="form-group" style={{marginBottom:14}}>
            <label>Fecha del pago *</label>
            <input type="date" value={modalForm.fecha_pago} onChange={e=>setModalForm({...modalForm,fecha_pago:e.target.value})} />
          </div>
          <div className="form-group" style={{marginBottom:14}}>
            <label>Período destino (opcional)</label>
            <input type="month" value={modalForm.periodo_aplicar} onChange={e=>setModalForm({...modalForm,periodo_aplicar:e.target.value})} placeholder="Dejar vacío = próximo cobro" />
          </div>
          <div className="form-group" style={{marginBottom:20}}>
            <label>Observación</label>
            <input value={modalForm.observacion} onChange={e=>setModalForm({...modalForm,observacion:e.target.value})} placeholder="Ej: pago adelantado acuerdo verbal" />
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={()=>setModal(null)}>Cancelar</button>
            <button className="btn btn-purple" onClick={registrarCredito}>Guardar crédito</button>
          </div>
        </div></div>
      )}
    </div>
  )
}
