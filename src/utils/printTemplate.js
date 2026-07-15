// ── Plantilla imprimible común: recibos, tickets y reportes ──────────────────
// Un solo header/footer/CSS reutilizado por todas las vistas de impresión
// (ventana + window.print), para que todo lo que sale de Ñongatu se vea igual:
// logo, título, rango de fechas, "Generado por X el fecha y hora" y pie de página.

export const PRINT_BASE_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:22px;background:#e5e5e5}
  .pt-page{max-width:900px;margin:0 auto;background:#fff;padding:20px}
  .pt-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;border-bottom:2px solid #000;padding-bottom:10px;gap:16px}
  .pt-logo{display:flex;align-items:center;gap:10px}
  .pt-logo img{height:38px}
  .pt-empresa .pt-nombre{font-size:16px;font-weight:700;margin-bottom:2px}
  .pt-empresa div{font-size:10.5px;color:#333}
  .pt-doc{text-align:right}
  .pt-doc .pt-titulo{font-size:15px;font-weight:700;text-transform:uppercase;margin-bottom:3px}
  .pt-doc div{font-size:10.5px;color:#333}
  .pt-doc .pt-box{display:inline-block;border:2px solid #000;padding:3px 8px;font-weight:700;font-size:14px;margin-top:4px;color:#111}
  .pt-filtros{font-size:10px;color:#666;font-style:italic;margin-bottom:10px}
  .pt-footer{margin-top:18px;padding-top:8px;border-top:1px solid #ccc;font-size:9.5px;color:#777;display:flex;justify-content:space-between}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid #ccc;padding:4px 6px;font-size:10.5px;vertical-align:top}
  th{background:#f0f0f0;font-weight:700;text-align:left}
  tr{page-break-inside:avoid}
  tr:nth-child(even) td{background:#fafafa}
  .pt-subtotal-row td{font-weight:700;background:#eef2ff !important}
  .pt-total-row td{font-weight:700;background:#e8f0fe !important}
  @media print{
    @page{size:A4;margin:12mm}
    body{background:#fff;padding:0}
    .pt-page{max-width:100%;padding:0}
  }
`

// `titulo` grande a la derecha, `subtitulo` opcional debajo (ej: nombre de cliente
// en un recibo), `filtrosTxt` en cursiva (rango de fechas, filtros aplicados) y
// la línea "Generado por X el fecha y hora".
export function printHeader({ titulo, subtitulo, filtrosTxt, usuario, extraRightHtml }) {
  const ahora = new Date()
  const fechaHora = `${ahora.toLocaleDateString('es-PY')} ${ahora.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}`
  return `
    <div class="pt-header">
      <div class="pt-logo">
        <img src="${window.location.origin}/nongatu-logo.png" onerror="this.style.display='none'">
        <div class="pt-empresa">
          <div class="pt-nombre">QUERANDY S.A.</div>
          <div>RUC: 80094734-7</div>
          <div>Mcal. Estigarribia - Boquerón</div>
        </div>
      </div>
      <div class="pt-doc">
        <div class="pt-titulo">${titulo}</div>
        ${subtitulo ? `<div>${subtitulo}</div>` : ''}
        <div>Generado por ${usuario || '-'} el ${fechaHora}</div>
        ${extraRightHtml || ''}
      </div>
    </div>
    ${filtrosTxt ? `<div class="pt-filtros">${filtrosTxt}</div>` : ''}
  `
}

export function printFooter() {
  return `<div class="pt-footer"><span>Ñongatu — sistema de gestión de pasturas y ventas</span><span>${new Date().toLocaleDateString('es-PY')}</span></div>`
}

// Arma el documento HTML completo: header + `bodyHtml` (lo específico de cada
// vista: tabla de un reporte, detalle de una venta, recibo con sus 2 copias) + footer.
export function printDocument({ titleTag, bodyHtml, extraCss = '' }) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${titleTag}</title><style>${PRINT_BASE_CSS}${extraCss}</style></head><body>
    <div class="pt-page">
      ${bodyHtml}
    </div>
    <script>window.onload=()=>{window.print()}<\/script>
  </body></html>`
}

export function abrirVentanaImpresion(html) {
  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
}
