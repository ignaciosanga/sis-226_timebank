import { createSyntheticData } from '../../demo/synthetic-data.js'

const MOVEMENT_GROUP = {
  Retencion: 'Retención',
  Liberacion: 'Liberación',
  Consumo: 'Cobro',
  Penalizacion: 'Cobro',
  BonoInicial: 'Abono',
  Recompensa: 'Abono',
  Transferencia: 'Abono',
  Ajuste: 'Abono',
}

export function normalizeMovementType(tipo) {
  return MOVEMENT_GROUP[tipo] || tipo || 'Abono'
}

export function formatShortDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })
}

export function formatDateTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * HU01 - HU03: Datos del estudiante.
 * Usa los datos reales del store; en modo demo (?demo=1) complementa movimientos
 * y calificación promedio coherentes con las reservas sintéticas.
 */
export function buildStudentSprint0Data(store, { isDemo = false } = {}) {
  const userId = store.user?.id || ''
  const disponibles = Number(store.account?.disponibles ?? 0)
  const retenidos = Number(store.account?.creditos_retenidos ?? 0)
  const totales = Number(store.account?.saldo ?? disponibles + retenidos)

  const reservations = (store.myReservations || []).map((r) => {
    const isOffered = r.id_ofertante === userId
    const counterpartId = isOffered ? r.id_solicitante : r.id_ofertante
    const counterpart = store.findUser?.(counterpartId)
    const skill = store.findSkill?.(r.id_habilidad)
    return {
      id: r.id_reserva,
      habilidad: skill?.nombre || r.materia || 'Tutoría UCB',
      tipo: isOffered ? 'Ofrecido' : 'Recibido',
      fecha: r.fecha_inicio,
      estado: r.estado || 'Confirmada',
      contraparte: counterpart ? `${counterpart.nombre} ${counterpart.apellido}`.trim() : 'Estudiante UCB',
      creditos: Number(r.creditos ?? 4),
    }
  })

  // En modo demo, añadimos 2 reservas canceladas para que HU03 muestre los 3 estados completos
  if (isDemo && !reservations.some((r) => r.estado === 'Cancelada')) {
    const now = Date.now()
    reservations.push(
      {
        id: 'demo-cancel-1',
        habilidad: 'Cálculo I',
        tipo: 'Recibido',
        fecha: new Date(now - 9 * 86400000).toISOString(),
        estado: 'Cancelada',
        contraparte: 'Mateo Flores',
        creditos: 4,
      },
      {
        id: 'demo-cancel-2',
        habilidad: 'Programación II',
        tipo: 'Ofrecido',
        fecha: new Date(now - 14 * 86400000).toISOString(),
        estado: 'Cancelada',
        contraparte: 'Camila Vargas',
        creditos: 4,
      },
    )
  }

  const ofrecidos = reservations.filter((r) => r.tipo === 'Ofrecido').length
  const recibidos = reservations.filter((r) => r.tipo === 'Recibido').length

  // Movimientos reales o sintetizados coherentemente en modo demo
  let movements = (store.myMovements || []).map((m) => {
    const cat = normalizeMovementType(m.tipo)
    const qty = Number(m.cantidad ?? m.monto ?? 0)
    const sign = cat === 'Cobro' || cat === 'Retención' ? -Math.abs(qty) : Math.abs(qty)
    return {
      id: m.id_movimiento,
      fecha: m.created_at,
      tipoOriginal: m.tipo,
      tipo: cat,
      cantidad: sign,
      saldoPosterior: Number(m.saldo_posterior ?? totales),
      descripcion: m.descripcion || m.tipo,
    }
  })

  if (!movements.length && isDemo) {
    const now = Date.now()
    const day = 86400000
    movements = [
      { id: 'dm-1', fecha: new Date(now - 28 * day).toISOString(), tipo: 'Abono', cantidad: 20, saldoPosterior: 20, descripcion: 'Bono inicial de bienvenida' },
      { id: 'dm-2', fecha: new Date(now - 23 * day).toISOString(), tipo: 'Retención', cantidad: -4, saldoPosterior: 20, descripcion: 'Reserva Cálculo I' },
      { id: 'dm-3', fecha: new Date(now - 21 * day).toISOString(), tipo: 'Cobro', cantidad: -4, saldoPosterior: 16, descripcion: 'Tutoría completada: Cálculo I' },
      { id: 'dm-4', fecha: new Date(now - 17 * day).toISOString(), tipo: 'Abono', cantidad: 8, saldoPosterior: 24, descripcion: 'Tutoría impartida: Programación II' },
      { id: 'dm-5', fecha: new Date(now - 14 * day).toISOString(), tipo: 'Retención', cantidad: -4, saldoPosterior: 24, descripcion: 'Reserva Bases de Datos I' },
      { id: 'dm-6', fecha: new Date(now - 13 * day).toISOString(), tipo: 'Liberación', cantidad: 4, saldoPosterior: 24, descripcion: 'Cancelación anticipada' },
      { id: 'dm-7', fecha: new Date(now - 9 * day).toISOString(), tipo: 'Abono', cantidad: 12, saldoPosterior: 36, descripcion: 'Tutorías impartidas: Estructuras y Web' },
      { id: 'dm-8', fecha: new Date(now - 4 * day).toISOString(), tipo: 'Abono', cantidad: 4, saldoPosterior: 40, descripcion: 'Tutoría impartida: Álgebra Lineal' },
      { id: 'dm-9', fecha: new Date(now - 1 * day).toISOString(), tipo: 'Retención', cantidad: -12, saldoPosterior: 40, descripcion: '3 reservas confirmadas próximas' },
    ]
  }

  const chronological = [...movements].sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha))
  const movementsDesc = [...chronological].reverse()

  const balanceSeries = chronological.map((m) => ({
    label: formatShortDate(m.fecha),
    value: m.saldoPosterior,
  }))

  const rating = isDemo ? { average: 4.7, count: 6 } : { average: null, count: 0 }

  return {
    kpis: { disponibles, retenidos, totales, ofrecidos, recibidos, rating },
    offeredVsReceived: [
      { label: 'Ofrecidos', value: ofrecidos, color: '#005289' },
      { label: 'Recibidos', value: recibidos, color: '#f6c500' },
    ],
    balanceSeries,
    movements: movementsDesc,
    reservations: [...reservations].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha)),
  }
}

