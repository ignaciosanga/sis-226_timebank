import { test } from 'node:test'
import assert from 'node:assert/strict'
import { badgeLabel, bellLabel, markAllReadLocal, markReadLocal, mergePages, normalizeNotification, parseNotificationsPage, relativeTime, routeFor } from './notification-model.js'

const row = (n, extra = {}) => ({ id_notificacion: `id-${n}`, tipo: 'SolicitudRecibida', titulo: `Título ${n}`, mensaje: `Mensaje ${n}`, leida: false, created_at: '2026-11-22T12:00:00.000Z', ...extra })

test('normaliza una notificación del contrato y descarta filas sin identificador', () => {
  const item = normalizeNotification(row(1))
  assert.deepEqual(item, { id: 'id-1', type: 'SolicitudRecibida', title: 'Título 1', message: 'Mensaje 1', read: false, createdAt: Date.parse('2026-11-22T12:00:00.000Z') })
  assert.equal(normalizeNotification({ titulo: 'sin id' }), null)
  assert.equal(normalizeNotification(null), null)
  assert.equal(normalizeNotification(row(2, { created_at: 'no es fecha' })).createdAt, null)
})

test('la página usa meta.noLeidas del servidor y tolera respuestas incompletas', () => {
  const page = parseNotificationsPage({ data: [row(1), row(2, { leida: true }), { basura: true }], meta: { page: 1, limit: 20, total: 31, totalPages: 2, noLeidas: 5 } })
  assert.equal(page.items.length, 2)
  assert.equal(page.unread, 5)
  assert.equal(page.total, 31)
  const vacia = parseNotificationsPage(undefined)
  assert.deepEqual(vacia, { items: [], unread: 0, total: 0, page: 1 })
})

test('marcar como leída una o todas no muta la lista original', () => {
  const items = [normalizeNotification(row(1)), normalizeNotification(row(2))]
  const one = markReadLocal(items, 'id-1')
  assert.equal(one[0].read, true)
  assert.equal(one[1].read, false)
  assert.equal(items[0].read, false)
  assert.ok(markAllReadLocal(items).every((item) => item.read))
  assert.equal(items[1].read, false)
})

test('la paginación no duplica notificaciones ya cargadas', () => {
  const first = [normalizeNotification(row(1)), normalizeNotification(row(2))]
  const next = [normalizeNotification(row(2)), normalizeNotification(row(3))]
  assert.deepEqual(mergePages(first, next).map((item) => item.id), ['id-1', 'id-2', 'id-3'])
})

test('el contador se oculta en cero y se limita a 9+', () => {
  assert.equal(badgeLabel(0), '')
  assert.equal(badgeLabel(4), '4')
  assert.equal(badgeLabel(10), '9+')
  assert.equal(badgeLabel(-3), '')
  assert.equal(bellLabel(0), 'Notificaciones')
  assert.equal(bellLabel(3), 'Notificaciones, 3 sin leer')
})

test('el tiempo relativo se expresa en español', () => {
  const t = Date.parse('2026-11-22T12:00:00.000Z')
  assert.equal(relativeTime(t, t + 20_000), 'ahora')
  assert.equal(relativeTime(t, t + 5 * 60_000), 'hace 5 min')
  assert.equal(relativeTime(t, t + 3 * 3_600_000), 'hace 3 h')
  assert.equal(relativeTime(t, t + 2 * 86_400_000), 'hace 2 d')
  assert.equal(relativeTime(null), '')
  assert.equal(relativeTime(t, t - 60_000), 'ahora')
})

test('cada tipo del contrato lleva a la pantalla correcta', () => {
  for (const type of ['SolicitudRecibida', 'SolicitudAceptada', 'SolicitudRechazada', 'SolicitudCancelada', 'ReservaCancelada', 'ClasePorConfirmar']) assert.equal(routeFor(type), '/intercambios')
  assert.equal(routeFor('OpinionRecibida'), '/perfil')
  assert.equal(routeFor('TipoNuevo'), null)
})
