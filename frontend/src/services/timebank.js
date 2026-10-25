import { apiRequest, newIdempotencyKey } from './api'

const post = (path, body = {}) => apiRequest(path, { method: 'POST', body, idempotencyKey: newIdempotencyKey() })

export const getMySkills = () => apiRequest('/users/me/skills')
export const publishSkill = ({ skillId, nivel }) => apiRequest('/users/me/skills', { method: 'POST', body: { skillId, nivel } })
export const getUserSkills = (userId) => apiRequest(`/users/${userId}/skills`)
export async function getSkillProviders(skillId) {
  const rows = []
  for (let page = 1; ; page += 1) {
    const result = await apiRequest(`/skills/${skillId}/providers?page=${page}&limit=100`)
    rows.push(...result.data)
    if (page >= result.meta.totalPages) return rows
  }
}

export const getMyAvailability = () => apiRequest('/availability/me')
export const publishAvailability = ({ fechaInicio, fechaFin }) => apiRequest('/availability', { method: 'POST', body: { fechaInicio, fechaFin } })
export const getUserAvailability = (userId) => apiRequest(`/users/${userId}/availability`)

export const getMyExchanges = () => apiRequest('/exchanges/me')
export function sendExchange({ providerId, skillId, availabilityId, fechaInicio, fechaFin, descripcion }) {
  const body = { providerId, skillId, availabilityId, fechaInicio, fechaFin }
  if (descripcion && descripcion.trim()) body.descripcion = descripcion.trim()
  return post('/exchanges', body)
}
export const respondExchange = (id, action) => post(`/exchanges/${id}/${action}`)

export const getMyReservations = () => apiRequest('/reservations/me')
export const confirmReservation = (id) => post(`/reservations/${id}/confirm`)
export const cancelReservation = (id, motivo) => post(`/reservations/${id}/cancel`, { motivo })

export const getAccount = () => apiRequest('/credits/me')
export const getMovements = () => apiRequest('/credits/me/movements')
