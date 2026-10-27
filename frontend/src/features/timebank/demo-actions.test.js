import test from 'node:test'
import assert from 'node:assert/strict'
import { createDemoState, CURRENT_USER_ID } from './demo-state.js'
import { DEMO_SKILLS } from './catalogs.js'
import { cancelReservation, confirmReservation, creditsFor, DemoError, publishAvailability, publishSkill, respondRequest, sendExchange, validateInterval } from './demo-actions.js'
import { localDate, toZonedISO } from './format.js'
const now = Date.parse('2026-10-24T16:00:00Z')
const state = () => createDemoState(now)
const total = (value) => Object.values(value.accounts).reduce((sum, row) => sum + row.saldo, 0)
const input = (value) => {
  const slot = value.availability[1]
  return { providerId: slot.id_usuario, skillId: DEMO_SKILLS[0].id_habilidad, availabilityId: slot.id_disponibilidad, fechaInicio: slot.fecha_inicio, fechaFin: new Date(Date.parse(slot.fecha_inicio) + 3600000).toISOString(), descripcion: 'Practicar Java' }
}
test('intervals use one credit per 15 minutes and enforce future, duration and maximum rules', () => {
  assert.equal(creditsFor('2026-10-25T10:00:00Z', '2026-10-25T11:00:00Z'), 4)
  assert.equal(validateInterval('2026-10-25T10:00:00Z', '2026-10-25T18:00:00Z', now), 32)
  for (const [from, to] of [['bad', 'bad'], ['2026-10-23T10:00:00Z', '2026-10-23T11:00:00Z'], ['2026-10-25T10:00:00Z', '2026-10-25T10:10:00Z'], ['2026-10-25T10:00:00Z', '2026-10-25T19:00:00Z']]) assert.throws(() => validateInterval(from, to, now), DemoError)
})
test('La Paz inputs are converted to explicit UTC timestamps', () => {
  assert.equal(toZonedISO('2026-10-25', '10:00'), '2026-10-25T14:00:00.000Z')
  assert.equal(localDate('2026-10-25T02:00:00Z'), '2026-10-24')
  assert.equal(toZonedISO('', ''), '')
})
test('sending a request does not hold credits and rejects repeated requests and out-of-slot intervals', () => {
  const original = state()
  const next = sendExchange(original, CURRENT_USER_ID, input(original), now)
  assert.equal(next.requests.length, original.requests.length + 1)
  assert.deepEqual(next.accounts, original.accounts)
  assert.equal(next.requests[0].creditos_requeridos, 4)
  assert.throws(() => sendExchange(next, CURRENT_USER_ID, input(original), now), DemoError)
  assert.throws(() => sendExchange(original, CURRENT_USER_ID, { ...input(original), fechaFin: new Date(Date.parse(input(original).fechaFin) + 7200000).toISOString() }, now), DemoError)
})
test('accepting an incoming request creates exactly one reservation and holds the requester credits', () => {
  const original = state()
  const request = original.requests[0]
  const next = respondRequest(original, CURRENT_USER_ID, request.id_solicitud, 'accept', now)
  assert.equal(next.requests[0].estado, 'Aceptada')
  assert.equal(next.reservations.length, original.reservations.length + 1)
  assert.equal(next.accounts[request.id_solicitante].creditos_retenidos, original.accounts[request.id_solicitante].creditos_retenidos + 4)
  assert.equal(total(next), total(original))
  assert.throws(() => respondRequest(next, CURRENT_USER_ID, request.id_solicitud, 'accept', now), DemoError)
  assert.equal(original.requests[0].estado, 'Solicitada')
})
test('insufficient balance and overlapping reservations fail atomically', () => {
  const original = state()
  const request = original.requests[0]
  original.accounts[request.id_solicitante] = { saldo: 4, creditos_retenidos: 4 }
  const before = structuredClone(original)
  assert.throws(() => respondRequest(original, CURRENT_USER_ID, request.id_solicitud, 'accept', now), DemoError)
  assert.deepEqual(original, before)
  const overlapping = state()
  overlapping.reservations.push({ ...overlapping.reservations[0], fecha_inicio: request.fecha_inicio_propuesta, fecha_fin: request.fecha_fin_propuesta })
  assert.throws(() => respondRequest(overlapping, CURRENT_USER_ID, request.id_solicitud, 'accept', now), DemoError)
})
test('only the correct participant can accept, reject or cancel pending requests', () => {
  const original = state()
  assert.throws(() => respondRequest(original, CURRENT_USER_ID, 'demo-outgoing', 'accept', now), DemoError)
  assert.throws(() => respondRequest(original, CURRENT_USER_ID, 'demo-incoming', 'cancel', now), DemoError)
  const rejected = respondRequest(original, CURRENT_USER_ID, 'demo-incoming', 'reject', now)
  assert.equal(rejected.requests[0].estado, 'Rechazada')
  assert.deepEqual(rejected.accounts, original.accounts)
  assert.equal(respondRequest(original, CURRENT_USER_ID, 'demo-outgoing', 'cancel', now).requests[1].estado, 'Cancelada')
})
test('canceling before the start releases credits and preserves history', () => {
  const original = state()
  const next = cancelReservation(original, CURRENT_USER_ID, 'demo-future', 'Cambio de horario', now)
  assert.equal(next.reservations[0].estado, 'Cancelada')
  assert.equal(next.reservations.length, original.reservations.length)
  assert.equal(next.accounts[CURRENT_USER_ID].creditos_retenidos, 0)
  assert.equal(next.accounts[CURRENT_USER_ID].saldo, original.accounts[CURRENT_USER_ID].saldo)
  assert.equal(next.movements[0].tipo, 'Liberacion')
  assert.throws(() => cancelReservation(original, CURRENT_USER_ID, 'demo-future', '', now), DemoError)
  assert.throws(() => cancelReservation(original, CURRENT_USER_ID, 'demo-past', 'Motivo', now), DemoError)
})
test('completion needs two confirmations after the end and settles only once', () => {
  const original = state()
  assert.throws(() => confirmReservation(original, CURRENT_USER_ID, 'demo-future', now), DemoError)
  const next = confirmReservation(original, CURRENT_USER_ID, 'demo-past', now)
  assert.equal(next.reservations[1].estado, 'Completada')
  assert.equal(next.accounts[CURRENT_USER_ID].saldo, original.accounts[CURRENT_USER_ID].saldo + 4)
  assert.equal(total(next), total(original))
  assert.throws(() => confirmReservation(next, CURRENT_USER_ID, 'demo-past', now), DemoError)
  const firstOnly = state()
  firstOnly.reservations[1].confirmacion_solicitante_at = null
  const waiting = confirmReservation(firstOnly, CURRENT_USER_ID, 'demo-past', now)
  assert.equal(waiting.reservations[1].estado, 'Confirmada')
  assert.deepEqual(waiting.accounts, firstOnly.accounts)
  assert.throws(() => confirmReservation(waiting, CURRENT_USER_ID, 'demo-past', now), DemoError)
})
test('availability rejects overlaps while allowing adjacent time blocks', () => {
  const original = state()
  const slot = original.availability[0]
  assert.throws(() => publishAvailability(original, CURRENT_USER_ID, { fechaInicio: slot.fecha_inicio, fechaFin: slot.fecha_fin }, now), DemoError)
  const next = publishAvailability(original, CURRENT_USER_ID, { fechaInicio: slot.fecha_fin, fechaFin: new Date(Date.parse(slot.fecha_fin) + 3600000).toISOString() }, now)
  assert.equal(next.availability.length, original.availability.length + 1)
})
test('published skills require a catalog skill and valid level and cannot be duplicated', () => {
  const original = state()
  const payload = { skillId: DEMO_SKILLS[0].id_habilidad, nivel: 'Avanzado' }
  const next = publishSkill(original, CURRENT_USER_ID, payload, DEMO_SKILLS)
  assert.equal(next.published.length, original.published.length + 1)
  assert.throws(() => publishSkill(next, CURRENT_USER_ID, payload, DEMO_SKILLS), DemoError)
  assert.throws(() => publishSkill(original, CURRENT_USER_ID, { ...payload, nivel: 'Unknown' }, DEMO_SKILLS), DemoError)
})
