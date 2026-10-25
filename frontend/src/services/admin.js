import { apiRequest } from './api'

// RF-16: GET /admin/users (paginado). Devuelve { data, meta }.
export function listUsers({ page = 1, limit = 20, search = '', estado = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (search.trim()) params.set('search', search.trim())
  if (estado && estado !== 'Todos') params.set('estado', estado)
  return apiRequest(`/admin/users?${params}`)
}

// RF-16: POST /admin/users con el mismo cuerpo del registro (RegisterDto).
export const createUser = (payload) => apiRequest('/admin/users', { method: 'POST', body: payload })

// RF-16: PATCH /admin/users/:id/status. changes: { estado: 'Activo' | 'Inactivo', motivo? }.
export const setUserStatus = (id, changes) => apiRequest(`/admin/users/${id}/status`, { method: 'PATCH', body: changes })

// RF-17: POST /credits/grants. amount es un string de enteros; la clave evita duplicar la carga al reintentar.
export const grantCredits = (input, idempotencyKey) => apiRequest('/credits/grants', { method: 'POST', body: input, idempotencyKey })
