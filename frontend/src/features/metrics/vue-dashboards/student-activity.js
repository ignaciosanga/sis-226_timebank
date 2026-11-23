import { progressSummary } from '../../roadmap/roadmap-model.js'

const ROLE_ALIASES = { aprendi: 'aprendi', aprendí: 'aprendi', ensene: 'ensene', enseñe: 'ensene' }

const numberValue = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const countValue = (value) => {
  const number = numberValue(value)
  return number !== null && number >= 0 ? number : null
}

const ratingValue = (value) => {
  const number = numberValue(value)
  return number !== null && number >= 1 && number <= 5 ? number : null
}

export function normalizePagedClasses(payload) {
  if (!payload || typeof payload !== 'object') return { period: null, data: [], meta: null, resumen: null }
  return {
    period: payload.period && typeof payload.period === 'object' ? payload.period : null,
    data: Array.isArray(payload.data) ? payload.data : [],
    meta: payload.meta && typeof payload.meta === 'object' ? payload.meta : null,
    resumen: payload.resumen && typeof payload.resumen === 'object' ? payload.resumen : null,
  }
}

export function calculateRoleBalance(payload) {
  const normalized = normalizePagedClasses(payload)
  if (normalized.resumen) {
    const learned = normalized.resumen.aprendi && typeof normalized.resumen.aprendi === 'object'
      ? normalized.resumen.aprendi
      : {}
    const taught = normalized.resumen.ensene && typeof normalized.resumen.ensene === 'object'
      ? normalized.resumen.ensene
      : {}
    return {
      aprendi: {
        clases: countValue(learned.clases),
        horas: numberValue(learned.horas),
        creditos: learned.creditos == null ? null : String(learned.creditos),
        materias: countValue(learned.materias),
        opiniones: countValue(learned.opiniones),
        promedio: ratingValue(learned.promedio),
      },
      ensene: {
        clases: countValue(taught.clases),
        horas: numberValue(taught.horas),
        creditos: taught.creditos == null ? null : String(taught.creditos),
        materias: countValue(taught.materias),
        opiniones: countValue(taught.opiniones),
        promedio: ratingValue(taught.promedio),
      },
    }
  }

  if (!normalized.data.length) {
    const empty = { clases: null, horas: null, creditos: null, materias: null, opiniones: null, promedio: null }
    return { aprendi: { ...empty }, ensene: { ...empty } }
  }

  const result = {
    aprendi: { clases: 0, horas: 0, creditos: '0', materias: 0, opiniones: 0, promedio: null },
    ensene: { clases: 0, horas: 0, creditos: '0', materias: 0, opiniones: 0, promedio: null },
  }
  const materias = { aprendi: new Set(), ensene: new Set() }
  const credits = { aprendi: 0, ensene: 0 }
  const ratings = { aprendi: [], ensene: [] }

  for (const row of normalized.data) {
    const role = ROLE_ALIASES[row?.participacion]
    if (!role) continue
    result[role].clases += 1
    const hours = numberValue(row.horas)
    if (hours !== null) result[role].horas += hours
    const credit = numberValue(row.creditos)
    if (credit !== null) credits[role] += credit
    if (row.id_habilidad) materias[role].add(row.id_habilidad)
    const rating = ratingValue(row.calificacion)
    if (rating !== null) {
      ratings[role].push(rating)
      result[role].opiniones += 1
    }
  }

  for (const role of ['aprendi', 'ensene']) {
    result[role].creditos = String(credits[role])
    result[role].materias = materias[role].size
    result[role].promedio = ratings[role].length
      ? ratings[role].reduce((sum, rating) => sum + rating, 0) / ratings[role].length
      : null
  }
  return result
}

export function ratingEvolution(payload) {
  return normalizePagedClasses(payload).data
    .filter((row) => row && ROLE_ALIASES[row.participacion] === 'ensene')
    .map((row) => ({
      date: row.completed_at || row.fecha_fin || null,
      value: ratingValue(row.calificacion),
      materia: typeof row.materia === 'string' ? row.materia : '',
    }))
    .filter((row) => row.date && row.value !== null)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .map((row) => ({
      label: new Date(row.date).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' }),
      value: row.value,
      materia: row.materia,
    }))
}

