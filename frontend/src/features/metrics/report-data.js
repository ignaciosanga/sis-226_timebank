import { formatCredits } from './overview-format.js'
const movementType = row => ({ Retencion:'Retención', Liberacion:'Liberación', Consumo:'Cobro', Penalizacion:'Cobro', BonoInicial:'Abono', Recompensa:'Abono', Transferencia:String(row.cantidad).startsWith('-') ? 'Cobro' : 'Abono' })[row.tipo] || row.tipo || 'Movimiento'
const rows = value => Array.isArray(value) ? value : []
const count = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
const PALETTE = ['#005289', '#177a51', '#f6c500', '#5b9ec7', '#b58d00', '#9c2b23', '#6b7280']
const STATE_COLORS = { completadas: '#177a51', confirmadas: '#005289', canceladas: '#9c2b23', aceptadas: '#177a51', solicitadas: '#f6c500', rechazadas: '#9c2b23', Activo: '#177a51', Inactivo: '#6b7280', Suspendido: '#9c2b23', Pendiente: '#f6c500' }
const named = (value, distinct = false) => rows(value).filter(row => count(row.cantidad) !== null).map((row, index) => ({ label: row.nombre || 'Sin categoría', value: row.cantidad, color: distinct ? PALETTE[index % PALETTE.length] : '#005289' }))
const series = value => rows(value).filter(row => count(row.cantidad) !== null).map(row => ({ label: new Date(row.periodo).toLocaleDateString('es-BO', { timeZone: 'America/La_Paz', day: '2-digit', month: 'short' }), value: row.cantidad }))
const byState = (value, labels) => Object.entries(labels).filter(([key]) => count(value?.[key]) !== null).map(([key, label], index) => ({ label, value: value[key], color: STATE_COLORS[key] || PALETTE[index % PALETTE.length] }))

export function adminReportData({ overview, users, exchanges, credits, skills, academic } = {}) {
  const statuses = exchanges?.reservas?.estadoActual
  const totalExchanges = statuses && ['confirmadas', 'completadas', 'canceladas'].every(key => count(statuses[key]) !== null) ? Object.values(statuses).reduce((sum, n) => sum + n, 0) : '—'
  // La API solo proporciona una serie de completadas; no se inventa tendencia de solicitudes.
  const activity = series(exchanges?.completadasPorPeriodo)
  const finalization = exchanges?.tasas?.finalizacion
  return {
    hu04: { kpis: { activeUsers: count(overview?.usuarios?.activos) ?? '—', totalExchanges, completionRate: count(finalization) ?? '—', creditsInCirculation: credits?.saldoTotalActual == null ? '—' : formatCredits(credits.saldoTotalActual) }, activityByWeek: activity, activityByMonth: activity,
      exchangesByStatus: byState(statuses, { completadas: 'Completadas', confirmadas: 'Confirmadas', canceladas: 'Canceladas' }) },
    hu05: { requestsByStatus: byState(exchanges?.solicitudes?.estadoActual, { aceptadas: 'Aceptadas', solicitadas: 'Pendientes', rechazadas: 'Rechazadas', canceladas: 'Canceladas' }), requestsTrend: [], cancellationReasons: [], demandHeatmap: { days: [], slots: [], matrix: [] } },
    hu06: { usersByCareer: named(users?.porCarrera), usersBySemester: [], usersByStatus: byState(users?.porEstado, { Activo: 'Activos', Inactivo: 'Inactivos', Suspendido: 'Suspendidos', Pendiente: 'Pendientes' }), registrationGrowth: series(users?.registrosPorPeriodo) },
    hu07: { topOffered: named(skills?.estudiantesPorHabilidad), topRequested: named(skills?.masSolicitadas), skillsByCategory: named(skills?.porCategoria, true), supplyVsDemand: rows(academic?.data).filter(row => count(row.tutores_activos) !== null && count(row.solicitudes) !== null).slice(0, 10).map(row => ({ label: row.nombre || row.codigo, values: [row.tutores_activos, row.solicitudes] })) },
  }
}

export function academicGapReady(payload) {
  return Array.isArray(payload?.data) && payload.data.length > 0 && payload.data.every(row => count(row.solicitudes_pendientes ?? row.solicitudes) !== null && count(row.tutores_activos) !== null)
}
export function academicGapPayload(payload) {
  return {
    ...payload,
    data: rows(payload?.data).map(row => ({
      ...row,
      solicitudes: count(row.solicitudes_pendientes) ?? (count(row.cubiertas) !== null ? Math.max(0, row.solicitudes - row.cubiertas) : row.solicitudes),
    })),
  }
}
export function reputationReady(payload) {
  return Boolean(payload && Array.isArray(payload.data))
}

export function studentReportData(sources, store) {
  const account = sources.account
  const reservations = rows(sources.reservations).filter(row => row.id_solicitante === store.user.id || row.id_ofertante === store.user.id).map(row => {
    const offered = row.id_ofertante === store.user.id
    const person = store.findUser(offered ? row.id_solicitante : row.id_ofertante)
    return { id: row.id_reserva, habilidad: store.findSkill(row.id_habilidad)?.nombre || row.materia || 'Tutoría', tipo: offered ? 'Ofrecido' : 'Recibido', fecha: row.fecha_inicio, estado: row.estado, contraparte: (offered ? [row.nombre_solicitante, row.apellido_solicitante] : [row.nombre_ofertante, row.apellido_ofertante]).filter(Boolean).join(' ') || (person ? `${person.nombre} ${person.apellido}` : 'Estudiante'), creditos: row.creditos == null ? '—' : formatCredits(row.creditos) }
  })
  const moves = rows(sources.movements).map(row => ({ positive: !String(row.cantidad ?? '').startsWith('-'), displayAmount: row.cantidad == null ? '—' : `${String(row.cantidad).startsWith('-') ? '' : '+'}${formatCredits(row.cantidad)}`, id: row.id_movimiento, fecha: row.created_at, tipo: movementType(row), cantidad: row.cantidad == null ? '—' : formatCredits(row.cantidad), saldoPosterior: row.saldo_posterior == null ? '—' : formatCredits(row.saldo_posterior), descripcion: row.descripcion || row.tipo }))
  const learned = sources.classes?.resumen?.aprendi, taught = sources.classes?.resumen?.ensene
  const rating = { average: typeof taught?.promedio === 'number' && Number.isFinite(taught.promedio) && taught.promedio >= 1 && taught.promedio <= 5 && taught.opiniones > 0 ? taught.promedio : null, count: count(taught?.opiniones) ?? 0 }
  return { kpis: { disponibles: account?.disponibles == null ? '—' : formatCredits(account.disponibles), retenidos: account?.creditos_retenidos == null ? '—' : formatCredits(account.creditos_retenidos), totales: account?.saldo == null ? '—' : formatCredits(account.saldo), ofrecidos: count(taught?.clases) ?? '—', recibidos: count(learned?.clases) ?? '—', rating },
    offeredVsReceived: sources.classes ? [{ label: 'Clases impartidas completadas', value: count(taught?.clases) ?? 0, color: '#005289' }, { label: 'Clases recibidas completadas', value: count(learned?.clases) ?? 0, color: '#f6c500' }] : [], balanceSeries: [], movements: moves, reservations,
  }
}
