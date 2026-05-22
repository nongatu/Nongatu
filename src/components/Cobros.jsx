import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { gs, periodoLabel } from '../utils/helpers'

const _u=['','Un','Dos','Tres','Cuatro','Cinco','Seis','Siete','Ocho','Nueve','Diez','Once','Doce','Trece','Catorce','Quince','Dieciséis','Diecisiete','Dieciocho','Diecinueve']
const _d=['','','Veinte','Treinta','Cuarenta','Cincuenta','Sesenta','Setenta','Ochenta','Noventa']
const _c=['','Cien','Doscientos','Trescientos','Cuatrocientos','Quinientos','Seiscientos','Setecientos','Ochocientos','Novecientos']
function _w(n){if(!n)return '';if(n<20)return _u[n];if(n<100){const r=n%10;return _d[Math.floor(n/10)]+(r?' y '+_u[r].toLowerCase():'')}if(n<1000){const r=n%100;return(n===100?'Cien':_c[Math.floor(n/100)])+(r?' '+_w(r).toLowerCase():'')}if(n<1000000){const m=Math.floor(n/1000),r=n%1000;return(m===1?'Mil':_w(m)+' Mil')+(r?' '+_w(r).toLowerCase():'')}const m=Math.floor(n/1000000),r=n%1000000;return(m===1?'Un Millón':_w(m)+' Millones')+(r?' '+_w(r).toLowerCase():'')}
const enLetras=n=>{const v=Math.round(Number(n)||0);return(v===0?'Cero':_w(v))+' Guaraníes'}

function periodoActual(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}

// ── HTML Recibo (1 por período, con detalle de pagos) ─────────────────────────
function htmlRecibo(recibo, cliente, detalle, pagos=[]) {
  const filas=(detalle||[]).filter(d=>d.cantidad>0).map(d=>
    `<tr><td>${d.categorias?.nombre||''}</td><td style="text-align:center">${d.cantidad}</td><td style="text-align:right">${gs(d.precio_unitario||0)}</td><td style="text-align:right">${gs(d.subtotal||0)}</td></tr>`
  ).join('')

  const totalCobro = (detalle||[]).filter(d=>d.cantidad>0).reduce((s,d)=>s+Number(d.subtotal||0),0)
  const totalPagado = pagos.reduce((s,p)=>s+Number(p.monto),0)
  const saldo = totalCobro - totalPagado

  const filasPagos = pagos.map(p=>{
    const fecha = p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString('es-PY') : '-'
    const medio = p.medio_pago==='transferencia'?'Transferencia bancaria':'Efectivo'
    const tipo = p.tipo==='credito_adelantado'?'Pago adelantado':'Pago directo'
    return `<tr><td>${fecha}</td><td>${tipo}</td><td>${medio}</td><td style="text-align:right;font-weight:700">${gs(p.monto)} Gs.</td></tr>`
  }).join('')

  const seccionPagos = pagos.length>0 ? `
    <div style="margin-top:10px;font-weight:700;font-size:11px;text-transform:uppercase;border-top:1px solid #ccc;padding-top:8px;margin-bottom:4px">Pagos aplicados</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
      <thead><tr style="background:#f0f0f0">
        <th style="padding:3px 5px;font-size:10px;text-align:left;border:1px solid #ccc">Fecha</th>
        <th style="padding:3px 5px;font-size:10px;text-align:left;border:1px solid #ccc">Tipo</th>
        <th style="padding:3px 5px;font-size:10px;text-align:left;border:1px solid #ccc">Medio</th>
        <th style="padding:3px 5px;font-size:10px;text-align:right;border:1px solid #ccc">Monto</th>
      </tr></thead>
      <tbody>${filasPagos}</tbody>
    </table>
    <div style="text-align:right;font-size:12px;font-weight:700">TOTAL PAGADO: ${gs(totalPagado)} Gs.</div>
    ${saldo>0?`<div style="text-align:right;font-size:12px;color:#c00">SALDO PENDIENTE: ${gs(saldo)} Gs.</div>`:'<div style="text-align:right;font-size:12px;color:#060">CANCELADO TOTALMENTE</div>'}
  ` : ''

  const bloque=copia=>`<div class="recibo">
    <div class="header">
      <div class="empresa"><div class="nombre">QUERANDY S.A.</div><div>RUC: 80094734-7</div><div>Mcal. Estigarribia - Boquerón</div></div>
      <div class="nro-box"><div class="nro-label">RECIBO N°</div><div class="nro">${String(recibo.numero||'').padStart(6,'0')}</div><div class="total-box">${gs(totalPagado)} Gs.</div></div>
    </div>
    <div class="linea"></div>
    <table class="datos">
      <tr><td class="lbl">Fecha:</td><td>${new Date((recibo.fecha||'')+'T00:00:00').toLocaleDateString('es-PY')}</td></tr>
      <tr><td class="lbl">Recibimos de:</td><td>${cliente}</td></tr>
      <tr><td class="lbl">Importe en letras:</td><td>${enLetras(totalPagado)}</td></tr>
      <tr><td class="lbl">Concepto:</td><td>Alquiler de Pastura - ${periodoLabel(recibo.periodo||'')}</td></tr>
    </table>
    <table class="detalle">
      <thead><tr><th>Categoría</th><th>Cant.</th><th>Precio</th><th>Total período</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <div style="text-align:right;font-weight:700;font-size:12px;border-top:1px solid #000;padding-top:4px;margin-bottom:10px">TOTAL DEL PERÍODO: ${gs(totalCobro)} Gs.</div>
    ${seccionPagos}
    <div class="firma">Firma</div>
    <div class="copia">${copia}</div>
  </div>`

  return`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Recibo ${periodoLabel(recibo.periodo||'')}</title><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:12px;padding:10px}
    .recibo{width:100%;max-width:680px;margin:0 auto 20px;border:1px solid #999;padding:14px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}
    .empresa .nombre{font-size:16px;font-weight:700;margin-bottom:2px}
    .nro-box{text-align:right;min-width:180px}
    .nro-label{font-size:10px;font-weight:700;text-transform:uppercase}
    .nro{font-size:22px;font-weight:700}
    .total-box{font-size:15px;font-weight:700;border:2px solid #000;padding:4px 8px;margin-top:4px;text-align:center}
    .linea{border-top:1px solid #999;margin:8px 0}
    .datos{width:100%;margin-bottom:10px}
    .datos td{padding:2px 4px;vertical-align:top}
    .datos .lbl{font-weight:700;white-space:nowrap;width:140px}
    .detalle{width:100%;border-collapse:collapse;margin-bottom:8px}
    .detalle th,.detalle td{border:1px solid #ccc;padding:4px 6px;font-size:11px}
    .detalle th{background:#f0f0f0;font-weight:700}
    .firma{text-align:right;border-top:1px solid #000;width:200px;margin-left:auto;padding-top:2px;font-size:11px;margin-top:16px}
    .copia{text-align:right;font-size:10px;font-weight:700;margin-top:6px;color:#555}
    @media print{.recibo{page-break-inside:avoid}}
  </style></head><body>
    ${bloque('ORIGINAL: CLIENTE')}
    ${bloque('COPIA: CONTABILIDAD')}
    <script>window.onload=()=>{window.print()}<\/script>
  </body></html>`
}

