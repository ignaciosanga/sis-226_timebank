import test from 'node:test'
import assert from 'node:assert/strict'
import {
  averageRating,
  buildStudentActivity,
  calculateRoleBalance,
  classifyPendingRequests,
  classifyUpcomingReservations,
  normalizePagedClasses,
  normalizeRoadmapProgress,
  ratingEvolution,
  recentReviews,
} from './student-activity.js'

test('usa resumen.aprendi y resumen.ensene sin recalcular innecesariamente', () => {
  const payload = {
    data: [{ id_reserva: 'one' }],
    meta: { page: 1, limit: 100, total: 3, totalPages: 1 },
    resumen: {
      aprendi: { clases: 3, horas: 4.5, creditos: '12.5', materias: 2, opiniones: 1, promedio: 4 },
      ensene: { clases: 2, horas: 3, creditos: '8', materias: 1, opiniones: 2, promedio: 4.5 },
    },
  }
  assert.equal(normalizePagedClasses(payload).meta.total, 3)
  const balance = calculateRoleBalance(payload)
  assert.equal(balance.aprendi.clases, 3)
  assert.equal(balance.aprendi.horas, 4.5)
  assert.equal(balance.ensene.creditos, '8')
})

test('calcula balance de fallback desde data paginada', () => {
  const balance = calculateRoleBalance({ data: [
    { participacion: 'aprendi', horas: 1.5, creditos: '4', id_habilidad: 'a', calificacion: 4 },
    { participacion: 'aprendi', horas: 2, creditos: '5.5', id_habilidad: 'b' },
    { participacion: 'ensene', horas: 3, creditos: '7', id_habilidad: 'a', calificacion: 5 },
  ] })
  assert.equal(balance.aprendi.clases, 2)
  assert.equal(balance.aprendi.horas, 3.5)
  assert.equal(balance.aprendi.creditos, '9.5')
  assert.equal(balance.ensene.horas, 3)
})

test('promedio y evolución solo consideran Enseñé', () => {
  const payload = {
    resumen: { ensene: { opiniones: 3, promedio: 4.5 } },
    data: [
      { participacion: 'ensene', completed_at: '2026-01-10T10:00:00Z', calificacion: 4 },
      { participacion: 'ensene', completed_at: '2026-02-10T10:00:00Z', calificacion: 5 },
      { participacion: 'aprendi', completed_at: '2026-03-10T10:00:00Z', calificacion: 1 },
    ],
  }
  assert.deepEqual(averageRating(payload), { average: 4.5, count: 3 })
  assert.deepEqual(ratingEvolution(payload).map((row) => row.value), [4, 5])
})

test('ausencias muestran resultados vacíos', () => {
  const payload = { resumen: { ensene: { opiniones: 0, promedio: null } }, data: [] }
  assert.deepEqual(averageRating(payload), { average: null, count: 0 })
  assert.deepEqual(recentReviews(payload), [])
  assert.deepEqual(ratingEvolution(payload), [])
})

test('opiniones recientes se ordenan y conservan comentarios opcionales', () => {
  const payload = { data: [
    { id_reserva: 'old', participacion: 'ensene', completed_at: '2026-01-01T00:00:00Z', calificacion: 3, comentario: '' },
    { id_reserva: 'new', participacion: 'ensene', completed_at: '2026-03-01T00:00:00Z', calificacion: 5, comentario: 'Muy clara', materia: 'SIS-113' },
  ] }
  assert.equal(recentReviews(payload)[0].id, 'new')
  assert.equal(recentReviews(payload)[0].comment, 'Muy clara')
})

test('reservas próximas excluyen ajenas, canceladas y pasadas', () => {
  const now = new Date('2026-11-23T12:00:00Z')
  const reservations = [
    { id_reserva: 'mine', id_solicitante: 'me', id_ofertante: 'tutor', estado: 'Confirmada', fecha_inicio: '2026-11-24T10:00:00Z' },
    { id_reserva: 'foreign', id_solicitante: 'a', id_ofertante: 'b', estado: 'Confirmada', fecha_inicio: '2026-11-24T10:00:00Z' },
    { id_reserva: 'past', id_solicitante: 'me', id_ofertante: 'tutor', estado: 'Confirmada', fecha_inicio: '2026-11-20T10:00:00Z' },
  ]
  assert.deepEqual(classifyUpcomingReservations(reservations, 'me', now).map((row) => row.id), ['mine'])
})

test('solicitudes pendientes incluyen solo las vinculadas al usuario', () => {
  const requests = [
    { id_solicitud: 'sent', id_solicitante: 'me', id_ofertante: 'tutor', estado: 'Solicitada' },
    { id_solicitud: 'received', id_solicitante: 'student', id_ofertante: 'me', estado: 'Solicitada' },
    { id_solicitud: 'foreign', id_solicitante: 'a', id_ofertante: 'b', estado: 'Solicitada' },
  ]
  const rows = classifyPendingRequests(requests, 'me')
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map((row) => row.direction).sort(), ['Enviada', 'Recibida'])
})

test('roadmap inválido no infiere materias aprobadas', () => {
  assert.equal(normalizeRoadmapProgress(null).valid, false)
  assert.equal(normalizeRoadmapProgress({ curriculum: 'other', courses: {} }).valid, false)
  assert.deepEqual(normalizeRoadmapProgress({
    curriculum: 'systems',
    courses: { 'SIS-111': 'approved', 'SIS-113': 'current' },
  }), { approved: 1, current: 1, total: 49, percent: 2, valid: true })
})

test('respuestas incompletas producen estados ausentes', () => {
  const activity = buildStudentActivity({ classes: null, reservations: null, requests: null, roadmap: null, userId: 'me' })
  assert.equal(activity.balance.aprendi.clases, null)
  assert.equal(activity.rating.average, null)
  assert.deepEqual(activity.upcoming, [])
  assert.equal(activity.roadmap.valid, false)
})

test('datos paginados incompletos no generan métricas inventadas', () => {
  assert.deepEqual(normalizePagedClasses({ data: null, meta: null }).data, [])
  assert.equal(normalizePagedClasses(null).meta, null)
})
