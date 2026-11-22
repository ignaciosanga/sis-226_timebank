// RF-38 · Modelo puro de la campanita de notificaciones (sin Vue ni red, probado con node --test).
// Contrato: docs/contratos-parcial3.md (notificaciones) y GET /notifications/me en docs/openapi.json.
export const NOTIFICATION_PAGE_SIZE = 20
export const NOTIFICATION_POLL_MS = 60000

const EXCHANGE_TYPES = new Set(['SolicitudRecibida', 'SolicitudAceptada', 'SolicitudRechazada', 'SolicitudCancelada', 'ReservaCancelada', 'ClasePorConfirmar'])

export function normalizeNotification(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id_notificacion !== 'string' || !raw.id_notificacion) return null
  const time = Date.parse(raw.created_at)
  return {
    id: raw.id_notificacion,
    type: typeof raw.tipo === 'string' ? raw.tipo : '',
    title: typeof raw.titulo === 'string' ? raw.titulo : '',
    message: typeof raw.mensaje === 'string' ? raw.mensaje : '',
    read: raw.leida === true,
    createdAt: Number.isNaN(time) ? null : time,
  }
}

const count = (value) => (Number.isInteger(value) && value > 0 ? value : 0)

export function parseNotificationsPage(response) {
  const rows = Array.isArray(response?.data) ? response.data : []
  const items = rows.map(normalizeNotification).filter(Boolean)
  const meta = response?.meta ?? {}
  return { items, unread: count(meta.noLeidas), total: count(meta.total) || items.length, page: count(meta.page) || 1 }
}

export function mergePages(current, incoming) {
  const seen = new Set(current.map((item) => item.id))
  return [...current, ...incoming.filter((item) => !seen.has(item.id))]
}

export function markReadLocal(items, id) {
  return items.map((item) => (item.id === id ? { ...item, read: true } : item))
}

export const markAllReadLocal = (items) => items.map((item) => (item.read ? item : { ...item, read: true }))

export function badgeLabel(unread) {
  const total = count(unread)
  if (!total) return ''
  return total > 9 ? '9+' : String(total)
}

export function bellLabel(unread) {
  const total = count(unread)
  if (!total) return 'Notificaciones'
  return `Notificaciones, ${total} sin leer`
}

export function relativeTime(timestamp, now = Date.now()) {
  if (!Number.isFinite(timestamp)) return ''
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (seconds < 60) return 'ahora'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `hace ${days} d`
  return new Date(timestamp).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function routeFor(type) {
  if (EXCHANGE_TYPES.has(type)) return '/intercambios'
  if (type === 'OpinionRecibida') return '/perfil'
  return null
}