function calcularCobro(animalesCli, periodo, bajasCli) {
  const [year, month] = periodo.split('-').map(Number)
  const inicioPeriodo = new Date(year, month - 1, 1)
  const finPeriodo = new Date(year, month, 0)

  // Base: animales activos que ingresaron antes del fin del período
  const aptos = animalesCli.filter(a => {
    if (a.estado !== 'activo') return false
    if (!a.categorias?.cobrable) return false
    if (new Date(a.fecha_ingreso+'T00:00:00') > finPeriodo) return false
    if (a.fecha_inicio_cobro) {
      if (periodo < a.fecha_inicio_cobro.substring(0, 7)) return false
    }
    return true
  })

  const detalles = {}
  aptos.forEach(a => {
    const cid = a.categoria_id
    if (!detalles[cid]) detalles[cid] = { categoria_id: cid, nombre: a.categorias?.nombre||'', cantidad: 0, precio_unitario: Number(a.precio) }
    detalles[cid].cantidad += a.cantidad
  })

  // Reconstrucción histórica: sumar bajas que ocurrieron durante o después de este período.
  // El animal se cobra hasta el mes en que murió, inclusive.
  ;(bajasCli||[]).forEach(m => {
    const fechaBaja = new Date(m.fecha)
    if (fechaBaja < inicioPeriodo) return  // murió antes de este período → no se cobra
    // Verificar que el animal ingresó antes del fin del período
    const animal = animalesCli.find(a => a.id === m.animal_id)
    if (!animal) return
    if (!animal.categorias?.cobrable) return
    if (new Date(animal.fecha_ingreso+'T00:00:00') > finPeriodo) return
    if (animal.fecha_inicio_cobro && periodo < animal.fecha_inicio_cobro.substring(0, 7)) return
    const cid = m.categoria_anterior_id
    const precio = Number(m.precio_nuevo ?? animal.precio)
    if (!detalles[cid]) detalles[cid] = { categoria_id: cid, nombre: animal.categorias?.nombre||'', cantidad: 0, precio_unitario: precio }
    detalles[cid].cantidad += m.cantidad
  })

  const det = Object.values(detalles).filter(d => d.cantidad > 0).map(d => ({ ...d, subtotal: d.cantidad * d.precio_unitario }))
  const total = det.reduce((s,d) => s+d.subtotal, 0)
  if (total === 0) return null
  const iva = Math.round(total / 11)
  const gravada = total - iva
  return { det, total, iva, gravada }
}