export function averageRating(payload) {
  const taught = normalizePagedClasses(payload).resumen?.ensene
  const count = countValue(taught?.opiniones)
  const average = ratingValue(taught?.promedio)
  if (count !== null && count > 0) return { average, count }
  const evolution = ratingEvolution(payload)
  return {
    average: evolution.length
      ? Math.round((evolution.reduce((sum, row) => sum + row.value, 0) / evolution.length) * 100) / 100
      : null,
    count: evolution.length,
  }
}

export function recentReviews(payload, limit = 5) {
  const safeLimit = countValue(limit) ?? 5
  return normalizePagedClasses(payload).data
    .filter((row) => row && ROLE_ALIASES[row.participacion] === 'ensene' && ratingValue(row.calificacion) !== null)
    .sort((a, b) => Date.parse(b.completed_at || b.fecha_fin || 0) - Date.parse(a.completed_at || a.fecha_fin || 0))
    .slice(0, safeLimit)
    .map((row) => ({
      id: row.id_reserva || `${row.materia}-${row.fecha_fin}`,
      date: row.completed_at || row.fecha_fin || null,
      rating: ratingValue(row.calificacion),
      comment: typeof row.comentario === 'string' && row.comentario.trim() ? row.comentario.trim() : '',
      materia: typeof row.materia === 'string' ? row.materia : 'Tutoría',
    }))
}

export function classifyUpcomingReservations(reservations, userId, now = new Date()) {
  if (!Array.isArray(reservations) || !userId) return []
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now)
  return reservations
    .filter((row) => row && row.estado === 'Confirmada'
      && (row.id_solicitante === userId || row.id_ofertante === userId)
      && Date.parse(row.fecha_inicio) > nowMs)
    .sort((a, b) => Date.parse(a.fecha_inicio) - Date.parse(b.fecha_inicio))
    .map((row) => ({
      id: row.id_reserva,
      date: row.fecha_inicio,
      end: row.fecha_fin || null,
      role: row.id_solicitante === userId ? 'Aprendí' : 'Enseñé',
      materia: typeof row.materia === 'string' ? row.materia : '',
      creditos: row.creditos == null ? null : String(row.creditos),
    }))
}

export function classifyPendingRequests(requests, userId) {
  if (!Array.isArray(requests) || !userId) return []
  return requests
    .filter((row) => row && row.estado === 'Solicitada'
      && (row.id_solicitante === userId || row.id_ofertante === userId))
    .sort((a, b) => Date.parse(a.created_at || a.fecha_inicio_propuesta || 0)
      - Date.parse(b.created_at || b.fecha_inicio_propuesta || 0))
    .map((row) => ({
      id: row.id_solicitud,
      date: row.fecha_inicio_propuesta || row.created_at || null,
      materia: typeof row.materia === 'string' ? row.materia : '',
      creditos: row.creditos_requeridos == null ? null : String(row.creditos_requeridos),
      direction: row.id_solicitante === userId ? 'Enviada' : 'Recibida',
    }))
}

export function normalizeRoadmapProgress(payload) {
  if (!payload || payload.curriculum !== 'systems'
    || !payload.courses || typeof payload.courses !== 'object'
    || Array.isArray(payload.courses)) {
    return { approved: 0, current: 0, total: 49, percent: 0, valid: false }
  }
  const normalized = { curriculum: 'systems', courses: {} }
  for (const [code, status] of Object.entries(payload.courses)) {
    if (status === 'approved' || status === 'current') normalized.courses[code] = status
  }
  return { ...progressSummary(normalized), valid: true }
}

export function buildStudentActivity({ classes, reservations, requests, roadmap, userId, now } = {}) {
  return {
    balance: calculateRoleBalance(classes),
    rating: averageRating(classes),
    evolution: ratingEvolution(classes),
    reviews: recentReviews(classes),
    upcoming: classifyUpcomingReservations(reservations, userId, now),
    pendingRequests: classifyPendingRequests(requests, userId),
    roadmap: normalizeRoadmapProgress(roadmap),
  }
}
