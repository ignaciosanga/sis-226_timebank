import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSyntheticData } from '../src/features/demo/synthetic-data.js'
import { createLocalDemoApi } from '../src/features/demo/local-api.js'

const now = Date.parse('2026-11-18T18:00:00Z')
test('100 unique offers cover all 49 subjects with metrics derived from completed classes', () => {
  const state = createSyntheticData(now)
  assert.deepEqual(state, createSyntheticData(now))
  assert.equal(state.offers.length, 100)
  assert.equal(new Set(state.offers.map(o => `${o.id_usuario}:${o.id_habilidad}`)).size, 100)
  assert.equal(new Set(state.offers.map(o => o.id_habilidad)).size, 49)
  assert.equal(new Set(state.offers.map(o => o.id_usuario)).size, 25)
  for (const offer of state.offers) {
    const classes = state.reservations.filter(r => r.estado === 'Completada' && r.id_ofertante === offer.id_usuario && r.id_habilidad === offer.id_habilidad)
    const reviews = state.reviews.filter(r => classes.some(c => c.id_reserva === r.id_reserva))
    assert.equal(offer.metricas.tutorias_completadas, classes.length)
    assert.equal(offer.metricas.opiniones, reviews.length)
    assert.equal(offer.metricas.promedio, reviews.length ? reviews.reduce((s, r) => s + r.calificacion, 0) / reviews.length : null)
  }
  assert.equal(new Set(state.reviews.map(r => r.id_reserva)).size, state.reviews.length)
  for (const review of state.reviews) {
    const row = state.reservations.find(r => r.id_reserva === review.id_reserva)
    assert.equal(row.id_solicitante, review.id_usuario)
    assert.equal(row.estado, 'Completada')
    assert.ok(Date.parse(row.fecha_fin) < now)
  }
})

test('local ratings update the specific subject, deduplicate and reset with a new demo', async () => {
  const api = createLocalDemoApi(() => now), state = createSyntheticData(now)
  const row = state.reservations.find(r => r.id_solicitante === state.viewerId && r.estado === 'Completada' && !state.reviews.some(v => v.id_reserva === r.id_reserva))
  const path = `/tutoring/reservations/${row.id_reserva}/review`
  const input = { method: 'POST', body: { calificacion: 5, comentario: '  Muy claro.  ' }, idempotencyKey: 'review-once' }
  const first = await api(path, input)
  assert.equal(first.status, 200); assert.equal(first.data.comentario, 'Muy claro.')
  assert.deepEqual(await api(path, input), first)
  assert.equal((await api(path, { ...input, idempotencyKey: 'different-key' })).status, 409)
  assert.equal((await api(path, { ...input, body: { ...input.body, calificacion: 4 } })).status, 409)
  const offers = (await api('/tutoring/offers')).data.data
  const before = state.offers.find(o => o.id_usuario === row.id_ofertante && o.id_habilidad === row.id_habilidad)
  const after = offers.find(o => o.id_oferta === before.id_oferta)
  assert.equal(after.metricas.opiniones, before.metricas.opiniones + 1)
  const reset = createLocalDemoApi(() => now)
  assert.equal((await reset('/tutoring/reviews/me')).data.data.length, 3)
  assert.equal((await api(`/tutoring/reservations/${state.reservations[0].id_reserva}/review`, input)).status, 403)
})

