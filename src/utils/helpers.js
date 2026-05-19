export const gs = (n) =>
  new Intl.NumberFormat('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(n) || 0)

export const fechaHoy = () => new Date().toISOString().split('T')[0]

export const diasDesde = (fecha) => {
  const hoy = new Date()
  const f = new Date(fecha)
  return Math.floor((hoy - f) / 86400000)
}

export const periodoActual = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const periodoLabel = (p) => {
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const [y, m] = p.split('-')
  return `${meses[parseInt(m) - 1]} ${y}`
}

export const horaActual = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
