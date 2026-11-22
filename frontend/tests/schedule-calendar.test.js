import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calendarDays, eventsOnDay, scheduleEvents } from '../src/features/timebank/schedule-calendar.js'
import { createSyntheticData } from '../src/features/demo/synthetic-data.js'

const start = '2026-11-20T15:00:00Z', end = '2026-11-20T16:00:00Z'
const input = {
  userId: 'me',
  findSkill: () => ({ nombre: 'Programación II' }),
  findUser: () => ({ nombre: 'Ana', apellido: 'Rojas' }),
  requests: [
    { id_solicitud: 'sent', id_solicitante: 'me', id_ofertante: 'tutor', id_habilidad: 'subject', estado: 'Solicitada', fecha_inicio_propuesta: start, fecha_fin_propuesta: end, descripcion: 'Repasar recursividad.' },
    { id_solicitud: 'incoming', id_solicitante: 'another', id_ofertante: 'me', estado: 'Solicitada', fecha_inicio_propuesta: start, fecha_fin_propuesta: end },
    ...['Aceptada', 'Cancelada', 'Rechazada'].map((estado) => ({ id_solicitud: estado, id_solicitante: 'me', estado, fecha_inicio_propuesta: start, fecha_fin_propuesta: end })),
  ],
  reservations: ['Confirmada', 'Cancelada', 'Completada'].map((estado) => ({ id_reserva: estado, id_solicitante: 'me', id_ofertante: 'tutor', estado, fecha_inicio: start, fecha_fin: end })),
  availability: ['disponible', 'reservado', 'inactivo', 'cancelado'].map((estado) => ({ id_disponibilidad: estado, id_usuario: 'me', estado, fecha_inicio: start, fecha_fin: end })),
}
test('calendar shows only own pending sent requests, confirmed participations and active own published slots', () => {
  const events = scheduleEvents(input)
  assert.equal(events.filter((e) => e.type === 'request').length, 1)
  assert.equal(events.filter((e) => e.type === 'reservation').length, 1)
  assert.equal(events.filter((e) => e.type === 'availability').length, 2)
  const request = events.find((e) => e.type === 'request')
  assert.equal(request.title, 'Programación II'); assert.equal(request.person, 'Tutor: Ana Rojas'); assert.equal(request.description, 'Repasar recursividad.')
  assert.equal(scheduleEvents({ ...input, userId: 'outsider' }).length, 0)
  const teaching = scheduleEvents({ ...input, userId: 'tutor' }).find((e) => e.type === 'reservation')
  assert.equal(teaching.person, 'Estudiante: Ana Rojas')
  assert.match(teaching.description, /dar una tutoría/)
})
test('day intersections use La Paz, include overnight classes and exclude the ending midnight', () => {
  const event = { start: '2026-11-21T03:00:00Z', end: '2026-11-21T05:00:00Z' }
  assert.equal(eventsOnDay([event], '2026-11-20').length, 1)
  assert.equal(eventsOnDay([event], '2026-11-21').length, 1)
  assert.equal(eventsOnDay([{ ...event, end: '2026-11-21T04:00:00Z' }], '2026-11-21').length, 0)
  assert.equal(eventsOnDay([event], '2026-11-22').length, 0)
})
test('month grids begin on Monday, include leap days and cross year boundaries without timezone drift', () => {
  const november = calendarDays(2026, 10)
  assert.equal(november.length, 42); assert.equal(november[0].key, '2026-10-26')
  assert.equal(november.filter((d) => d.inMonth).length, 30)
  assert.equal(calendarDays(2028, 1).filter((d) => d.inMonth).length, 29)
  assert.ok(calendarDays(2027, 0).some((d) => d.key === '2026-12-31'))
})
test('invalid intervals cannot break the calendar and demo contains all three color states', () => {
  assert.equal(scheduleEvents({ ...input, requests: [], reservations: [], availability: [{ ...input.availability[0], fecha_inicio: 'invalid' }] }).length, 0)
  const data = createSyntheticData(Date.parse('2026-11-18T18:00:00Z'))
  const events = scheduleEvents({ userId: data.viewerId, requests: data.requests, reservations: data.reservations, availability: data.availability })
  assert.equal(events.filter((e) => e.type === 'request').length, 2)
  assert.equal(events.filter((e) => e.type === 'reservation').length, 3)
  assert.equal(events.filter((e) => e.type === 'availability').length, 3)
})