function calcularPeriodosFaltantes(animales, cobros, clientes, bajas) {
  const hoy = new Date()
  const resultado = []
  for (const cliente of clientes) {
    // Solo activos para determinar si el cliente tiene animales y la fecha mínima
    const activosCli = animales.filter(a => a.cliente_id === cliente.id && a.estado === 'activo')
    if (!activosCli.length) continue
    const todosAnimalesCli = animales.filter(a => a.cliente_id === cliente.id)
    const bajasCli = (bajas||[]).filter(m => m.cliente_id === cliente.id)
    const minFecha = new Date(Math.min(...activosCli.map(a => new Date(a.fecha_ingreso+'T00:00:00'))))
    const primerAno = minFecha.getMonth()===11 ? minFecha.getFullYear()+1 : minFecha.getFullYear()
    const primerMes = (minFecha.getMonth()+1) % 12
    const cobrosSet = new Set(cobros.filter(c=>c.cliente_id===cliente.id).map(c=>c.periodo))
    const faltantes = []
    const cur = new Date(primerAno, primerMes, 1)
    const limite = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    while (cur <= limite) {
      const p = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`
      if (!cobrosSet.has(p)) {
        const calc = calcularCobro(todosAnimalesCli, p, bajasCli)
        if (calc) faltantes.push(p)
      }
      cur.setMonth(cur.getMonth()+1)
    }
    if (faltantes.length) resultado.push({ cliente, periodos: faltantes })
  }
  return resultado
}

export default function Cobros({ user }) {
  const [tab, setTab] = useState('pagos')
  const [cobros, setCobros] = useState([])
  const [recibos, setRecibos] = useState([])
  const [clientes, setClientes] = useState([])
  const [animales, setAnimales] = useState([])
  const [creditos, setCreditos] = useState([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [modal, setModal] = useState(null)
  const [modalForm, setModalForm] = useState({})
  const [msg, setMsg] = useState(null)
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroRecibosCliente, setFiltroRecibosCliente] = useState('')
  const [filtroRecibosDesde, setFiltroRecibosDesde] = useState('')
  const [filtroRecibosHasta, setFiltroRecibosHasta] = useState('')
  const [filtroCreditosCliente, setFiltroCreditosCliente] = useState('')
  const [filtroCreditosDesde, setFiltroCreditosDesde] = useState('')
  const [filtroCreditosHasta, setFiltroCreditosHasta] = useState('')
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [movimientos, setMovimientos] = useState([])

  const perms = user?.rol==='Administrador'?{todo:true}:(user?.permisos||{})
  const puedeGenerar = perms.todo||perms.generar_cobros
  const puedeRegistrar = perms.todo||perms.registrar_pagos
  const puedeEliminar = perms.todo||perms.eliminar_anular

  useEffect(()=>{
    Promise.all([
      supabase.from('clientes').select('id,nombre_razon_social,ruc').order('nombre_razon_social'),
      supabase.from('animales').select('id,cliente_id,categoria_id,cantidad,fecha_ingreso,precio,fecha_inicio_cobro,estado,categorias(nombre,cobrable)').in('estado',['activo','baja']),
      supabase.from('movimientos').select('animal_id,cliente_id,tipo,categoria_anterior_id,cantidad,precio_nuevo,fecha').eq('tipo','baja'),
    ]).then(([{data:cl},{data:an},{data:mv}])=>{ setClientes(cl||[]); setAnimales(an||[]); setMovimientos(mv||[]) })
    cargar()
  },[])

  const cargar = async () => {
    setLoading(true)
    const [{data:cb},{data:rc},{data:cr}] = await Promise.all([
      supabase.from('cobros').select('*, clientes(nombre_razon_social), pagos(id,monto,tipo,fecha_pago,medio_pago)').order('periodo').order('cliente_id'),
      supabase.from('recibos').select('*, clientes(nombre_razon_social), cobros(periodo)').order('created_at',{ascending:false}),
      supabase.from('creditos_cliente').select('*, clientes(nombre_razon_social), cobros(periodo)').order('fecha_pago',{ascending:false}),
    ])
    setCobros(cb||[]); setRecibos(rc||[]); setCreditos(cr||[])
    setLoading(false)
  }

  const faltantes = calcularPeriodosFaltantes(animales, cobros, clientes, movimientos)

  const stats = {
    pendiente: cobros.filter(c=>c.estado==='pendiente').reduce((s,c)=>s+Number(c.total),0),
    pagado: cobros.filter(c=>c.estado==='pagado').reduce((s,c)=>s+Number(c.total),0),
    parcial: cobros.filter(c=>c.estado==='parcial').reduce((s,c)=>s+Number(c.total),0),
    mes: cobros.filter(c=>c.periodo===periodoActual()).reduce((s,c)=>s+Number(c.total),0),
  }

  const generarFaltantes = async () => {
    if (!puedeGenerar||!faltantes.length) return
    setProcesando(true); setMsg(null)
    let total = 0
    for (const {cliente, periodos} of faltantes) {
      const animalesCli = animales.filter(a=>a.cliente_id===cliente.id)
      const bajasCli = movimientos.filter(m=>m.cliente_id===cliente.id)
      for (const periodo of periodos) {
        const calc = calcularCobro(animalesCli, periodo, bajasCli)
        if (!calc) continue
        const [year,month] = periodo.split('-').map(Number)
        const venc = new Date(year,month,10)
        const {data:cobro} = await supabase.from('cobros').insert({
          cliente_id:cliente.id, periodo,
          fecha_generacion:new Date().toISOString().split('T')[0],
          fecha_vencimiento:venc.toISOString().split('T')[0],
          gravada:calc.gravada, iva:calc.iva, total:calc.total, estado:'pendiente'
        }).select().single()
        if (!cobro) continue
        await supabase.from('cobro_detalles').insert(calc.det.map(d=>({
          cobro_id:cobro.id, categoria_id:d.categoria_id,
          cantidad:d.cantidad, precio_unitario:d.precio_unitario, subtotal:d.subtotal
        })))
        total++
      }
    }
    await aplicarCreditosFIFO()
    setMsg({type:'success',text:`Se generaron ${total} cobros. Créditos aplicados.`})
    await cargar(); setProcesando(false)
  }

  const recalcularTodos = async () => {
    if (!puedeGenerar) return
    if (!confirm('Elimina todos los cobros y los recrea. Los créditos se reaplicarán. ¿Continuás?')) return
    setProcesando(true); setMsg(null)
    const {data:todosLosCobros} = await supabase.from('cobros').select('id')
    for (const c of todosLosCobros||[]) {
      const {data:pagosD} = await supabase.from('pagos').select('id').eq('cobro_id',c.id)
      const pids = pagosD?.map(p=>p.id)||[]
      if (pids.length) await supabase.from('recibos').delete().in('pago_id',pids)
      await supabase.from('recibos').delete().eq('cobro_id',c.id)
      await supabase.from('pagos').delete().eq('cobro_id',c.id)
      await supabase.from('cobro_detalles').delete().eq('cobro_id',c.id)
    }
    await supabase.from('cobros').delete().neq('id',0)
    await supabase.from('creditos_cliente').update({aplicado:false,cobro_id:null}).neq('id',0)
    let total = 0
    for (const cliente of clientes) {
      const animalesCli = animales.filter(a=>a.cliente_id===cliente.id)
      const activosCli = animalesCli.filter(a=>a.estado==='activo')
      if (!activosCli.length) continue
      const bajasCli = movimientos.filter(m=>m.cliente_id===cliente.id)
      const minFecha = new Date(Math.min(...activosCli.map(a=>new Date(a.fecha_ingreso+'T00:00:00'))))
      const primerAno = minFecha.getMonth()===11?minFecha.getFullYear()+1:minFecha.getFullYear()
      const primerMes = (minFecha.getMonth()+1)%12
      const hoy = new Date()
      const cur = new Date(primerAno,primerMes,1)
      const limite = new Date(hoy.getFullYear(),hoy.getMonth(),1)
      while (cur<=limite) {
        const periodo = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`
        const calc = calcularCobro(animalesCli, periodo, bajasCli)
        if (calc) {
          const [y,m] = periodo.split('-').map(Number)
          const venc = new Date(y,m,10)
          const {data:cobro} = await supabase.from('cobros').insert({
            cliente_id:cliente.id, periodo,
            fecha_generacion:new Date().toISOString().split('T')[0],
            fecha_vencimiento:venc.toISOString().split('T')[0],
            gravada:calc.gravada, iva:calc.iva, total:calc.total, estado:'pendiente'
          }).select().single()
          if (cobro) {
            await supabase.from('cobro_detalles').insert(calc.det.map(d=>({
              cobro_id:cobro.id,categoria_id:d.categoria_id,
              cantidad:d.cantidad,precio_unitario:d.precio_unitario,subtotal:d.subtotal
            })))
            total++
          }
        }
        cur.setMonth(cur.getMonth()+1)
      }
    }
    await aplicarCreditosFIFO()
    await generarRecibosConsolidados()
    setMsg({type:'success',text:`Recalculado: ${total} cobros. Créditos y recibos regenerados.`})
    await cargar(); setProcesando(false)
  }

  // ── FIFO: solo crea pagos, NO crea recibos ────────────────────────────────
  const aplicarCreditosFIFO = async () => {
    const {data:cobrosActuales} = await supabase.from('cobros').select('*, pagos(monto)').order('periodo').order('cliente_id')
    const {data:creditosActuales} = await supabase.from('creditos_cliente').select('*').eq('aplicado',false).order('fecha_pago')
    const creditosPorCliente = {}
    ;(creditosActuales||[]).forEach(cr => {
      if (!creditosPorCliente[cr.cliente_id]) creditosPorCliente[cr.cliente_id] = []
      creditosPorCliente[cr.cliente_id].push({...cr, restante: Number(cr.monto)})
    })
    for (const cobro of (cobrosActuales||[])) {
      const pagado = cobro.pagos?.reduce((s,p)=>s+Number(p.monto),0)||0
      let saldo = Number(cobro.total)-pagado
      if (saldo<=0) continue
      const crs = creditosPorCliente[cobro.cliente_id]||[]
      for (const cr of crs) {
        if (cr.restante<=0) continue
        if (cr.periodo_aplicar && cr.periodo_aplicar > cobro.periodo) continue
        const aplicar = Math.min(cr.restante, saldo)
        const {data:pago} = await supabase.from('pagos').insert({
          cobro_id:cobro.id, monto:aplicar, tipo:'credito_adelantado',
          medio_pago:'efectivo',
          fecha_pago:cr.fecha_pago+'T00:00:00', usuario_id:cr.usuario_id
        }).select().single()
        if (pago) {
          cr.restante -= aplicar
          saldo -= aplicar
          if (cr.restante===0) {
            await supabase.from('creditos_cliente').update({aplicado:true,cobro_id:cobro.id}).eq('id',cr.id)
          }
        }
        if (saldo<=0) break
      }
      const estado = saldo<=0?'pagado':saldo<Number(cobro.total)?'parcial':'pendiente'
      await supabase.from('cobros').update({estado}).eq('id',cobro.id)
    }
  }

  // ── Generar 1 recibo por período ──────────────────────────────────────────
  const generarRecibosConsolidados = async () => {
    const {data:cobrosData} = await supabase.from('cobros')
      .select('id, cliente_id, periodo, total, pagos(id,monto,tipo,fecha_pago,medio_pago), cobro_detalles(*,categorias(nombre))')
      .order('periodo')
    if (!cobrosData?.length) return
    // Borrar recibos existentes
    const cobroIds = cobrosData.map(c=>c.id)
    await supabase.from('recibos').delete().in('cobro_id', cobroIds)
    let nro = 1
    for (const cobro of cobrosData) {
      const totalPagado = cobro.pagos?.reduce((s,p)=>s+Number(p.monto),0)||0
      if (totalPagado===0) continue
      const ultimoPago = cobro.pagos?.sort((a,b)=>new Date(a.fecha_pago)-new Date(b.fecha_pago)).slice(-1)[0]
      await supabase.from('recibos').insert({
        pago_id: ultimoPago?.id || null,
        cobro_id: cobro.id,
        numero: String(nro++).padStart(6,'0'),
        fecha: new Date().toISOString().split('T')[0],
        cliente_id: cobro.cliente_id,
        total: totalPagado,
        detalle: cobro.cobro_detalles
      })
    }
  }

  const aplicarYGenerarRecibos = async () => {
    setProcesando(true); setMsg(null)
    await aplicarCreditosFIFO()
    await generarRecibosConsolidados()
    setMsg({type:'success',text:'Créditos aplicados y recibos generados (1 por período).'})
    await cargar(); setProcesando(false)
  }

  const abrirPago = cobro => {
    const pagado = cobro.pagos?.reduce((s,p)=>s+Number(p.monto),0)||0
    const saldo = Number(cobro.total)-pagado
    setModalForm({cobro,saldo,pagado,monto:saldo,tipo:'completo',medio_pago:'efectivo',fecha_pago:new Date().toISOString().split('T')[0]})
    setModal('pago')
  }

  const registrarPago = async () => {
    const {cobro,monto,tipo,saldo,fecha_pago,medio_pago} = modalForm
    if (!monto||Number(monto)<=0) return
    const montoNum = Number(monto)
    const {data:pago,error:pe} = await supabase.from('pagos').insert({
      cobro_id:cobro.id, monto:montoNum, tipo,
      medio_pago:medio_pago||'efectivo',
      fecha_pago:fecha_pago+'T00:00:00', usuario_id:user?.id
    }).select().single()
    if (pe) return setMsg({type:'error',text:'Error al registrar el pago.'})
    const nuevoEstado = montoNum>=saldo?'pagado':'parcial'
    await supabase.from('cobros').update({estado:nuevoEstado}).eq('id',cobro.id)
    // Regenerar recibo consolidado para este cobro
    const {data:det2} = await supabase.from('cobro_detalles').select('*,categorias(nombre)').eq('cobro_id',cobro.id)
    const {data:pagosActuales} = await supabase.from('pagos').select('id,monto,tipo,fecha_pago,medio_pago').eq('cobro_id',cobro.id)
    const totalPagado = pagosActuales?.reduce((s,p)=>s+Number(p.monto),0)||0
    // Borrar recibo anterior del período
    await supabase.from('recibos').delete().eq('cobro_id',cobro.id)
    const {data:recActuales} = await supabase.from('recibos').select('id').order('id',{ascending:false}).limit(1)
    const maxNro = recActuales?.[0]?.id||0
    const nroR = String(maxNro+1).padStart(6,'0')
    await supabase.from('recibos').insert({
      pago_id:pago.id, cobro_id:cobro.id, numero:nroR,
      fecha:fecha_pago, cliente_id:cobro.cliente_id, total:totalPagado, detalle:det2
    })
    setModal(null); cargar()
  }

  const abrirCredito = () => {
    setModalForm({cliente_id:'',monto:'',fecha_pago:new Date().toISOString().split('T')[0],periodo_aplicar:'',observacion:''})
    setModal('credito')
  }

  const registrarCredito = async () => {
    const {cliente_id,monto,fecha_pago,periodo_aplicar,observacion} = modalForm
    if (!cliente_id||!monto||!fecha_pago) return setMsg({type:'error',text:'Completá cliente, monto y fecha.'})
    const {error} = await supabase.from('creditos_cliente').insert({
      cliente_id:parseInt(cliente_id), monto:parseInt(monto),
      fecha_pago, periodo_aplicar:periodo_aplicar||null,
      observacion, aplicado:false, usuario_id:user?.id
    })
    if (error) return setMsg({type:'error',text:`Error: ${error.message}`})
    setMsg({type:'success',text:'Pago adelantado registrado.'})
    setModal(null); cargar()
  }

  const eliminarCobro = async id => {
    if (!confirm('¿Eliminar este cobro? Los créditos aplicados se restaurarán.')) return
    try {
      const {data:pd} = await supabase.from('pagos').select('id').eq('cobro_id',id)
      const pids = pd?.map(p=>p.id)||[]
      if (pids.length) await supabase.from('recibos').delete().in('pago_id',pids)
      await supabase.from('recibos').delete().eq('cobro_id',id)
      await supabase.from('creditos_cliente').update({aplicado:false,cobro_id:null}).eq('cobro_id',id)
      await supabase.from('pagos').delete().eq('cobro_id',id)
      await supabase.from('cobro_detalles').delete().eq('cobro_id',id)
      await supabase.from('cobros').delete().eq('id',id)
      setMsg({type:'success',text:'Cobro eliminado.'})
      cargar()
    } catch { setMsg({type:'error',text:'Error al eliminar.'}) }
  }

  const eliminarSeleccionados = async () => {
    if (!seleccionados.size) return
    if (!confirm(`¿Eliminar ${seleccionados.size} cobro(s) seleccionado(s)? Los créditos aplicados se restaurarán.`)) return
    setProcesando(true); setMsg(null)
    try {
      for (const id of seleccionados) {
        const {data:pd} = await supabase.from('pagos').select('id').eq('cobro_id',id)
        const pids = pd?.map(p=>p.id)||[]
        if (pids.length) await supabase.from('recibos').delete().in('pago_id',pids)
        await supabase.from('recibos').delete().eq('cobro_id',id)
        await supabase.from('creditos_cliente').update({aplicado:false,cobro_id:null}).eq('cobro_id',id)
        await supabase.from('pagos').delete().eq('cobro_id',id)
        await supabase.from('cobro_detalles').delete().eq('cobro_id',id)
        await supabase.from('cobros').delete().eq('id',id)
      }
      setSeleccionados(new Set())
      setMsg({type:'success',text:`${seleccionados.size} cobro(s) eliminado(s).`})
      cargar()
    } catch { setMsg({type:'error',text:'Error al eliminar.'}) }
    setProcesando(false)
  }

  const eliminarRecibo = async id => {
    if (!confirm('¿Eliminar este recibo?')) return
    await supabase.from('recibos').delete().eq('id',id)
    setMsg({type:'success',text:'Recibo eliminado.'})
    cargar()
  }

  const eliminarCredito = async id => {
    if (!confirm('¿Eliminar este pago adelantado?')) return
    await supabase.from('creditos_cliente').delete().eq('id',id)
    setMsg({type:'success',text:'Crédito eliminado.'})
    cargar()
  }

  const verPDF = async r => {
    const {data:pagosData} = await supabase.from('pagos')
      .select('monto,tipo,fecha_pago,medio_pago')
      .eq('cobro_id', r.cobro_id)
      .order('fecha_pago')
    const w = window.open('','_blank')
    w.document.write(htmlRecibo({...r,periodo:r.cobros?.periodo||''},r.clientes?.nombre_razon_social||'',r.detalle||[],pagosData||[]))
    w.document.close()
  }

  const cobrosFiltrados = cobros.filter(c=>!filtroCliente||c.cliente_id===parseInt(filtroCliente))
  const getPagado = c => c.pagos?.reduce((s,p)=>s+Number(p.monto),0)||0
  const getSaldo = c => Number(c.total)-getPagado(c)
  const getCreditoAplicado = c => c.pagos?.filter(p=>p.tipo==='credito_adelantado').reduce((s,p)=>s+Number(p.monto),0)||0
  const fb = {display:'flex',gap:10,marginBottom:14,flexWrap:'wrap',alignItems:'flex-end'}

  const todosSeleccionados = cobrosFiltrados.length > 0 && cobrosFiltrados.every(c => seleccionados.has(c.id))
  const algunoSeleccionado = cobrosFiltrados.some(c => seleccionados.has(c.id))
  const toggleSeleccion = id => {
    const nuevo = new Set(seleccionados)
    nuevo.has(id) ? nuevo.delete(id) : nuevo.add(id)
    setSeleccionados(nuevo)
  }
  const toggleTodos = () => {
    if (todosSeleccionados) {
      const nuevo = new Set(seleccionados)
      cobrosFiltrados.forEach(c => nuevo.delete(c.id))
      setSeleccionados(nuevo)
    } else {
      const nuevo = new Set(seleccionados)
      cobrosFiltrados.forEach(c => nuevo.add(c.id))
      setSeleccionados(nuevo)
    }
  }

  return (
    <div>
      {!loading && faltantes.length>0 && (
        <div style={{background:'#fef3c7',border:'1px solid #f59e0b',borderRadius:10,padding:'14px 18px',marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
          <div>
            <strong style={{color:'#92400e'}}>⚠ Hay cobros pendientes de generar</strong>
            <div style={{fontSize:13,color:'#78350f',marginTop:4}}>{faltantes.map(f=>`${f.cliente.nombre_razon_social}: ${f.periodos.map(p=>periodoLabel(p)).join(', ')}`).join(' — ')}</div>
          </div>
          {puedeGenerar&&<button className="btn btn-orange" onClick={generarFaltantes} disabled={procesando}>{procesando?'Procesando...':'Generar pendientes'}</button>}
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

      {msg&&<div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* ── PAGOS ── */}
      {tab==='pagos'&&(
        <>
          <div style={{...fb, justifyContent:'space-between'}}>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
              <div className="form-group" style={{minWidth:220}}>
                <label>Filtrar por cliente</label>
                <select value={filtroCliente} onChange={e=>{setFiltroCliente(e.target.value);setSeleccionados(new Set())}}>
                  <option value="">Todos</option>
                  {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre_razon_social}</option>)}
                </select>
              </div>
              {puedeRegistrar&&<button className="btn btn-purple" onClick={abrirCredito}>+ Pago adelantado</button>}
              {puedeGenerar&&<button className="btn btn-blue btn-sm" onClick={aplicarYGenerarRecibos} disabled={procesando}>Aplicar créditos</button>}
              {puedeGenerar&&<button className="btn btn-red btn-sm" onClick={recalcularTodos} disabled={procesando}>Recalcular todos</button>}
            </div>
            {puedeEliminar&&(
              <button
                className="btn btn-red"
                onClick={eliminarSeleccionados}
                disabled={!algunoSeleccionado||procesando}
                style={{alignSelf:'flex-end',opacity:algunoSeleccionado?1:0.4}}
              >
                🗑 Eliminar seleccionados{algunoSeleccionado?` (${[...seleccionados].filter(id=>cobrosFiltrados.some(c=>c.id===id)).length})`:''}
              </button>
            )}
          </div>
          <div className="table-container"><div className="table-wrapper">
            <table>
              <thead><tr>
                {puedeEliminar&&(
                  <th style={{width:36,textAlign:'center'}}>
                    <input type="checkbox"
                      checked={todosSeleccionados}
                      ref={el=>{if(el) el.indeterminate=algunoSeleccionado&&!todosSeleccionados}}
                      onChange={toggleTodos}
                      style={{cursor:'pointer'}}
                    />
                  </th>
                )}
                <th>N°</th><th>Cliente</th><th>Período</th><th>Total</th><th>Pagado</th><th>Crédito</th><th>Saldo</th><th>Estado</th><th>Vencimiento</th>
                {puedeRegistrar&&<th>Acciones</th>}
              </tr></thead>
              <tbody>
                {loading?<tr><td colSpan={puedeEliminar?11:10} className="table-empty">Cargando...</td></tr>
                :cobrosFiltrados.length===0?<tr><td colSpan={puedeEliminar?11:10} className="table-empty">Sin cobros.</td></tr>
                :cobrosFiltrados.map(c=>{
                  const pagado=getPagado(c),saldo=getSaldo(c),cred=getCreditoAplicado(c)
                  const venc=c.fecha_vencimiento&&new Date(c.fecha_vencimiento)<new Date()&&c.estado!=='pagado'
                  const selec=seleccionados.has(c.id)
                  return (
                    <tr key={c.id} style={{background:selec?'#eff6ff':venc?'#fff5f5':'',cursor:'default'}}>
                      {puedeEliminar&&(
                        <td style={{textAlign:'center'}}>
                          <input type="checkbox" checked={selec} onChange={()=>toggleSeleccion(c.id)} style={{cursor:'pointer'}}/>
                        </td>
                      )}
                      <td>{c.id}</td>
                      <td style={{fontWeight:600}}>{c.clientes?.nombre_razon_social}</td>
                      <td>{periodoLabel(c.periodo)}</td>
                      <td>{gs(c.total)} Gs.</td>
                      <td>{gs(pagado)} Gs.</td>
                      <td style={{color:cred>0?'var(--purple)':'var(--text-secondary)',fontWeight:cred>0?600:400}}>{cred>0?gs(cred)+' Gs.':'-'}</td>
                      <td style={{color:saldo>0?'var(--red)':'var(--green)',fontWeight:600}}>{gs(saldo)} Gs.</td>
                      <td>
                        <span className={`badge badge-${c.estado==='pagado'?'green':c.estado==='parcial'?'orange':'red'}`}>
                          {c.estado==='pagado'?'Pagado':c.estado==='parcial'?'Parcial':'Pendiente'}
                        </span>
                        {venc&&<span className="badge badge-red" style={{marginLeft:4}}>Vencido</span>}
                      </td>
                      <td>{c.fecha_vencimiento?new Date(c.fecha_vencimiento+'T00:00:00').toLocaleDateString('es-PY'):'-'}</td>
                      {puedeRegistrar&&(
                        <td>
                          {c.estado!=='pagado'&&<button className="btn btn-green btn-sm" onClick={()=>abrirPago(c)}>Registrar pago</button>}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div></div>
        </>
      )}

      {/* ── RECIBOS ── */}
      {tab==='recibos'&&(
        <>
          <div style={fb}>
            <div className="form-group" style={{minWidth:200}}>
              <label>Cliente</label>
              <select value={filtroRecibosCliente} onChange={e=>setFiltroRecibosCliente(e.target.value)}>
                <option value="">Todos</option>
                {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre_razon_social}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Desde</label>
              <input type="date" value={filtroRecibosDesde} onChange={e=>setFiltroRecibosDesde(e.target.value)}/>
            </div>
            <div className="form-group">
              <label>Hasta</label>
              <input type="date" value={filtroRecibosHasta} onChange={e=>setFiltroRecibosHasta(e.target.value)}/>
            </div>
          </div>
          <div className="table-container"><div className="table-wrapper">
            <table>
              <thead><tr><th>N° Recibo</th><th>Cliente</th><th>Período</th><th>Fecha</th><th>Total pagado</th><th>Ver PDF</th><th>Eliminar</th></tr></thead>
              <tbody>
                {recibos.filter(r=>
                  (!filtroRecibosCliente||r.cliente_id===parseInt(filtroRecibosCliente))&&
                  (!filtroRecibosDesde||r.fecha>=filtroRecibosDesde)&&
                  (!filtroRecibosHasta||r.fecha<=filtroRecibosHasta)
                ).length===0
                  ?<tr><td colSpan={7} className="table-empty">Sin recibos. Usá "Aplicar créditos" para generarlos.</td></tr>
                  :recibos.filter(r=>
                    (!filtroRecibosCliente||r.cliente_id===parseInt(filtroRecibosCliente))&&
                    (!filtroRecibosDesde||r.fecha>=filtroRecibosDesde)&&
                    (!filtroRecibosHasta||r.fecha<=filtroRecibosHasta)
                  ).map(r=>(
                    <tr key={r.id}>
                      <td style={{fontWeight:700}}>{String(r.numero||'').padStart(6,'0')}</td>
                      <td>{r.clientes?.nombre_razon_social}</td>
                      <td>{periodoLabel(r.cobros?.periodo||'')}</td>
                      <td>{new Date((r.fecha||'')+'T00:00:00').toLocaleDateString('es-PY')}</td>
                      <td>{gs(r.total)} Gs.</td>
                      <td><button className="btn btn-blue btn-sm" onClick={()=>verPDF(r)}>Ver PDF</button></td>
                      <td>{puedeEliminar&&<button className="btn btn-red btn-sm" onClick={()=>eliminarRecibo(r.id)}>Eliminar</button>}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div></div>
        </>
      )}

      {/* ── CRÉDITOS ── */}
      {tab==='creditos'&&(
        <>
          <div style={fb}>
            <div className="form-group" style={{minWidth:200}}>
              <label>Cliente</label>
              <select value={filtroCreditosCliente} onChange={e=>setFiltroCreditosCliente(e.target.value)}>
                <option value="">Todos</option>
                {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre_razon_social}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Desde</label>
              <input type="date" value={filtroCreditosDesde} onChange={e=>setFiltroCreditosDesde(e.target.value)}/>
            </div>
            <div className="form-group">
              <label>Hasta</label>
              <input type="date" value={filtroCreditosHasta} onChange={e=>setFiltroCreditosHasta(e.target.value)}/>
            </div>
          </div>
          {puedeRegistrar&&<div style={{marginBottom:14}}><button className="btn btn-purple" onClick={abrirCredito}>+ Registrar pago adelantado</button></div>}
          <div className="table-container"><div className="table-wrapper">
            <table>
              <thead><tr><th>Cliente</th><th>Monto</th><th>Fecha pago</th><th>Período destino</th><th>Observación</th><th>Estado</th><th>Eliminar</th></tr></thead>
              <tbody>
                {creditos.filter(cr=>
                  (!filtroCreditosCliente||cr.cliente_id===parseInt(filtroCreditosCliente))&&
                  (!filtroCreditosDesde||cr.fecha_pago>=filtroCreditosDesde)&&
                  (!filtroCreditosHasta||cr.fecha_pago<=filtroCreditosHasta)
                ).length===0
                  ?<tr><td colSpan={7} className="table-empty">Sin créditos.</td></tr>
                  :creditos.filter(cr=>
                    (!filtroCreditosCliente||cr.cliente_id===parseInt(filtroCreditosCliente))&&
                    (!filtroCreditosDesde||cr.fecha_pago>=filtroCreditosDesde)&&
                    (!filtroCreditosHasta||cr.fecha_pago<=filtroCreditosHasta)
                  ).map(cr=>(
                    <tr key={cr.id}>
                      <td style={{fontWeight:600}}>{cr.clientes?.nombre_razon_social}</td>
                      <td>{gs(cr.monto)} Gs.</td>
                      <td>{new Date(cr.fecha_pago+'T00:00:00').toLocaleDateString('es-PY')}</td>
                      <td>{cr.aplicado?`Aplicado a ${periodoLabel(cr.cobros?.periodo||'')}`:cr.periodo_aplicar?periodoLabel(cr.periodo_aplicar):'Primer cobro pendiente'}</td>
                      <td>{cr.observacion||'-'}</td>
                      <td><span className={`badge badge-${cr.aplicado?'green':'orange'}`}>{cr.aplicado?'Aplicado':'Pendiente'}</span></td>
                      <td>{puedeEliminar&&!cr.aplicado&&<button className="btn btn-red btn-sm" onClick={()=>eliminarCredito(cr.id)}>Eliminar</button>}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div></div>
        </>
      )}

      {/* ── MODAL PAGO ── */}
      {modal==='pago'&&(
        <div className="modal-overlay"><div className="modal">
          <h3>Registrar pago</h3>
          <p style={{marginBottom:8,fontSize:14}}>Cliente: <strong>{modalForm.cobro?.clientes?.nombre_razon_social}</strong></p>
          <p style={{marginBottom:4,fontSize:14}}>Período: <strong>{periodoLabel(modalForm.cobro?.periodo)}</strong></p>
          <p style={{marginBottom:16,fontSize:14,color:'var(--red)'}}>Saldo: <strong>{gs(modalForm.saldo)} Gs.</strong></p>
          <div className="form-group" style={{marginBottom:14}}>
            <label>Fecha del pago *</label>
            <input type="date" value={modalForm.fecha_pago} onChange={e=>setModalForm({...modalForm,fecha_pago:e.target.value})}/>
          </div>
          <div className="form-group" style={{marginBottom:14}}>
            <label>Medio de pago *</label>
            <select value={modalForm.medio_pago||'efectivo'} onChange={e=>setModalForm({...modalForm,medio_pago:e.target.value})}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia bancaria</option>
            </select>
          </div>
          <div className="form-group" style={{marginBottom:14}}>
            <label>Tipo *</label>
            <select value={modalForm.tipo} onChange={e=>setModalForm({...modalForm,tipo:e.target.value,monto:e.target.value==='completo'?modalForm.saldo:modalForm.monto})}>
              <option value="completo">Pago completo</option>
              <option value="parcial">Pago parcial</option>
            </select>
          </div>
          <div className="form-group" style={{marginBottom:20}}>
            <label>Monto (Gs.) *</label>
            <input type="number" min="1" value={modalForm.monto} onChange={e=>setModalForm({...modalForm,monto:e.target.value})} readOnly={modalForm.tipo==='completo'}/>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={()=>setModal(null)}>Cancelar</button>
            <button className="btn btn-green" onClick={registrarPago}>Confirmar pago</button>
          </div>
        </div></div>
      )}

      {/* ── MODAL CRÉDITO ── */}
      {modal==='credito'&&(
        <div className="modal-overlay"><div className="modal">
          <h3>Registrar pago adelantado</h3>
          <p style={{marginBottom:16,fontSize:13,color:'var(--text-secondary)'}}>Se registra como crédito a favor del cliente. Se aplica al cobro del período indicado o al primer cobro pendiente.</p>
          <div className="form-group" style={{marginBottom:14}}>
            <label>Cliente *</label>
            <select value={modalForm.cliente_id} onChange={e=>setModalForm({...modalForm,cliente_id:e.target.value})}>
              <option value="">Seleccionar...</option>
              {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre_razon_social}</option>)}
            </select>
          </div>
          <div className="form-group" style={{marginBottom:14}}>
            <label>Monto (Gs.) *</label>
            <input type="number" min="1" value={modalForm.monto} onChange={e=>setModalForm({...modalForm,monto:e.target.value})}/>
          </div>
          <div className="form-group" style={{marginBottom:14}}>
            <label>Fecha del pago *</label>
            <input type="date" value={modalForm.fecha_pago} onChange={e=>setModalForm({...modalForm,fecha_pago:e.target.value})}/>
          </div>
          <div className="form-group" style={{marginBottom:14}}>
            <label>Período destino (opcional)</label>
            <input type="month" value={modalForm.periodo_aplicar} onChange={e=>setModalForm({...modalForm,periodo_aplicar:e.target.value})}/>
          </div>
          <div className="form-group" style={{marginBottom:20}}>
            <label>Observación</label>
            <input value={modalForm.observacion} onChange={e=>setModalForm({...modalForm,observacion:e.target.value})} placeholder="Ej: pago adelantado octubre 2025"/>
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
