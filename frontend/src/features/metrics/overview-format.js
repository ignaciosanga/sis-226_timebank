export const PERIOD_OPTIONS = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
]

// Periodo [from, to) que termina ahora, en ISO-8601 con zona horaria.
export function periodRange(days, now = new Date()) {
  return { from: new Date(now.getTime() - days * 86400000).toISOString(), to: now.toISOString() }
}

// Los créditos llegan como string entero (pueden ser enormes): no se pasan por Number.
export function formatCredits(value) {
  const text = String(value ?? '0')
  if (!/^-?\d+$/.test(text)) return '0'
  return text.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

const count = (value) => String(value ?? 0)

// Tarjetas del panel a partir de la respuesta de GET /analytics/overview.
export function overviewCards(data) {
  if (!data) return []
  const { usuarios = {}, intercambios = {}, creditos = {}, solicitudes = {} } = data
  return [
    { key: 'usuarios', label: 'Usuarios', value: count(usuarios.total), hint: `${count(usuarios.activos)} activos · ${count(usuarios.suspendidos)} suspendidos` },
    { key: 'completados', label: 'Intercambios completados', value: count(intercambios.completados), hint: `${count(intercambios.cancelados)} cancelados en el periodo` },
    { key: 'horas', label: 'Horas intercambiadas', value: count(intercambios.horasProgramadas), hint: `${count(solicitudes.totalHistorico)} solicitudes en total` },
    { key: 'transferidos', label: 'Créditos transferidos', value: formatCredits(creditos.transferidos), hint: `${formatCredits(creditos.retenidosActuales)} retenidos ahora` },
    { key: 'saldo', label: 'Saldo total actual', value: formatCredits(creditos.saldoTotalActual), hint: 'Créditos en circulación' },
  ]
}
