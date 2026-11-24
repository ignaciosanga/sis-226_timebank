import { buildStudentActivity } from './student-activity.js'

export function buildSyntheticStudentActivity(store, roadmap = null) {
  const userId = store.user?.id || ''
  const classes = (store.myReservations || [])
    .filter((row) => row.estado === 'Completada')
    .map((row) => {
      const learned = row.id_solicitante === userId
      const review = (store.ownReviews || []).find((item) => item.id_reserva === row.id_reserva)
      const start = Date.parse(row.fecha_inicio)
      const end = Date.parse(row.fecha_fin)
      return {
        id_reserva: row.id_reserva,
        id_habilidad: row.id_habilidad,
        participacion: learned ? 'aprendi' : 'ensene',
        materia: store.findSkill(row.id_habilidad)?.nombre || 'Tutoría',
        completed_at: row.confirmacion_solicitante_at || row.confirmacion_ofertante_at || row.fecha_fin,
        fecha_fin: row.fecha_fin,
        horas: Number.isFinite(start) && Number.isFinite(end) ? (end - start) / 3600000 : null,
        creditos: row.creditos,
        calificacion: review?.calificacion ?? null,
        comentario: review?.comentario ?? '',
      }
    })

  const data = buildStudentActivity({
    classes: { period: null, data: classes, meta: null, resumen: null },
    reservations: store.myReservations,
    requests: store.myRequests,
    roadmap,
    userId,
  })

  if (!data.balance.aprendi.clases && !data.balance.ensene.clases) {
    data.balance = {
      aprendi: { clases: 4, horas: 6.5, creditos: '18', materias: 3, opiniones: 0, promedio: null },
      ensene: { clases: 3, horas: 5, creditos: '14', materias: 2, opiniones: 3, promedio: 4.7 },
    }
  }
  if (!data.reviews.length) {
    data.reviews = [
      { id: 'demo-review-1', date: new Date().toISOString(), rating: 5, comment: 'Explicó el tema con ejemplos claros.', materia: 'SIS-113 · Programación II' },
      { id: 'demo-review-2', date: new Date(Date.now() - 86400000 * 3).toISOString(), rating: 4, comment: 'Buena preparación y seguimiento de ejercicios.', materia: 'MAT-132 · Cálculo I' },
    ]
  }
  if (!data.evolution.length) {
    data.evolution = [
      { label: '1 Nov', value: 4, materia: 'MAT-132' },
      { label: '8 Nov', value: 5, materia: 'SIS-113' },
      { label: '15 Nov', value: 4.5, materia: 'SIS-122' },
    ]
  }
  if (!data.rating.average) data.rating = { average: 4.7, count: 3 }
  if (!data.upcoming.length) {
    data.upcoming = [
      { id: 'demo-next-1', date: new Date(Date.now() + 86400000).toISOString(), role: 'Aprendí', materia: 'Cálculo I', creditos: '4' },
      { id: 'demo-next-2', date: new Date(Date.now() + 86400000 * 3).toISOString(), role: 'Enseñé', materia: 'Programación II', creditos: '4' },
    ]
  }
  if (!data.pendingRequests.length) {
    data.pendingRequests = [
      { id: 'demo-request-1', date: new Date(Date.now() + 86400000 * 5).toISOString(), materia: 'Bases de Datos I', creditos: '4', direction: 'Enviada' },
    ]
  }
  if (!data.roadmap.valid) {
    data.roadmap = { approved: 8, current: 3, total: 49, percent: 16, valid: true }
  }
  return data
}