test('local publishing validates own subject and time atomically and supports image upload', async () => {
  const api = createLocalDemoApi(() => now), state = createSyntheticData(now)
  const body = { skillId: state.skills[0].id_habilidad, nivel: 'Avanzado', costoCreditos: 7, titulo: 'Práctica guiada', descripcion: 'Resolveremos ejercicios de recursividad.', fechaInicio: '2026-12-10T18:00:00Z', fechaFin: '2026-12-10T19:00:00Z' }
  for (const costoCreditos of [undefined, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const result = await api('/tutoring/offers', { method: 'POST', body: { ...body, costoCreditos } })
    assert.equal(result.status, 400)
    assert.equal((await api('/tutoring/offers')).data.meta.total, 100)
  }
  const rejected = await api('/tutoring/offers', { method: 'POST', body: { ...body, fechaFin: body.fechaInicio } })
  assert.equal(rejected.status, 409)
  assert.equal((await api('/tutoring/offers')).data.meta.total, 100)
  const multipart = new FormData(); multipart.append('banner', new Blob(['image-fixture'], { type: 'image/webp' }), 'cover.webp')
  const image = await api('/tutoring/banners', { method: 'POST', body: multipart })
  assert.equal(image.status, 200); assert.match(image.data.url, /^data:image\/webp;base64,/)
  const input = { method: 'POST', body: { ...body, bannerUrl: image.data.url }, idempotencyKey: 'offer-once' }
  const offer = await api('/tutoring/offers', input)
  assert.equal(offer.status, 200); assert.equal(offer.data.id_usuario, state.viewerId); assert.equal(offer.data.costo_creditos, 7)
  assert.equal((await api('/tutoring/offers')).data.meta.total, 101)
  assert.deepEqual(await api('/tutoring/offers', input), offer)
  assert.equal((await api('/tutoring/offers', { ...input, idempotencyKey: 'new' })).status, 409)
})

test('reservation confirmation settles local credits, detects occupied time and blocks unsupported writes', async () => {
  const api = createLocalDemoApi(() => now), state = createSyntheticData(now)
  const row = state.reservations.find(r => r.id_solicitante === state.viewerId && r.estado === 'Confirmada' && Date.parse(r.fecha_fin) < now)
  assert.equal((await api(`/reservations/${row.id_reserva}/confirm`, { method: 'POST' })).data.estado, 'Completada')
  assert.deepEqual((await api('/credits/me')).data, { saldo: '36', creditos_retenidos: '8', disponibles: '28' })
  const future = state.reservations.find(r => r.estado === 'Confirmada' && Date.parse(r.fecha_inicio) > now)
  await api('/availability', { method: 'POST', body: { fechaInicio: future.fecha_inicio, fechaFin: future.fecha_fin } }).then(r => assert.equal(r.status, 409))
  for (const path of ['/admin/users', '/auth/register', '/calendar/reservations/anything/authorization-url', 'https://example.test/unknown']) assert.equal((await api(path, { method: 'POST', body: {} })).status, 501)
  const profile = (await api('/users/me')).data; profile.nombre = 'Mutación externa'
  assert.equal((await api('/users/me')).data.nombre, 'Estudiante')
})

test('demo requests snapshot the published price, ignore client amounts and keep it through settlement', async () => {
  const state = createSyntheticData(now), api = createLocalDemoApi(() => now)
  const offer = state.offers[4]
  const slots = (await api(`/users/${offer.id_usuario}/availability`)).data
  const slot = slots.find(s => s.estado === 'disponible')
  const input = { providerId: offer.id_usuario, skillId: offer.id_habilidad, availabilityId: slot.id_disponibilidad, fechaInicio: slot.fecha_inicio, fechaFin: new Date(Date.parse(slot.fecha_inicio) + 900000).toISOString(), costoCreditos: 1, creditos_requeridos: 1 }
  const first = await api('/exchanges', { method: 'POST', body: input })
  assert.equal(first.status, 200); assert.equal(first.data.creditos_requeridos, offer.costo_creditos)
  const second = await api('/exchanges', { method: 'POST', body: { ...input, fechaFin: slot.fecha_fin } })
  assert.equal(second.status, 200); assert.equal(second.data.creditos_requeridos, offer.costo_creditos)
  const { sendExchange, respondRequest, confirmReservation } = await import('../src/features/timebank/demo-actions.js')
  // Apply the accepted quote exactly as the local adapter does, then settle it.
  let quoted = sendExchange(state, state.viewerId, input, now)
  quoted.requests[0].creditos_requeridos = offer.costo_creditos
  const requestId = quoted.requests[0].id_solicitud
  quoted = respondRequest(quoted, offer.id_usuario, requestId, 'accept', now)
  assert.equal(quoted.reservations[0].creditos, offer.costo_creditos)
  const reservationId = quoted.reservations[0].id_reserva, completedAt = Date.parse(input.fechaFin) + 1
  const before = quoted.accounts[offer.id_usuario].saldo
  quoted = confirmReservation(quoted, state.viewerId, reservationId, completedAt)
  quoted = confirmReservation(quoted, offer.id_usuario, reservationId, completedAt)
  assert.equal(quoted.accounts[offer.id_usuario].saldo, before + offer.costo_creditos)
})
