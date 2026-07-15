import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { gs, periodoLabel } from '../utils/helpers'

const _u=['','Un','Dos','Tres','Cuatro','Cinco','Seis','Siete','Ocho','Nueve','Diez','Once','Doce','Trece','Catorce','Quince','Dieciséis','Diecisiete','Dieciocho','Diecinueve']
const _d=['','','Veinte','Treinta','Cuarenta','Cincuenta','Sesenta','Setenta','Ochenta','Noventa']
const _c=['','Cien','Doscientos','Trescientos','Cuatrocientos','Quinientos','Seiscientos','Setecientos','Ochocientos','Novecientos']
function _w(n){if(!n)return '';if(n<20)return _u[n];if(n<100){const r=n%10;return _d[Math.floor(n/10)]+(r?' y '+_u[r].toLowerCase():'')}if(n<1000){const r=n%100;return(n===100?'Cien':_c[Math.floor(n/100)])+(r?' '+_w(r).toLowerCase():'')}if(n<1000000){const m=Math.floor(n/1000),r=n%1000;return(m===1?'Mil':_w(m)+' Mil')+(r?' '+_w(r).toLowerCase():'')}const m=Math.floor(n/1000000),r=n%1000000;return(m===1?'Un Millón':_w(m)+' Millones')+(r?' '+_w(r).toLowerCase():'')}
const enLetras=n=>{const v=Math.round(Number(n)||0);return(v===0?'Cero':_w(v))+' Guaraníes'}

function periodoActual(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}

// ── Tabla movimiento de caja (usada en recibo y detalle) ─────────────────────
function tablaCaja(totalCobro, fechaCobro, periodoStr, pagos) {
  const th = s => `<th style="padding:3px 6px;font-size:10px;border:1px solid #ccc;background:#f0f0f0;text-align:${s||'left'}">`
  const td = (s,extra='') => `<td style="padding:3px 6px;font-size:10px;border:1px solid #ccc;text-align:${s||'left'}${extra?';'+extra:''}">`
  let saldo = totalCobro
  const filas = []
  // Fila inicial: el cobro como débito
  filas.push(`<tr style="background:#fff8e1">
    ${td()}${new Date(fechaCobro).toLocaleDateString('es-PY')}</td>
    ${td()}Cobro — ${periodoStr}</td>
    ${td('right','font-weight:700;color:#c00')}${gs(totalCobro)} Gs.</td>
    ${td('right')}—</td>
    ${td('right','font-weight:700;color:#c00')}${gs(saldo)} Gs.</td>
  </tr>`)
  // Una fila por cada pago
  for (const p of pagos) {
    const fecha = p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString('es-PY') : '-'
    const medio = p.medio_pago === 'transferencia' ? 'Transf.' : 'Efectivo'
    let concepto
    if (p.tipo === 'credito_adelantado') concepto = `Crédito adelantado (${medio})`
    else if (p.tipo === 'completo')      concepto = `Pago completo (${medio})`
    else                                 concepto = `Pago parcial (${medio})`
    saldo -= Number(p.monto)
    const colorSaldo = saldo <= 0 ? '#056' : '#c00'
    filas.push(`<tr>
      ${td()}${fecha}</td>
      ${td()}${concepto}</td>
      ${td('right')}—</td>
      ${td('right','font-weight:700;color:#056')}${gs(p.monto)} Gs.</td>
      ${td('right','font-weight:700;color:'+colorSaldo)}${gs(Math.abs(saldo))} Gs.${saldo < 0 ? ' <span style="font-size:9px">(a favor)</span>' : ''}</td>
    </tr>`)
  }
  return `
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        ${th()}Fecha</th>${th()}Concepto</th>
        ${th('right')}Débito</th>${th('right')}Crédito</th>${th('right')}Saldo</th>
      </tr></thead>
      <tbody>${filas.join('')}</tbody>
    </table>`
}