/**
 * HU04 - HU07: Datos del administrador (Sprint 0).
 * Basado en createSyntheticData() enriquecido para mostrar los 4 reportes completos.
 */
export function buildAdminSprint0Data() {
  const synth = createSyntheticData()
  const totalUsers = synth.users.length // 46
  const activeUsers = Math.round(totalUsers * 0.85) // 39
  const inactiveUsers = Math.round(totalUsers * 0.11) // 5
  const suspendedUsers = totalUsers - activeUsers - inactiveUsers // 2

  const completed = synth.reservations.filter((r) => r.estado === 'Completada').length
  const confirmed = synth.reservations.filter((r) => r.estado === 'Confirmada').length
  const cancelled = Math.max(18, Math.round(completed * 0.08))
  const totalExchanges = completed + confirmed + cancelled
  const completionRate = Math.round((completed / Math.max(totalExchanges, 1)) * 100)
  const creditsInCirculation = Object.values(synth.accounts).reduce((sum, a) => sum + Number(a.saldo || 0), 0)

  // HU04: actividad semanal y mensual
  const activityByWeek = [
    { label: 'Sem 1', value: 42 },
    { label: 'Sem 2', value: 58 },
    { label: 'Sem 3', value: 64 },
    { label: 'Sem 4', value: 79 },
    { label: 'Sem 5', value: 91 },
    { label: 'Sem 6', value: 108 },
    { label: 'Sem 7', value: 124 },
    { label: 'Sem 8', value: 138 },
  ]
  const activityByMonth = [
    { label: 'Jul', value: 95 },
    { label: 'Ago', value: 148 },
    { label: 'Sep', value: 212 },
    { label: 'Oct', value: 268 },
    { label: 'Nov', value: 314 },
  ]

  const exchangesByStatus = [
    { label: 'Completados', value: completed, color: '#177a51' },
    { label: 'En curso', value: confirmed + 24, color: '#005289' },
    { label: 'Cancelados', value: cancelled, color: '#c44536' },
  ]

  // HU05: solicitudes, tendencia, motivos cancelación, heatmap día/horario
  const requestsByStatus = [
    { label: 'Aceptadas', value: completed + confirmed, color: '#177a51' },
    { label: 'Pendientes', value: 34, color: '#f6c500' },
    { label: 'Rechazadas', value: 22, color: '#8a99a6' },
    { label: 'Canceladas', value: cancelled, color: '#c44536' },
  ]
  const requestsTrend = [
    { label: '12 Oct', value: 28 },
    { label: '19 Oct', value: 41 },
    { label: '26 Oct', value: 53 },
    { label: '02 Nov', value: 62 },
    { label: '09 Nov', value: 78 },
    { label: '16 Nov', value: 94 },
    { label: '21 Nov', value: 112 },
  ]
  const cancellationReasons = [
    { motivo: 'Choque con examen o entrega académica', cantidad: 19, porcentaje: 35 },
    { motivo: 'Imprevisto de horario / transporte', cantidad: 14, porcentaje: 26 },
    { motivo: 'El solicitante ya resolvió su duda', cantidad: 9, porcentaje: 17 },
    { motivo: 'Sin confirmación previa del tutor', cantidad: 7, porcentaje: 13 },
    { motivo: 'Otros motivos personales', cantidad: 5, porcentaje: 9 },
  ]
  const demandHeatmap = {
    days: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    slots: ['08:00–10:00', '10:00–12:00', '14:00–16:00', '16:00–18:00', '18:00–20:00', '20:00–22:00'],
    matrix: [
      [4, 6, 5, 7, 3, 8],
      [9, 11, 14, 12, 8, 13],
      [12, 16, 18, 15, 11, 9],
      [19, 24, 27, 22, 15, 6],
      [25, 31, 34, 29, 18, 4],
      [14, 18, 21, 17, 9, 2],
    ],
  }

  // HU06: usuarios por carrera, semestre, estado y crecimiento
  const usersByCareer = [
    { label: 'Ingeniería de Sistemas', value: 24, color: '#005289' },
    { label: 'Ingeniería Industrial', value: 8, color: '#00a7c8' },
    { label: 'Administración de Empresas', value: 6, color: '#177a51' },
    { label: 'Economía', value: 4, color: '#7655a3' },
    { label: 'Ingeniería Civil', value: 4, color: '#a65b1b' },
  ]
  const semesterCounts = new Map()
  for (let s = 1; s <= 9; s++) semesterCounts.set(s, 0)
  for (const u of synth.users) {
    const sem = Math.min(9, Math.max(1, Number(u.semestre) || 3))
    semesterCounts.set(sem, (semesterCounts.get(sem) || 0) + 1)
  }
  const usersBySemester = [...semesterCounts.entries()].map(([sem, value]) => ({
    label: `${sem}.º`,
    value,
    color: '#005289',
  }))
  const usersByStatus = [
    { label: 'Activos', value: activeUsers, color: '#177a51' },
    { label: 'Inactivos', value: inactiveUsers, color: '#f6c500' },
    { label: 'Suspendidos', value: suspendedUsers, color: '#c44536' },
  ]
  const registrationGrowth = [
    { label: 'Jul', value: 8 },
    { label: 'Ago', value: 17 },
    { label: 'Sep', value: 26 },
    { label: 'Oct', value: 38 },
    { label: 'Nov', value: totalUsers },
  ]

  // HU07: habilidades más ofertadas, más solicitadas, oferta vs demanda, por categoría
  const offerCountBySkill = new Map()
  for (const p of synth.published) {
    offerCountBySkill.set(p.id_habilidad, (offerCountBySkill.get(p.id_habilidad) || 0) + 1)
  }
  const reqCountBySkill = new Map()
  for (const r of synth.reservations) {
    reqCountBySkill.set(r.id_habilidad, (reqCountBySkill.get(r.id_habilidad) || 0) + 1)
  }

  const skillStats = synth.skills.slice(0, 12).map((s, idx) => {
    const offered = (offerCountBySkill.get(s.id_habilidad) || 1) + (idx % 3) * 2
    const requested = Math.max(3, Math.round((reqCountBySkill.get(s.id_habilidad) || 6) * 0.85))
    return { name: s.nombre, area: s.area, offered, requested }
  })

  const topOffered = [...skillStats]
    .sort((a, b) => b.offered - a.offered)
    .slice(0, 7)
    .map((s) => ({ label: s.name, value: s.offered, color: '#005289' }))

  const topRequested = [...skillStats]
    .sort((a, b) => b.requested - a.requested)
    .slice(0, 7)
    .map((s) => ({ label: s.name, value: s.requested, color: '#00a7c8' }))

  const supplyVsDemand = [...skillStats]
    .sort((a, b) => b.requested - a.requested)
    .slice(0, 6)
    .map((s) => ({ label: s.name, values: [s.offered, s.requested] }))

  const catCounts = new Map()
  for (const s of synth.skills) {
    catCounts.set(s.id_categoria, (catCounts.get(s.id_categoria) || 0) + 1)
  }
  const palette = ['#005289', '#00a7c8', '#177a51', '#7655a3', '#a65b1b', '#f6c500']
  const skillsByCategory = synth.categories.map((c, idx) => ({
    label: c.nombre,
    value: catCounts.get(c.id_categoria) || 0,
    color: c.color || palette[idx % palette.length],
  })).filter((c) => c.value > 0)

  return {
    hu04: {
      kpis: { activeUsers, totalExchanges, completionRate, creditsInCirculation },
      activityByWeek,
      activityByMonth,
      exchangesByStatus,
    },
    hu05: {
      requestsByStatus,
      requestsTrend,
      cancellationReasons,
      demandHeatmap,
    },
    hu06: {
      usersByCareer,
      usersBySemester,
      usersByStatus,
      registrationGrowth,
    },
    hu07: {
      topOffered,
      topRequested,
      supplyVsDemand,
      skillsByCategory,
    },
  }
}
