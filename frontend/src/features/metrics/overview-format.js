export const PERIOD_OPTIONS = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
]

// Periodo [from, to) que termina ahora, en ISO-8601 con zona horaria.
export function periodRange(days, now = new Date()) {
  return { from: new Date(now.getTime() - days * 86400000).toISOString(), to: now.toISOString() }
}

// Los créditos llegan como texto decimal exacto, incluso en sumas grandes.
export function formatCredits(value) {
  const text = String(value ?? '0')
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text)
  if (!match) return '0'
  const fraction = (match[3] || '').replace(/0+$/, '')
  const whole = match[2].replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${whole === '0' && !fraction ? '' : match[1]}${whole}${fraction ? `,${fraction}` : ''}`
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