// ── HTML Recibo — 2 copias (ORIGINAL: CLIENTE / COPIA: CONTABILIDAD) ─────────
// `detalle` puede venir en dos formas: un array de cobro_detalles (pastaje, como
// siempre) o un objeto { origen:'venta', numero_venta, items } cuando el recibo
// corresponde al cobro de una venta de productos fiada.
function htmlRecibo(recibo, cliente, detalle, pagos=[]) {
  const esVenta = !!(detalle && !Array.isArray(detalle) && detalle.origen === 'venta')
  const periodoStr = esVenta ? '' : periodoLabel(recibo.periodo || '')
  const tituloSeccion = esVenta ? 'Detalle de productos' : 'Detalle de animales'
  const colProducto   = esVenta ? 'Producto' : 'Categoría'
  const colTotal       = esVenta ? 'Subtotal' : 'Total período'
  const concepto = esVenta
    ? `Venta de productos N° ${String(detalle.numero_venta||'').padStart(4,'0')}`
    : `Alquiler de Pastura — ${periodoStr}`

  const filas = esVenta
    ? (detalle.items||[]).map(it=>
        `<tr>
          <td style="padding:3px 5px;font-size:10px;border:1px solid #ccc">${it.nombre||''}</td>
          <td style="padding:3px 5px;font-size:10px;border:1px solid #ccc;text-align:center">${it.cantidad}</td>
          <td style="padding:3px 5px;font-size:10px;border:1px solid #ccc;text-align:right">${gs(it.precio_unitario||0)} Gs.</td>
          <td style="padding:3px 5px;font-size:10px;border:1px solid #ccc;text-align:right">${gs(it.subtotal||0)} Gs.</td>
        </tr>`
      ).join('')
    : (detalle||[]).filter(d=>d.cantidad>0).map(d=>
        `<tr>
          <td style="padding:3px 5px;font-size:10px;border:1px solid #ccc">${d.categorias?.nombre||''}</td>
          <td style="padding:3px 5px;font-size:10px;border:1px solid #ccc;text-align:center">${d.cantidad}</td>
          <td style="padding:3px 5px;font-size:10px;border:1px solid #ccc;text-align:right">${gs(d.precio_unitario||0)} Gs.</td>
          <td style="padding:3px 5px;font-size:10px;border:1px solid #ccc;text-align:right">${gs(d.subtotal||0)} Gs.</td>
        </tr>`
      ).join('')

  const totalCobro  = esVenta ? Number(recibo.total||0) : (detalle||[]).filter(d=>d.cantidad>0).reduce((s,d)=>s+Number(d.subtotal||0),0)
  const totalPagado = esVenta ? Number(recibo.total||0) : pagos.reduce((s,p)=>s+Number(p.monto),0)
  const saldo       = totalCobro - totalPagado
  const fechaRecibo = recibo.fecha ? recibo.fecha+'T00:00:00' : new Date().toISOString()

  const movCaja = (!esVenta && pagos.length > 0)
    ? `<div style="margin-top:12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;border-top:1px solid #bbb;padding-top:8px;margin-bottom:5px">Movimiento de cuenta</div>
       ${tablaCaja(totalCobro, fechaRecibo, periodoStr, pagos)}
       <div style="text-align:right;margin-top:5px;font-size:11px;font-weight:700;color:${saldo<=0?'#056':'#c00'}">
         ${saldo<=0 ? '✓ CANCELADO TOTALMENTE' : `SALDO PENDIENTE: ${gs(saldo)} Gs.`}
       </div>`
    : ''

  const bloque = (copia, bgHeader) => `
  <div class="recibo" style="background:${bgHeader==='copia'?'#fafafa':'#fff'}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div>
        <div style="font-size:16px;font-weight:700;margin-bottom:2px">QUERANDY S.A.</div>
        <div style="font-size:10px;color:#555">RUC: 80094734-7</div>
        <div style="font-size:10px;color:#555">Mcal. Estigarribia - Boquerón</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase">RECIBO N°</div>
        <div style="font-size:22px;font-weight:700">${String(recibo.numero||'').padStart(6,'0')}</div>
        <div style="font-size:14px;font-weight:700;border:2px solid #000;padding:3px 8px;margin-top:3px">${gs(totalPagado)} Gs.</div>
      </div>
    </div>
    <div style="border-top:1px solid #999;margin:6px 0"></div>
    <table style="width:100%;margin-bottom:10px">
      <tr><td style="font-weight:700;width:130px;padding:2px 3px;font-size:11px">Fecha:</td><td style="padding:2px 3px;font-size:11px">${new Date(fechaRecibo).toLocaleDateString('es-PY')}</td></tr>
      <tr><td style="font-weight:700;padding:2px 3px;font-size:11px">Recibimos de:</td><td style="padding:2px 3px;font-size:11px;font-weight:700">${cliente}</td></tr>
      <tr><td style="font-weight:700;padding:2px 3px;font-size:11px">Importe en letras:</td><td style="padding:2px 3px;font-size:11px">${enLetras(totalPagado)}</td></tr>
      <tr><td style="font-weight:700;padding:2px 3px;font-size:11px">Concepto:</td><td style="padding:2px 3px;font-size:11px">${concepto}</td></tr>
    </table>
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;margin-bottom:4px">${tituloSeccion}</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:6px">
      <thead><tr>
        <th style="padding:3px 5px;font-size:10px;border:1px solid #ccc;background:#f0f0f0;text-align:left">${colProducto}</th>
        <th style="padding:3px 5px;font-size:10px;border:1px solid #ccc;background:#f0f0f0;text-align:center">Cant.</th>
        <th style="padding:3px 5px;font-size:10px;border:1px solid #ccc;background:#f0f0f0;text-align:right">Precio</th>
        <th style="padding:3px 5px;font-size:10px;border:1px solid #ccc;background:#f0f0f0;text-align:right">${colTotal}</th>
      </tr></thead>
      <tbody>
        ${filas}
        <tr><td colspan="3" style="padding:3px 5px;font-size:10px;border:1px solid #ccc;text-align:right;font-weight:700">TOTAL:</td>
            <td style="padding:3px 5px;font-size:10px;border:1px solid #ccc;text-align:right;font-weight:700">${gs(totalCobro)} Gs.</td></tr>
      </tbody>
    </table>
    ${movCaja}
    <div style="text-align:right;border-top:1px solid #000;width:180px;margin-left:auto;padding-top:2px;font-size:10px;margin-top:18px">Firma</div>
    <div style="text-align:right;font-size:9px;font-weight:700;margin-top:5px;color:#555;letter-spacing:1px">${copia}</div>
  </div>`

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Recibo ${esVenta ? ('Venta N° '+String(detalle.numero_venta||'').padStart(4,'0')) : periodoStr}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:12px;background:#e5e5e5;padding:14px}
    .recibo{width:100%;max-width:680px;margin:0 auto;border:1px solid #aaa;padding:14px;background:#fff}
    .corte{width:100%;max-width:680px;margin:10px auto;border-top:2px dashed #aaa;display:flex;align-items:center;justify-content:center;padding:4px 0;font-size:10px;color:#aaa;letter-spacing:1px;gap:8px}
    @media print{
      @page{size:216mm 330mm portrait;margin:4mm}
      body{background:#fff;padding:0;margin:0}
      .recibo{border:1px solid #999;max-width:100%;margin:0;padding:10px;page-break-inside:avoid}
      .corte{display:flex;border-top:1px dashed #bbb;padding:2px 0;margin:3px 0;font-size:8px;color:#bbb;letter-spacing:1px;justify-content:center;gap:6px}
    }
  </style></head><body>
    ${bloque('ORIGINAL: CLIENTE', 'normal')}
    <div class="corte">✂ ─ ─ ─ ─ ─ ─ ─ ─ ─ CORTE ─ ─ ─ ─ ─ ─ ─ ─ ─ ✂</div>
    ${bloque('COPIA: CONTABILIDAD', 'copia')}
    <script>window.onload=()=>{window.print()}<\/script>
  </body></html>`
}

// ── HTML Detalle de cobro para imprimir ───────────────────────────────────────
function htmlDetalle(cobro, clienteNombre, detalles, pagos = []) {
  const periodoStr  = periodoLabel(cobro.periodo || '')
  const totalCobro  = (detalles || []).filter(d => d.cantidad > 0).reduce((s, d) => s + Number(d.subtotal || 0), 0)
  const totalPagado = pagos.reduce((s, p) => s + Number(p.monto), 0)
  const saldo       = totalCobro - totalPagado
  const fechaCobro  = cobro.fecha_generacion ? cobro.fecha_generacion + 'T00:00:00' : new Date().toISOString()

  const filasDetalle = (detalles || []).filter(d => d.cantidad > 0).map(d =>
    `<tr>
      <td>${d.categorias?.nombre || ''}</td>
      <td style="text-align:center">${d.cantidad}</td>
      <td style="text-align:right">${gs(d.precio_unitario || 0)} Gs.</td>
      <td style="text-align:right">${gs(d.subtotal || 0)} Gs.</td>
    </tr>`
  ).join('')

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Detalle ${periodoStr}</title><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:12px;padding:20px;max-width:720px;margin:0 auto}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;border-bottom:2px solid #000;padding-bottom:10px}
    .empresa .nombre{font-size:16px;font-weight:700;margin-bottom:2px}
    .empresa div{font-size:11px;color:#333}
    .doc-info{text-align:right}
    .doc-titulo{font-size:14px;font-weight:700;text-transform:uppercase;margin-bottom:3px}
    table{width:100%;border-collapse:collapse;margin-bottom:10px}
    th,td{border:1px solid #ccc;padding:4px 6px;font-size:11px}
    th{background:#f0f0f0;font-weight:700;text-align:left}
    .datos td{border:none;padding:2px 4px;font-size:12px}
    .datos .lbl{font-weight:700;width:150px;white-space:nowrap}
    .total-row td{font-weight:700;background:#f5f5f5}
    .seccion{font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px;color:#333}
    @media print{body{padding:10px}}
  </style></head><body>
    <div class="header">
      <div class="empresa">
        <div class="nombre">QUERANDY S.A.</div>
        <div>RUC: 80094734-7</div>
        <div>Mcal. Estigarribia - Boquerón</div>
      </div>
      <div class="doc-info">
        <div class="doc-titulo">Detalle de cobro</div>
        <div style="font-size:11px">Emisión: ${new Date().toLocaleDateString('es-PY')}</div>
      </div>
    </div>
    <table class="datos" style="margin-bottom:14px">
      <tr><td class="lbl">Cliente:</td><td><strong>${clienteNombre}</strong></td></tr>
      <tr><td class="lbl">Período:</td><td><strong>${periodoStr}</strong></td></tr>
    </table>

    <div class="seccion">Animales en pastura</div>
    <table>
      <thead><tr>
        <th>Categoría</th>
        <th style="text-align:center">Cantidad</th>
        <th style="text-align:right">Precio unitario</th>
        <th style="text-align:right">Subtotal</th>
      </tr></thead>
      <tbody>
        ${filasDetalle}
        <tr class="total-row">
          <td colspan="3" style="text-align:right">TOTAL DEL PERÍODO:</td>
          <td style="text-align:right">${gs(totalCobro)} Gs.</td>
        </tr>
      </tbody>
    </table>

    <div class="seccion">Movimiento de cuenta</div>
    ${pagos.length > 0
      ? tablaCaja(totalCobro, fechaCobro, periodoStr, pagos) +
        `<div style="text-align:right;margin-top:8px;font-size:12px;font-weight:700;color:${saldo<=0?'#056':'#c00'}">
          ${saldo<=0 ? '✓ CANCELADO TOTALMENTE' : `SALDO PENDIENTE: ${gs(saldo)} Gs.`}
        </div>`
      : `<div style="color:#999;font-style:italic;font-size:11px;padding:6px 0">Sin pagos registrados aún.</div>`
    }
    <script>window.onload=()=>window.print()<\/script>
  </body></html>`
}

function calcularCobro(animalesCli, periodo, bajasCli) {
  const [year, month] = periodo.split('-').map(Number)
  const inicioPeriodo = new Date(year, month - 1, 1)
  const finPeriodo = new Date(year, month, 0)
  const diasMes = 30 // siempre 30 días por mes, independientemente de los días reales (28/29/31)

  // Base: animales activos + bajas/vendidos que tienen fecha_baja (se cobran hasta ese mes inclusive)
  const aptos = animalesCli.filter(a => {
    if (a.estado === 'baja' || a.estado === 'vendido') {
      if (!a.fecha_baja) return false
      const mesBaja = a.fecha_baja.substring(0, 7)
      if (periodo > mesBaja) return false
      if (!a.categorias?.cobrable) return false
      if (new Date(a.fecha_ingreso+'T00:00:00') > finPeriodo) return false
      if (a.fecha_inicio_cobro && periodo < a.fecha_inicio_cobro.substring(0, 7)) return false
      return true
    }
    if (a.estado !== 'activo') return false
    if (!a.categorias?.cobrable) return false
    if (new Date(a.fecha_ingreso+'T00:00:00') > finPeriodo) return false
    if (a.fecha_inicio_cobro) {
      if (periodo < a.fecha_inicio_cobro.substring(0, 7)) return false
    }
    return true
  })

  // Clave: categoria_id + precio_unitario (para separar proporcionales de completos)
  const detalles = {}
  aptos.forEach(a => {
    const cid = a.categoria_id
    const precioBase = Number(a.precio)
    let precioUnitario = precioBase

    // Pro-rata: solo aplica en el mes de fecha_ingreso del animal
    if (a.cobrar_proporcional) {
      const mesIngreso = a.fecha_ingreso.substring(0, 7)  // "2025-11"
      if (periodo === mesIngreso) {
        const diaIngreso = new Date(a.fecha_ingreso+'T00:00:00').getDate()
        // Días en pastura sin contar el día de llegada: diasMes - diaIngreso
        const diasPastura = diasMes - diaIngreso
        if (diasPastura > 0 && diasPastura < diasMes) {
          precioUnitario = Math.round(precioBase * diasPastura / diasMes)
        }
      }
    }

    const key = `${cid}_${precioUnitario}`
    if (!detalles[key]) detalles[key] = { categoria_id: cid, nombre: a.categorias?.nombre||'', cantidad: 0, precio_unitario: precioUnitario }
    detalles[key].cantidad += a.cantidad
  })

  // Reconstrucción histórica: sumar bajas que ocurrieron durante o después de este período.
  // El animal se cobra hasta el mes en que murió, inclusive.
  ;(bajasCli||[]).forEach(m => {
    const fechaBaja = new Date(m.fecha)
    if (fechaBaja < inicioPeriodo) return  // murió antes de este período → no se cobra
    // Verificar que el animal ingresó antes del fin del período
    const animal = animalesCli.find(a => a.id === m.animal_id)
    if (!animal) return
    if (animal.fecha_baja) return  // ya manejado en aptos con fecha_baja directa
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
  const [seleccionadosRecibos, setSeleccionadosRecibos] = useState(new Set())
  const [seleccionadosCreditos, setSeleccionadosCreditos] = useState(new Set())
  const [movimientos, setMovimientos] = useState([])
  const [modalRedirigir, setModalRedirigir] = useState(null)
  const [ventasFiadas, setVentasFiadas] = useState([])
  const [cuentasPago, setCuentasPago] = useState([])
  const [modalCobroVenta, setModalCobroVenta] = useState(null)
  const [cobroVentaForm, setCobroVentaForm] = useState({})

  const perms = user?.rol==='Administrador'?{todo:true}:(user?.permisos||{})
  const puedeGenerar = perms.todo||perms.generar_cobros
  const puedeRegistrar = perms.todo||perms.registrar_pagos
  const puedeEliminar = perms.todo||perms.eliminar_anular

  useEffect(()=>{
    Promise.all([
      supabase.from('clientes').select('id,nombre_razon_social,ruc').order('nombre_razon_social'),
      supabase.from('animales').select('id,cliente_id,categoria_id,cantidad,fecha_ingreso,precio,fecha_inicio_cobro,cobrar_proporcional,estado,fecha_baja,categorias(nombre,cobrable)').in('estado',['activo','baja','vendido']),
      supabase.from('movimientos').select('animal_id,cliente_id,tipo,categoria_anterior_id,cantidad,precio_nuevo,fecha').eq('tipo','baja'),
    ]).then(([{data:cl},{data:an},{data:mv}])=>{ setClientes(cl||[]); setAnimales(an||[]); setMovimientos(mv||[]) })
    cargar()
    supabase.from('cuentas_pago').select('*').eq('activo',true).order('nombre').then(({data})=>setCuentasPago(data||[]))
    cargarVentasFiadas()
  },[])

  const cargar = async () => {
    setLoading(true)
    const [{data:cb},{data:rc},{data:cr}] = await Promise.all([
      supabase.from('cobros').select('*, clientes(nombre_razon_social), pagos(id,monto,tipo,fecha_pago,medio_pago,credito_id)').order('periodo').order('cliente_id'),
      supabase.from('recibos').select('*, clientes(nombre_razon_social), cobros(periodo)').order('created_at',{ascending:false}),
      supabase.from('creditos_cliente').select('*, clientes(nombre_razon_social), cobros(periodo), pagos!pagos_credito_id_fkey(monto, cobros(periodo))').order('fecha_pago',{ascending:false}),
    ])
    setCobros(cb||[]); setRecibos(rc||[]); setCreditos(cr||[])
    setLoading(false)
  }

  // ── Ventas fiadas (conexión con el módulo Ventas) ─────────────────────────
  const cargarVentasFiadas = async () => {
    const { data } = await supabase.from('ventas')
      .select('id,numero,fecha,cliente_id,cliente_nombre,total,estado,fecha_vencimiento,venta_items(*,productos(nombre,unidad)),venta_cobros(*)')
      .eq('estado','pendiente')
      .order('fecha_vencimiento')
    setVentasFiadas(data||[])
  }

  const abrirCobroVenta = (venta) => {
    const cobrado = venta.venta_cobros?.reduce((s,vc)=>s+Number(vc.monto),0)||0
    const saldo = Number(venta.total)-cobrado
    setCobroVentaForm({ fecha:new Date().toISOString().split('T')[0], monto:String(saldo), forma:'efectivo', cuenta_id:'' })
    setModalCobroVenta(venta)
  }

  const registrarCobroVenta = async () => {
    const venta = modalCobroVenta
    const { fecha, monto, forma, cuenta_id } = cobroVentaForm
    if (!monto||Number(monto)<=0) return setMsg({type:'error',text:'Ingresá un monto válido.'})
    if (forma==='transferencia'&&!cuenta_id) return setMsg({type:'error',text:'Seleccioná la cuenta.'})
    setProcesando(true); setMsg(null)
    const montoNum = Number(monto)
    const { error } = await supabase.from('venta_cobros').insert({
      venta_id: venta.id, fecha, monto: montoNum, forma,
      cuenta_id: forma==='transferencia'?parseInt(cuenta_id):null,
      usuario: user?.nombre_usuario,
    })
    if (error) { setProcesando(false); return setMsg({type:'error',text:'Error al registrar el cobro.'}) }

    const cobradoPrevio = venta.venta_cobros?.reduce((s,vc)=>s+Number(vc.monto),0)||0
    const saldoRestante = Number(venta.total) - (cobradoPrevio + montoNum)

    if (saldoRestante <= 0) {
      await supabase.from('ventas').update({estado:'pagada'}).eq('id',venta.id)
      const { data: recActuales } = await supabase.from('recibos').select('id').order('id',{ascending:false}).limit(1)
      const maxId = recActuales?.[0]?.id||0
      const numero = String(maxId+1).padStart(6,'0')
      await supabase.from('recibos').insert({
        numero, fecha, cliente_id: venta.cliente_id, total: Number(venta.total),
        detalle: {
          origen: 'venta', venta_id: venta.id, numero_venta: venta.numero, cliente_nombre: venta.cliente_nombre,
          items: (venta.venta_items||[]).map(it => ({
            nombre: it.productos?.nombre||'', unidad: it.productos?.unidad||'',
            cantidad: it.cantidad, precio_unitario: it.precio_unitario, subtotal: it.subtotal,
          })),
        },
      })
    }
    setModalCobroVenta(null)
    setMsg({type:'success', text: saldoRestante<=0 ? 'Cobro registrado. La venta quedó pagada y se generó el recibo.' : 'Cobro parcial registrado.'})
    await cargarVentasFiadas()
    await cargar()
    setProcesando(false)
  }

  const faltantes = calcularPeriodosFaltantes(animales, cobros, clientes, movimientos)

  const _pag = c => c.pagos?.reduce((s,p)=>s+Number(p.monto),0)||0
  const stats = {
    pagado:   cobros.reduce((s,c)=>s+_pag(c), 0),
    mes:      cobros.filter(c=>c.periodo===periodoActual()).reduce((s,c)=>s+Number(c.total),0),
    parcial:  cobros.filter(c=>c.estado==='parcial').reduce((s,c)=>s+_pag(c), 0),
    pendiente:cobros.reduce((s,c)=>s+Math.max(0,Number(c.total)-_pag(c)), 0),
    ventasFiadas: ventasFiadas.reduce((s,v)=>{
      const cobrado = v.venta_cobros?.reduce((ss,vc)=>ss+Number(vc.monto),0)||0
      return s+Math.max(0,Number(v.total)-cobrado)
    }, 0),
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
    await generarRecibosConsolidados()
    setMsg({type:'success',text:`Se generaron ${total} cobros. Créditos y recibos generados.`})
    await cargar(); setProcesando(false)
  }

  // ── Recalcula solo los cobros seleccionados con checkboxes ───────────────────
  const recalcularSeleccionados = async () => {
    if (!puedeEliminar || !seleccionados.size) return
    const cobrosARecalcular = cobros.filter(c => seleccionados.has(c.id))
    if (!cobrosARecalcular.length) return
    if (!confirm(`¿Recalcular ${cobrosARecalcular.length} cobro(s) seleccionado(s)?\nSe eliminarán y recrearán con los datos actuales de animales.`)) return
    setProcesando(true); setMsg(null)
    let total = 0
    for (const cobro of cobrosARecalcular) {
      // Limpiar todo lo relacionado al cobro
      const {data:pd} = await supabase.from('pagos').select('id').eq('cobro_id',cobro.id)
      const pids = pd?.map(p=>p.id)||[]
      if (pids.length) await supabase.from('recibos').delete().in('pago_id',pids)
      await supabase.from('recibos').delete().eq('cobro_id',cobro.id)
      await supabase.from('creditos_cliente').update({aplicado:false,cobro_id:null}).eq('cobro_id',cobro.id)
      await supabase.from('pagos').delete().eq('cobro_id',cobro.id)
      await supabase.from('cobro_detalles').delete().eq('cobro_id',cobro.id)
      await supabase.from('cobros').delete().eq('id',cobro.id)
      // Recrear con datos actuales
      const animalesCli = animales.filter(a=>a.cliente_id===cobro.cliente_id)
      const bajasCli = movimientos.filter(m=>m.cliente_id===cobro.cliente_id)
      const calc = calcularCobro(animalesCli, cobro.periodo, bajasCli)
      if (calc) {
        const [y,m] = cobro.periodo.split('-').map(Number)
        const venc = new Date(y,m,10)
        const {data:nuevoCobro} = await supabase.from('cobros').insert({
          cliente_id:cobro.cliente_id, periodo:cobro.periodo,
          fecha_generacion:new Date().toISOString().split('T')[0],
          fecha_vencimiento:venc.toISOString().split('T')[0],
          gravada:calc.gravada, iva:calc.iva, total:calc.total, estado:'pendiente'
        }).select().single()
        if (nuevoCobro) {
          await supabase.from('cobro_detalles').insert(calc.det.map(d=>({
            cobro_id:nuevoCobro.id, categoria_id:d.categoria_id,
            cantidad:d.cantidad, precio_unitario:d.precio_unitario, subtotal:d.subtotal
          })))
          total++
        }
      }
    }
    await aplicarCreditosFIFO()
    await generarRecibosConsolidados()
    setSeleccionados(new Set())
    setMsg({type:'success',text:`${total} cobro(s) recalculado(s) correctamente.`})
    await cargar(); setProcesando(false)
  }

  // ── Desaplica todos los créditos: borra pagos tipo credito_adelantado ────────
  const anularCreditosAplicados = async () => {
    if (!confirm('¿Anular todos los créditos aplicados? Volverán a estado pendiente.\nLos cobros afectados quedarán sin ese pago hasta que vuelvas a aplicar créditos.')) return
    setProcesando(true); setMsg(null)
    const {data:pagosCredito} = await supabase.from('pagos').select('id,cobro_id').eq('tipo','credito_adelantado')
    if (pagosCredito?.length) {
      const pids = pagosCredito.map(p=>p.id)
      await supabase.from('recibos').delete().in('pago_id',pids)
      await supabase.from('pagos').delete().in('id',pids)
      const cobroIds = [...new Set(pagosCredito.map(p=>p.cobro_id).filter(Boolean))]
      if (cobroIds.length) {
        await supabase.from('recibos').delete().in('cobro_id',cobroIds)
        for (const cobroId of cobroIds) {
          const {data:cb} = await supabase.from('cobros').select('total,pagos(monto)').eq('id',cobroId).single()
          if (cb) {
            const pagado = cb.pagos?.reduce((s,p)=>s+Number(p.monto),0)||0
            const estado = pagado<=0?'pendiente':pagado<Number(cb.total)?'parcial':'pagado'
            await supabase.from('cobros').update({estado}).eq('id',cobroId)
          }
        }
      }
    }
    await supabase.from('creditos_cliente').update({aplicado:false,cobro_id:null}).eq('aplicado',true)
    setMsg({type:'success',text:'Créditos desaplicados. Ahora podés recalcular y volver a aplicar.'})
    await cargar(); setProcesando(false)
  }

  // ── Abre PDF con detalle de animales de un cobro ──────────────────────────
  const verDetalle = async cobro => {
    const [{data:det},{data:pags}] = await Promise.all([
      supabase.from('cobro_detalles').select('*,categorias(nombre)').eq('cobro_id',cobro.id),
      supabase.from('pagos').select('monto,tipo,fecha_pago,medio_pago').eq('cobro_id',cobro.id).order('fecha_pago')
    ])
    const w = window.open('','_blank')
    w.document.write(htmlDetalle(cobro, cobro.clientes?.nombre_razon_social||'', det||[], pags||[]))
    w.document.close()
  }

  // ── FIFO: solo crea pagos, NO crea recibos ────────────────────────────────
  // Créditos de transferencia bancaria NO se aplican automáticamente — requieren asignación manual
  const aplicarCreditosFIFO = async () => {
    const {data:cobrosActuales} = await supabase.from('cobros').select('*, pagos(monto)').order('periodo').order('cliente_id')
    const {data:creditosActuales} = await supabase.from('creditos_cliente').select('*')
      .eq('aplicado',false)
      .neq('medio_pago','transferencia')
      .order('fecha_pago')
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
          fecha_pago:cr.fecha_pago+'T00:00:00', usuario_id:cr.usuario_id,
          credito_id: cr.id
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
      if (totalPagado===0 || totalPagado < Number(cobro.total)) continue
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
    // Solo generar recibo si el cobro quedó completamente pagado
    if (nuevoEstado === 'pagado') {
      const {data:det2} = await supabase.from('cobro_detalles').select('*,categorias(nombre)').eq('cobro_id',cobro.id)
      const {data:pagosActuales} = await supabase.from('pagos').select('id,monto,tipo,fecha_pago,medio_pago').eq('cobro_id',cobro.id)
      const totalPagado = pagosActuales?.reduce((s,p)=>s+Number(p.monto),0)||0
      // Borrar recibo anterior del período (si existía)
      await supabase.from('recibos').delete().eq('cobro_id',cobro.id)
      const {data:recActuales} = await supabase.from('recibos').select('id').order('id',{ascending:false}).limit(1)
      const maxNro = recActuales?.[0]?.id||0
      const nroR = String(maxNro+1).padStart(6,'0')
      await supabase.from('recibos').insert({
        pago_id:pago.id, cobro_id:cobro.id, numero:nroR,
        fecha:fecha_pago, cliente_id:cobro.cliente_id, total:totalPagado, detalle:det2
      })
    } else {
      // Si quedó parcial, borrar cualquier recibo previo del cobro
      await supabase.from('recibos').delete().eq('cobro_id',cobro.id)
    }
    setModal(null); cargar()
  }

  const abrirCredito = () => {
    setModalForm({cliente_id:'',monto:'',fecha_pago:new Date().toISOString().split('T')[0],periodo_aplicar:'',observacion:'',medio_pago:'efectivo'})
    setModal('credito')
  }

  const registrarCredito = async () => {
    const {cliente_id,monto,fecha_pago,periodo_aplicar,observacion,medio_pago} = modalForm
    if (!cliente_id||!monto||!fecha_pago) return setMsg({type:'error',text:'Completá cliente, monto y fecha.'})
    const {error} = await supabase.from('creditos_cliente').insert({
      cliente_id:parseInt(cliente_id), monto:parseInt(monto),
      fecha_pago, periodo_aplicar:periodo_aplicar||null,
      observacion, aplicado:false, usuario_id:user?.id,
      medio_pago: medio_pago || 'efectivo'
    })
    if (error) return setMsg({type:'error',text:`Error: ${error.message}`})
    setMsg({type:'success',text:`Pago adelantado registrado${medio_pago==='transferencia'?' (transferencia — asignación manual requerida)':''}.`})
    setModal(null); cargar()
  }

  // ── Asignación/reasignación manual de crédito a un cobro específico ───────
  const abrirAsignarCredito = (cr) => {
    const montoAplicadoCr = (cr.pagos||[]).reduce((s,p)=>s+Number(p.monto),0)
    const montoDisponible = Number(cr.monto) - montoAplicadoCr
    // Reasignación solo cuando el crédito está completamente aplicado (sin saldo disponible)
    // Créditos parcialmente aplicados usan modo aditivo: se agrega un pago sin revertir los existentes
    const esReasignacion = montoDisponible <= 0
    // Si es reasignación, se revertirán todos los pagos → el monto completo queda disponible de nuevo
    const montoParaAsignar = esReasignacion ? Number(cr.monto) : montoDisponible
    const cobrosPendCli = cobros.filter(c=>
      c.cliente_id===cr.cliente_id &&
      (c.estado==='pendiente'||c.estado==='parcial') &&
      (!cr.periodo_aplicar || c.periodo >= cr.periodo_aplicar)
    ).sort((a,b)=>a.periodo.localeCompare(b.periodo))
    const primerCobro = cobrosPendCli[0]
    const saldoPrimero = primerCobro
      ? Number(primerCobro.total)-(primerCobro.pagos?.reduce((s,p)=>s+Number(p.monto),0)||0)
      : 0
    setModalRedirigir({
      credito: cr,
      es_reasignacion: esReasignacion,
      monto_disponible: montoParaAsignar,
      monto_ya_aplicado: esReasignacion ? 0 : montoAplicadoCr,
      cobros_pendientes: cobrosPendCli,
      cobro_id: primerCobro?.id?.toString() || '',
      monto_aplicar: primerCobro ? String(Math.min(montoParaAsignar, saldoPrimero)) : ''
    })
  }

  const aplicarCreditoManual = async () => {
    const {credito, cobro_id, monto_aplicar, es_reasignacion} = modalRedirigir
    if (!cobro_id || !monto_aplicar || Number(monto_aplicar) <= 0) return
    const montoNum = Number(monto_aplicar)
    setProcesando(true); setMsg(null)

    // ── Paso 1: si es reasignación, revertir pagos existentes ────────────────
    if (es_reasignacion) {
      const {data:pagosExistentes} = await supabase.from('pagos').select('id,cobro_id').eq('credito_id', credito.id)
      if (pagosExistentes?.length) {
        const pids = pagosExistentes.map(p=>p.id)
        await supabase.from('recibos').delete().in('pago_id', pids)
        await supabase.from('pagos').delete().in('id', pids)
        const cobroIds = [...new Set(pagosExistentes.map(p=>p.cobro_id).filter(Boolean))]
        for (const cid of cobroIds) {
          await supabase.from('recibos').delete().eq('cobro_id', cid)
          const {data:cb} = await supabase.from('cobros').select('total,pagos(monto)').eq('id',cid).single()
          if (cb) {
            const pagado = cb.pagos?.reduce((s,p)=>s+Number(p.monto),0)||0
            const estado = pagado<=0?'pendiente':pagado<Number(cb.total)?'parcial':'pagado'
            await supabase.from('cobros').update({estado}).eq('id',cid)
          }
        }
      }
      // También revertir por cobro_id+tipo si no había credito_id (pre-migración)
      else if (credito.cobro_id) {
        const {data:pcOld} = await supabase.from('pagos').select('id,cobro_id').eq('cobro_id',credito.cobro_id).eq('tipo','credito_adelantado')
        if (pcOld?.length) {
          await supabase.from('recibos').delete().in('pago_id',pcOld.map(p=>p.id))
          await supabase.from('pagos').delete().in('id',pcOld.map(p=>p.id))
          await supabase.from('recibos').delete().eq('cobro_id',credito.cobro_id)
          const {data:cb} = await supabase.from('cobros').select('total,pagos(monto)').eq('id',credito.cobro_id).single()
          if (cb) {
            const pagado = cb.pagos?.reduce((s,p)=>s+Number(p.monto),0)||0
            const estado = pagado<=0?'pendiente':pagado<Number(cb.total)?'parcial':'pagado'
            await supabase.from('cobros').update({estado}).eq('id',credito.cobro_id)
          }
        }
      }
      await supabase.from('creditos_cliente').update({aplicado:false,cobro_id:null}).eq('id',credito.id)
    }

    // ── Paso 2: obtener saldo actualizado del cobro destino ──────────────────
    const {data:cobroFresh} = await supabase.from('cobros').select('*,pagos(monto)').eq('id',parseInt(cobro_id)).single()
    const cobroDestino = cobroFresh || cobros.find(c=>c.id===parseInt(cobro_id))
    if (!cobroDestino) { setProcesando(false); return }

    // ── Validación: el cobro debe pertenecer al mismo cliente del crédito ────
    if (cobroDestino.cliente_id !== credito.cliente_id) {
      setMsg({type:'error', text:'Error: el cobro seleccionado no pertenece al mismo cliente del crédito. Operación cancelada.'})
      setProcesando(false); return
    }
    const pagadoCobro = cobroDestino.pagos?.reduce((s,p)=>s+Number(p.monto),0)||0
    const saldoCobro = Number(cobroDestino.total) - pagadoCobro

    const aplicar = Math.min(montoNum, saldoCobro, Number(credito.monto))
    if (aplicar <= 0) {
      setMsg({type:'error',text:'El cobro seleccionado ya está completamente pagado.'})
      setProcesando(false); return
    }

    // ── Paso 3: crear el pago ────────────────────────────────────────────────
    await supabase.from('pagos').insert({
      cobro_id: parseInt(cobro_id),
      monto: aplicar,
      tipo: 'credito_adelantado',
      medio_pago: credito.medio_pago || 'efectivo',
      fecha_pago: credito.fecha_pago + 'T00:00:00',
      usuario_id: user?.id,
      credito_id: credito.id
    })

    // ── Paso 4: actualizar estado del cobro ──────────────────────────────────
    const nuevoSaldo = saldoCobro - aplicar
    const nuevoEstado = nuevoSaldo <= 0 ? 'pagado' : 'parcial'
    await supabase.from('cobros').update({estado: nuevoEstado}).eq('id', parseInt(cobro_id))

    // ── Paso 5: marcar crédito como aplicado si el monto fue completamente usado
    // En modo aditivo, sumar lo ya aplicado anteriormente + lo que se aplica ahora
    const totalAplicado = (modalRedirigir.monto_ya_aplicado || 0) + aplicar
    if (totalAplicado >= Number(credito.monto)) {
      await supabase.from('creditos_cliente').update({
        aplicado: true, cobro_id: parseInt(cobro_id)
      }).eq('id', credito.id)
    }

    // ── Paso 6: generar recibo si cobro quedó pagado ─────────────────────────
    if (nuevoEstado === 'pagado') {
      const {data:det} = await supabase.from('cobro_detalles').select('*,categorias(nombre)').eq('cobro_id',parseInt(cobro_id))
      const {data:pagosActuales} = await supabase.from('pagos').select('id,monto,tipo,fecha_pago,medio_pago').eq('cobro_id',parseInt(cobro_id))
      const totalPagado = pagosActuales?.reduce((s,p)=>s+Number(p.monto),0)||0
      await supabase.from('recibos').delete().eq('cobro_id',parseInt(cobro_id))
      const {data:recActuales} = await supabase.from('recibos').select('id').order('id',{ascending:false}).limit(1)
      const maxNro = recActuales?.[0]?.id||0
      const ultimoPagoData = pagosActuales?.slice(-1)[0]
      await supabase.from('recibos').insert({
        pago_id: ultimoPagoData?.id||null,
        cobro_id: parseInt(cobro_id),
        numero: String(maxNro+1).padStart(6,'0'),
        fecha: credito.fecha_pago,
        cliente_id: credito.cliente_id,
        total: totalPagado, detalle: det
      })
    }

    setModalRedirigir(null)
    const accion = es_reasignacion ? 'Reasignado' : 'Aplicado'
    setMsg({type:'success', text:`${accion}: ${gs(aplicar)} Gs. al cobro de ${periodoLabel(cobroDestino.periodo)}.`})
    await cargar(); setProcesando(false)
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
    const cr = creditos.find(c=>c.id===id)
    const aviso = cr?.aplicado
      ? '¿Eliminar este pago adelantado? Al estar aplicado se revertirá el pago de todos los cobros afectados.'
      : '¿Eliminar este pago adelantado?'
    if (!confirm(aviso)) return
    // Buscar todos los pagos vinculados a este crédito (por credito_id FK, o fallback por cobro_id+tipo)
    let pcData = []
    const {data:pcByCredito} = await supabase.from('pagos').select('id,cobro_id').eq('credito_id',id)
    if (pcByCredito?.length) {
      pcData = pcByCredito
    } else if (cr?.cobro_id) {
      const {data:pcByCobro} = await supabase.from('pagos').select('id,cobro_id').eq('cobro_id',cr.cobro_id).eq('tipo','credito_adelantado')
      pcData = pcByCobro || []
    }
    if (pcData.length) {
      const pids = pcData.map(p=>p.id)
      await supabase.from('recibos').delete().in('pago_id',pids)
      await supabase.from('pagos').delete().in('id',pids)
      // Recalcular estado de todos los cobros afectados
      const cobroIds = [...new Set(pcData.map(p=>p.cobro_id).filter(Boolean))]
      for (const cobroId of cobroIds) {
        await supabase.from('recibos').delete().eq('cobro_id',cobroId)
        const {data:cb} = await supabase.from('cobros').select('total,pagos(monto)').eq('id',cobroId).single()
        if (cb) {
          const pagado = cb.pagos?.reduce((s,p)=>s+Number(p.monto),0)||0
          const estado = pagado<=0?'pendiente':pagado<Number(cb.total)?'parcial':'pagado'
          await supabase.from('cobros').update({estado}).eq('id',cobroId)
        }
      }
    }
    await supabase.from('creditos_cliente').delete().eq('id',id)
    setMsg({type:'success',text:'Crédito eliminado.'})
    cargar()
  }

  const eliminarCreditosSeleccionados = async () => {
    if (!seleccionadosCreditos.size) return
    if (!confirm(`¿Eliminar ${seleccionadosCreditos.size} crédito(s) seleccionado(s)?`)) return
    setProcesando(true)
    for (const id of seleccionadosCreditos) await eliminarCredito(id)
    setSeleccionadosCreditos(new Set())
    setProcesando(false)
  }

  const eliminarRecibosSeleccionados = async () => {
    if (!seleccionadosRecibos.size) return
    if (!confirm(`¿Eliminar ${seleccionadosRecibos.size} recibo(s) seleccionado(s)?`)) return
    setProcesando(true)
    for (const id of seleccionadosRecibos) await supabase.from('recibos').delete().eq('id',id)
    setSeleccionadosRecibos(new Set())
    setMsg({type:'success',text:'Recibos eliminados.'})
    await cargar(); setProcesando(false)
  }

  const verPDF = async r => {
    const pagosData = r.cobro_id
      ? (await supabase.from('pagos').select('monto,tipo,fecha_pago,medio_pago').eq('cobro_id', r.cobro_id).order('fecha_pago')).data
      : []
    const w = window.open('','_blank')
    w.document.write(htmlRecibo({...r,periodo:r.cobros?.periodo||''},r.clientes?.nombre_razon_social||r.detalle?.cliente_nombre||'',r.detalle||[],pagosData||[]))
    w.document.close()
  }

  const cobrosFiltrados = cobros.filter(c=>!filtroCliente||c.cliente_id===parseInt(filtroCliente))
  const getPagado = c => c.pagos?.reduce((s,p)=>s+Number(p.monto),0)||0
  const getSaldo = c => Number(c.total)-getPagado(c)
  const getCreditoAplicado = c => c.pagos?.filter(p=>p.tipo==='credito_adelantado').reduce((s,p)=>s+Number(p.monto),0)||0

  // ── Períodos a los que se aplicó un crédito (con fallback pre-migración) ───────
  const periodosCredito = (cr) => {
    // Post-migración: FK credito_id existe → pagos disponibles directamente
    if (cr.pagos?.length > 0) {
      return cr.pagos
        .slice()
        .sort((a,b) => (a.cobros?.periodo||'').localeCompare(b.cobros?.periodo||''))
        .map(p => ({ periodo: p.cobros?.periodo, monto: Number(p.monto) }))
        .filter(p => p.periodo)
    }
    // Pre-migración: cruzar con estado de cobros por fecha_pago + tipo + cliente
    const fechaCrStr = cr.fecha_pago?.substring(0, 10)
    if (fechaCrStr) {
      const aplicados = []
      for (const c of cobros) {
        if (c.cliente_id !== cr.cliente_id) continue
        for (const p of (c.pagos || [])) {
          // Si el pago ya está vinculado a un crédito específico (vía credito_id), no
          // se lo reasigna por coincidencia de fecha: pertenece a ese otro crédito.
          if (p.credito_id) continue
          if (p.tipo === 'credito_adelantado' && p.fecha_pago?.startsWith(fechaCrStr)) {
            aplicados.push({ periodo: c.periodo, monto: Number(p.monto) })
          }
        }
      }
      if (aplicados.length > 0) {
        return aplicados.sort((a,b) => a.periodo.localeCompare(b.periodo))
      }
    }
    // Último recurso: período vinculado al crédito
    return cr.cobros?.periodo ? [{ periodo: cr.cobros.periodo, monto: Number(cr.monto) }] : []
  }

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

      <div className="cobro-cards cols-5">
        <div className="cobro-card"><div className="label">Total cobrado</div><div className="value green">{gs(stats.pagado)} Gs.</div></div>
        <div className="cobro-card"><div className="label">Total del mes</div><div className="value blue">{gs(stats.mes)} Gs.</div></div>
        <div className="cobro-card"><div className="label">Cobrado parcial</div><div className="value orange">{gs(stats.parcial)} Gs.</div></div>
        <div className="cobro-card"><div className="label">Total pendiente</div><div className="value red">{gs(stats.pendiente)} Gs.</div></div>
        <div className="cobro-card"><div className="label">Ventas fiadas</div><div className="value orange">{gs(stats.ventasFiadas)} Gs.</div></div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab==='pagos'?'active':''}`} onClick={()=>setTab('pagos')}>Pagos</button>
        <button className={`tab-btn ${tab==='recibos'?'active':''}`} onClick={()=>setTab('recibos')}>Recibos</button>
        <button className={`tab-btn ${tab==='creditos'?'active':''}`} onClick={()=>setTab('creditos')}>Créditos</button>
        <button className={`tab-btn ${tab==='ventasfiadas'?'active':''}`} onClick={()=>setTab('ventasfiadas')}>Ventas fiadas</button>
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
              {puedeGenerar&&<button className="btn btn-blue" onClick={aplicarYGenerarRecibos} disabled={procesando}>Aplicar créditos</button>}
              {puedeGenerar&&<button className="btn btn-orange" onClick={anularCreditosAplicados} disabled={procesando}>Anular créditos</button>}
              {puedeEliminar&&<button className="btn btn-red" onClick={recalcularSeleccionados} disabled={!algunoSeleccionado||procesando} style={{opacity:algunoSeleccionado?1:0.4}} title="Seleccioná cobros con el checkbox primero">Recalcular seleccionados</button>}
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
                <th>N°</th><th>Cliente</th><th>Período</th><th>Total</th><th>Pagado</th><th>Crédito</th><th>Saldo</th><th>Estado</th><th>Vencimiento</th><th>Acciones</th>
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
                      <td style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                        <button className="btn btn-blue btn-sm" onClick={()=>verDetalle(c)}>Ver detalle</button>
                        {puedeRegistrar&&c.estado!=='pagado'&&<button className="btn btn-green btn-sm" onClick={()=>abrirPago(c)}>Registrar pago</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div></div>
        </>
      )}

      {/* ── RECIBOS ── */}
      {tab==='recibos'&&(()=>{
        const recibosFiltrados = recibos.filter(r=>
          (!filtroRecibosCliente||r.cliente_id===parseInt(filtroRecibosCliente))&&
          (!filtroRecibosDesde||r.fecha>=filtroRecibosDesde)&&
          (!filtroRecibosHasta||r.fecha<=filtroRecibosHasta)
        )
        const todosRecSel = recibosFiltrados.length>0 && recibosFiltrados.every(r=>seleccionadosRecibos.has(r.id))
        const algunoRecSel = recibosFiltrados.some(r=>seleccionadosRecibos.has(r.id))
        const toggleRec = id => { const n=new Set(seleccionadosRecibos); n.has(id)?n.delete(id):n.add(id); setSeleccionadosRecibos(n) }
        const toggleTodosRec = () => {
          const n=new Set(seleccionadosRecibos)
          if(todosRecSel) recibosFiltrados.forEach(r=>n.delete(r.id))
          else recibosFiltrados.forEach(r=>n.add(r.id))
          setSeleccionadosRecibos(n)
        }
        return (
        <>
          <div style={{...fb, justifyContent:'space-between'}}>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
              <div className="form-group" style={{minWidth:200}}>
                <label>Cliente</label>
                <select value={filtroRecibosCliente} onChange={e=>{setFiltroRecibosCliente(e.target.value);setSeleccionadosRecibos(new Set())}}>
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
              {puedeGenerar&&<button className="btn btn-blue btn-sm" onClick={aplicarYGenerarRecibos} disabled={procesando}>Regenerar recibos</button>}
            </div>
            {puedeEliminar&&(
              <button className="btn btn-red" onClick={eliminarRecibosSeleccionados}
                disabled={!algunoRecSel||procesando} style={{alignSelf:'flex-end',opacity:algunoRecSel?1:0.4}}>
                🗑 Eliminar seleccionados{algunoRecSel?` (${recibosFiltrados.filter(r=>seleccionadosRecibos.has(r.id)).length})`:''}
              </button>
            )}
          </div>
          <div className="table-container"><div className="table-wrapper">
            <table>
              <thead><tr>
                {puedeEliminar&&<th style={{width:36,textAlign:'center'}}><input type="checkbox" checked={todosRecSel} ref={el=>{if(el)el.indeterminate=algunoRecSel&&!todosRecSel}} onChange={toggleTodosRec} style={{cursor:'pointer'}}/></th>}
                <th>N° Recibo</th><th>Cliente</th><th>Período</th><th>Fecha</th><th>Total pagado</th><th>Ver PDF</th>
              </tr></thead>
              <tbody>
                {recibosFiltrados.length===0
                  ?<tr><td colSpan={puedeEliminar?7:6} className="table-empty">Sin recibos. Usá "Regenerar recibos" para generarlos.</td></tr>
                  :recibosFiltrados.map(r=>(
                    <tr key={r.id} style={{background:seleccionadosRecibos.has(r.id)?'#eff6ff':''}}>
                      {puedeEliminar&&<td style={{textAlign:'center'}}><input type="checkbox" checked={seleccionadosRecibos.has(r.id)} onChange={()=>toggleRec(r.id)} style={{cursor:'pointer'}}/></td>}
                      <td style={{fontWeight:700}}>{String(r.numero||'').padStart(6,'0')}</td>
                      <td>{r.clientes?.nombre_razon_social}</td>
                      <td>{r.cobros?.periodo ? periodoLabel(r.cobros.periodo) : (r.detalle?.origen==='venta' ? `Venta N° ${String(r.detalle.numero_venta||'').padStart(4,'0')}` : '-')}</td>
                      <td>{new Date((r.fecha||'')+'T00:00:00').toLocaleDateString('es-PY')}</td>
                      <td>{gs(r.total)} Gs.</td>
                      <td><button className="btn btn-blue btn-sm" onClick={()=>verPDF(r)}>Ver PDF</button></td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div></div>
        </>
      )})()}

      {/* ── CRÉDITOS ── */}
      {tab==='creditos'&&(()=>{
        const creditosFiltrados = creditos.filter(cr=>
          (!filtroCreditosCliente||cr.cliente_id===parseInt(filtroCreditosCliente))&&
          (!filtroCreditosDesde||cr.fecha_pago>=filtroCreditosDesde)&&
          (!filtroCreditosHasta||cr.fecha_pago<=filtroCreditosHasta)
        )
        const todosCrSel = creditosFiltrados.length>0 && creditosFiltrados.every(cr=>seleccionadosCreditos.has(cr.id))
        const algunoCrSel = creditosFiltrados.some(cr=>seleccionadosCreditos.has(cr.id))
        const toggleCr = id => { const n=new Set(seleccionadosCreditos); n.has(id)?n.delete(id):n.add(id); setSeleccionadosCreditos(n) }
        const toggleTodosCr = () => {
          const n=new Set(seleccionadosCreditos)
          if(todosCrSel) creditosFiltrados.forEach(cr=>n.delete(cr.id))
          else creditosFiltrados.forEach(cr=>n.add(cr.id))
          setSeleccionadosCreditos(n)
        }
        return (
        <>
          <div style={{...fb, justifyContent:'space-between'}}>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
              <div className="form-group" style={{minWidth:200}}>
                <label>Cliente</label>
                <select value={filtroCreditosCliente} onChange={e=>{setFiltroCreditosCliente(e.target.value);setSeleccionadosCreditos(new Set())}}>
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
              {puedeRegistrar&&<button className="btn btn-purple" onClick={abrirCredito}>+ Registrar pago adelantado</button>}
            </div>
            {puedeEliminar&&(
              <button className="btn btn-red" onClick={eliminarCreditosSeleccionados}
                disabled={!algunoCrSel||procesando} style={{alignSelf:'flex-end',opacity:algunoCrSel?1:0.4}}>
                🗑 Eliminar seleccionados{algunoCrSel?` (${creditosFiltrados.filter(cr=>seleccionadosCreditos.has(cr.id)).length})`:''}
              </button>
            )}
          </div>
          <div className="table-container"><div className="table-wrapper">
            <table>
              <thead><tr>
                {puedeEliminar&&<th style={{width:36,textAlign:'center'}}><input type="checkbox" checked={todosCrSel} ref={el=>{if(el)el.indeterminate=algunoCrSel&&!todosCrSel}} onChange={toggleTodosCr} style={{cursor:'pointer'}}/></th>}
                <th>Cliente</th><th>Monto</th><th>Tipo</th><th>Fecha pago</th><th>Período destino</th><th>Observación</th><th>Estado</th>{puedeRegistrar&&<th>Asignar</th>}{puedeEliminar&&<th>Eliminar</th>}
              </tr></thead>
              <tbody>
                {creditosFiltrados.length===0
                  ?<tr><td colSpan={(puedeEliminar?1:0)+(puedeRegistrar?1:0)+8} className="table-empty">Sin créditos.</td></tr>
                  :creditosFiltrados.map(cr=>{
                    const montoAplicadoCr = (cr.pagos||[]).reduce((s,p)=>s+Number(p.monto),0)
                    const montoDisponibleCr = Number(cr.monto) - montoAplicadoCr
                    const esTransferencia = (cr.medio_pago||'efectivo') === 'transferencia'
                    return (
                    <tr key={cr.id} style={{background:seleccionadosCreditos.has(cr.id)?'#eff6ff':esTransferencia?'#faf5ff':''}}>
                      {puedeEliminar&&<td style={{textAlign:'center'}}><input type="checkbox" checked={seleccionadosCreditos.has(cr.id)} onChange={()=>toggleCr(cr.id)} style={{cursor:'pointer'}}/></td>}
                      <td style={{fontWeight:600}}>{cr.clientes?.nombre_razon_social}</td>
                      <td>
                        <div style={{fontWeight:600}}>{gs(cr.monto)} Gs.</div>
                        {montoDisponibleCr > 0 && montoAplicadoCr > 0 && (
                          <div style={{fontSize:11,color:'var(--orange)'}}>Disponible: {gs(montoDisponibleCr)} Gs.</div>
                        )}
                      </td>
                      <td>
                        <span className={`badge badge-${esTransferencia?'blue':'green'}`} style={{fontSize:11}}>
                          {esTransferencia?'Transferencia':'Efectivo'}
                        </span>
                      </td>
                      <td>{new Date(cr.fecha_pago+'T00:00:00').toLocaleDateString('es-PY')}</td>
                      <td>
                        {(() => {
                          const periodos = periodosCredito(cr)
                          if (periodos.length > 0 && (cr.aplicado || periodos.length > 1)) {
                            return (
                              <div style={{display:'flex',flexDirection:'column',gap:3}}>
                                {periodos.map((p,i) => (
                                  <div key={i} style={{display:'flex',alignItems:'center',gap:6}}>
                                    <span style={{
                                      background:'#dbeafe',color:'#1e40af',
                                      borderRadius:4,padding:'1px 6px',fontSize:11,fontWeight:600,
                                      whiteSpace:'nowrap'
                                    }}>{periodoLabel(p.periodo||'')}</span>
                                    <span style={{fontSize:11,fontWeight:600,color:'var(--text-primary)'}}>
                                      {gs(p.monto)} Gs.
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )
                          } else if (!cr.aplicado && cr.periodo_aplicar) {
                            return <span style={{fontSize:12}}>Desde {periodoLabel(cr.periodo_aplicar)}</span>
                          } else if (!cr.aplicado) {
                            return <span style={{fontSize:12,color:'var(--text-secondary)'}}>
                              {esTransferencia ? '— asignación manual —' : 'Primer cobro pendiente'}
                            </span>
                          } else {
                            return <span style={{fontSize:12,color:'var(--text-secondary)'}}>Sin datos de período</span>
                          }
                        })()}
                      </td>
                      <td>{cr.observacion||'-'}</td>
                      <td>
                        <span className={`badge badge-${cr.aplicado&&montoDisponibleCr===0?'green':'orange'}`}>
                          {cr.aplicado&&montoDisponibleCr===0?'Aplicado':'Pendiente'}
                        </span>
                      </td>
                      {puedeRegistrar&&(
                        <td>
                          <button className="btn btn-purple btn-sm" onClick={()=>abrirAsignarCredito(cr)}>
                            {montoDisponibleCr > 0 ? 'Asignar' : 'Reasignar'}
                          </button>
                        </td>
                      )}
                      {puedeEliminar&&<td><button className="btn btn-red btn-sm" onClick={()=>eliminarCredito(cr.id)}>Eliminar</button></td>}
                    </tr>
                  )})
                }
              </tbody>
            </table>
          </div></div>
        </>
      )})()}

      {/* ── VENTAS FIADAS ── */}
      {tab==='ventasfiadas'&&(
        <div className="table-container"><div className="table-wrapper">
          <table>
            <thead><tr>
              <th>N°</th><th>Cliente</th><th>Detalle</th><th>Fecha</th><th>Vencimiento</th><th>Total</th><th>Cobrado</th><th>Saldo</th><th>Acciones</th>
            </tr></thead>
            <tbody>
              {ventasFiadas.length===0
                ? <tr><td colSpan={9} className="table-empty">Sin ventas fiadas pendientes.</td></tr>
                : ventasFiadas.map(v=>{
                  const cobrado = v.venta_cobros?.reduce((s,vc)=>s+Number(vc.monto),0)||0
                  const saldo = Number(v.total)-cobrado
                  const vencida = v.fecha_vencimiento && new Date(v.fecha_vencimiento) < new Date()
                  const detalle = (v.venta_items||[]).map(it=>`${it.productos?.nombre||''} ×${it.cantidad}`).join(', ')
                  return (
                    <tr key={v.id} style={{background:vencida?'#fff5f5':''}}>
                      <td>{String(v.numero).padStart(4,'0')}</td>
                      <td style={{fontWeight:600}}>{v.cliente_nombre}</td>
                      <td style={{maxWidth:220,whiteSpace:'normal'}}>{detalle}</td>
                      <td>{new Date(v.fecha+'T00:00:00').toLocaleDateString('es-PY')}</td>
                      <td style={{color:vencida?'var(--red)':undefined,fontWeight:vencida?700:400}}>
                        {v.fecha_vencimiento ? new Date(v.fecha_vencimiento+'T00:00:00').toLocaleDateString('es-PY') : '-'}
                        {vencida && <span className="badge badge-red" style={{marginLeft:4}}>Vencida</span>}
                      </td>
                      <td>{gs(v.total)} Gs.</td>
                      <td>{gs(cobrado)} Gs.</td>
                      <td style={{fontWeight:600,color:saldo>0?'var(--red)':'var(--green)'}}>{gs(saldo)} Gs.</td>
                      <td>{puedeRegistrar&&<button className="btn btn-green btn-sm" onClick={()=>abrirCobroVenta(v)}>Registrar cobro</button>}</td>
                    </tr>
                  )
                })
              }
            </tbody>
          </table>
        </div></div>
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
          <p style={{marginBottom:16,fontSize:13,color:'var(--text-secondary)'}}>
            {(modalForm.medio_pago||'efectivo')==='transferencia'
              ? 'Transferencia bancaria: quedará pendiente hasta que lo asignés manualmente a un cobro específico.'
              : 'Efectivo: se aplicará automáticamente al cobro del período indicado o al primer cobro pendiente.'}
          </p>
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
            <label>Medio de pago *</label>
            <select value={modalForm.medio_pago||'efectivo'} onChange={e=>setModalForm({...modalForm,medio_pago:e.target.value,periodo_aplicar:e.target.value==='transferencia'?'':modalForm.periodo_aplicar})}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia bancaria</option>
            </select>
          </div>
          {(modalForm.medio_pago||'efectivo')==='efectivo'&&(
            <div className="form-group" style={{marginBottom:14}}>
              <label>Período destino (opcional)</label>
              <input type="month" value={modalForm.periodo_aplicar} onChange={e=>setModalForm({...modalForm,periodo_aplicar:e.target.value})}/>
              <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:3}}>Si no se indica, se aplica al primer cobro pendiente del cliente.</div>
            </div>
          )}
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

      {/* ── MODAL REGISTRAR COBRO DE VENTA FIADA ── */}
      {modalCobroVenta&&(
        <div className="modal-overlay"><div className="modal">
          <h3>Registrar cobro</h3>
          <p style={{marginBottom:4,fontSize:14}}>Cliente: <strong>{modalCobroVenta.cliente_nombre}</strong></p>
          <p style={{marginBottom:4,fontSize:14}}>Venta N°: <strong>{String(modalCobroVenta.numero).padStart(4,'0')}</strong></p>
          <p style={{marginBottom:16,fontSize:14,color:'var(--red)'}}>
            Saldo: <strong>{gs(Number(modalCobroVenta.total) - (modalCobroVenta.venta_cobros?.reduce((s,vc)=>s+Number(vc.monto),0)||0))} Gs.</strong>
          </p>
          <div className="form-group" style={{marginBottom:14}}>
            <label>Fecha *</label>
            <input type="date" value={cobroVentaForm.fecha} onChange={e=>setCobroVentaForm({...cobroVentaForm,fecha:e.target.value})}/>
          </div>
          <div className="form-group" style={{marginBottom:14}}>
            <label>Monto (Gs.) *</label>
            <input type="number" min="1" value={cobroVentaForm.monto} onChange={e=>setCobroVentaForm({...cobroVentaForm,monto:e.target.value})}/>
          </div>
          <div className="form-group" style={{marginBottom:14}}>
            <label>Forma de pago *</label>
            <select value={cobroVentaForm.forma} onChange={e=>setCobroVentaForm({...cobroVentaForm,forma:e.target.value,cuenta_id:''})}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </div>
          {cobroVentaForm.forma==='transferencia'&&(
            <div className="form-group" style={{marginBottom:20}}>
              <label>Cuenta *</label>
              <select value={cobroVentaForm.cuenta_id} onChange={e=>setCobroVentaForm({...cobroVentaForm,cuenta_id:e.target.value})}>
                <option value="">Seleccionar...</option>
                {cuentasPago.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          )}
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={()=>setModalCobroVenta(null)}>Cancelar</button>
            <button className="btn btn-green" onClick={registrarCobroVenta} disabled={procesando}>{procesando?'Procesando...':'Confirmar cobro'}</button>
          </div>
        </div></div>
      )}

      {/* ── MODAL ASIGNACIÓN MANUAL DE CRÉDITO ── */}
      {modalRedirigir&&(
        <div className="modal-overlay"><div className="modal">
          <h3>{modalRedirigir.es_reasignacion ? 'Reasignar crédito' : 'Asignar crédito a cobro'}</h3>
          {modalRedirigir.es_reasignacion&&(
            <div style={{background:'#fff7ed',border:'1px solid #fdba74',borderRadius:6,padding:'8px 12px',marginBottom:12,fontSize:12,color:'#92400e'}}>
              ⚠ Se revertirán los pagos anteriores de este crédito y se aplicará al nuevo cobro seleccionado.
            </div>
          )}
          <div style={{background:'#f5f3ff',border:'1px solid #c4b5fd',borderRadius:8,padding:'10px 14px',marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:600,color:'#5b21b6'}}>{modalRedirigir.credito.clientes?.nombre_razon_social}</div>
            <div style={{fontSize:13,marginTop:2}}>
              Monto total: <strong>{gs(modalRedirigir.credito.monto)} Gs.</strong>
              {' · '}
              <span style={{color:'var(--purple)',fontWeight:600}}>Disponible: {gs(modalRedirigir.monto_disponible)} Gs.</span>
            </div>
            <div style={{fontSize:12,color:'#6b7280',marginTop:2}}>
              {(modalRedirigir.credito.medio_pago||'efectivo')==='transferencia'?'Transferencia bancaria':'Efectivo'}
              {' · '}{new Date(modalRedirigir.credito.fecha_pago+'T00:00:00').toLocaleDateString('es-PY')}
            </div>
          </div>
          {modalRedirigir.cobros_pendientes.length===0 ? (
            <div style={{padding:'18px 0',textAlign:'center',color:'var(--text-secondary)',fontSize:14}}>
              No hay cobros pendientes para este cliente.
            </div>
          ) : (
            <>
              <div className="form-group" style={{marginBottom:14}}>
                <label>Cobro destino *</label>
                <select value={modalRedirigir.cobro_id} onChange={e=>{
                  const cid = parseInt(e.target.value)
                  const cobro = modalRedirigir.cobros_pendientes.find(c=>c.id===cid)
                  if (!cobro) return
                  const pag = cobro.pagos?.reduce((s,p)=>s+Number(p.monto),0)||0
                  const sal = Number(cobro.total)-pag
                  setModalRedirigir({...modalRedirigir, cobro_id:e.target.value, monto_aplicar:String(Math.min(modalRedirigir.monto_disponible,sal))})
                }}>
                  {modalRedirigir.cobros_pendientes.map(c=>{
                    const pag = c.pagos?.reduce((s,p)=>s+Number(p.monto),0)||0
                    const sal = Number(c.total)-pag
                    return <option key={c.id} value={c.id}>{periodoLabel(c.periodo)} — Saldo: {gs(sal)} Gs.</option>
                  })}
                </select>
              </div>
              <div className="form-group" style={{marginBottom:6}}>
                <label>Monto a aplicar (Gs.) *</label>
                <input type="number" min="1" max={modalRedirigir.monto_disponible}
                  value={modalRedirigir.monto_aplicar}
                  onChange={e=>setModalRedirigir({...modalRedirigir,monto_aplicar:e.target.value})}
                />
              </div>
              {Number(modalRedirigir.monto_aplicar) > 0 && Number(modalRedirigir.monto_aplicar) < modalRedirigir.monto_disponible && (
                <div style={{fontSize:12,color:'var(--orange)',marginBottom:14,padding:'6px 10px',background:'#fff7ed',borderRadius:6}}>
                  ⚠ Sobrante: {gs(modalRedirigir.monto_disponible - Number(modalRedirigir.monto_aplicar))} Gs. quedará disponible para asignar a otro cobro después.
                </div>
              )}
            </>
          )}
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={()=>setModalRedirigir(null)}>Cancelar</button>
            {modalRedirigir.cobros_pendientes.length>0&&(
              <button className="btn btn-purple" onClick={aplicarCreditoManual} disabled={procesando}>
                {procesando?'Procesando...':'Aplicar crédito'}
              </button>
            )}
          </div>
        </div></div>
      )}
    </div>
  )
}
