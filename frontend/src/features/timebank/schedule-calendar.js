import { fullName } from './format.js'

export const SCHEDULE_TYPES = [
  { id: 'request', label: 'Solicitud enviada', plural: 'Solicitudes enviadas' },
  { id: 'reservation', label: 'Reserva confirmada', plural: 'Reservas confirmadas' },
  { id: 'availability', label: 'Horario publicado', plural: 'Horarios para dar tutoría' },
]
const validInterval = (start, end) => Number.isFinite(Date.parse(start)) && Date.parse(end) > Date.parse(start)
export function scheduleEvents({ userId, requests = [], reservations = [], availability = [], findSkill = () => null, findUser = () => null }) {
  const subject = (id) => findSkill(id)?.nombre || 'Tutoría'
  const events = []
  for (const row of requests) if (row.id_solicitante === userId && row.estado === 'Solicitada') {
    events.push({ id: `request:${row.id_solicitud}`, type: 'request', start: row.fecha_inicio_propuesta, end: row.fecha_fin_propuesta, title: subject(row.id_habilidad), person: `Tutor: ${fullName(findUser(row.id_ofertante))}`, description: row.descripcion || 'Solicitud de intercambio enviada. Está pendiente de la respuesta del tutor.', source: row })
  }
  for (const row of reservations) if (row.estado === 'Confirmada' && [row.id_solicitante, row.id_ofertante].includes(userId)) {
    const teaching = row.id_ofertante === userId
    events.push({ id: `reservation:${row.id_reserva}`, type: 'reservation', start: row.fecha_inicio, end: row.fecha_fin, title: subject(row.id_habilidad), person: `${teaching ? 'Estudiante' : 'Tutor'}: ${fullName(findUser(teaching ? row.id_solicitante : row.id_ofertante))}`, description: teaching ? 'Reserva confirmada para dar una tutoría.' : 'Reserva confirmada para recibir una tutoría.', source: row })
  }
  for (const row of availability) if (row.id_usuario === userId && ['disponible', 'reservado'].includes(row.estado)) {
    events.push({ id: `availability:${row.id_disponibilidad}`, type: 'availability', start: row.fecha_inicio, end: row.fecha_fin, title: row.id_habilidad ? subject(row.id_habilidad) : 'Horario para dar tutoría', person: 'Tu disponibilidad', description: 'Horario que publicaste para compartir tus conocimientos.', source: row })
  }
  return events.filter((e) => validInterval(e.start, e.end)).sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || a.id.localeCompare(b.id))
}
export function eventsOnDay(events, day) {
  const start = Date.parse(`${day}T00:00:00-04:00`), end = start + 86400000
  // End is exclusive: a class ending at midnight belongs only to the previous day.
  return events.filter((e) => Date.parse(e.start) < end && Date.parse(e.end) > start)
}
export function calendarDays(year, month) {
  const first = new Date(Date.UTC(year, month, 1))
  const offset = (first.getUTCDay() + 6) % 7
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(Date.UTC(year, month, i - offset + 1))
    return { key: date.toISOString().slice(0, 10), number: date.getUTCDate(), inMonth: date.getUTCMonth() === month }
  })
}
