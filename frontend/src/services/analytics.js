import { apiRequest } from './api'

// RF-18: GET /analytics/overview (solo ADMIN). from/to son ISO-8601 opcionales;
// sin ellos el backend usa los últimos 30 días.
export function getOverview({ from, to } = {}) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const qs = params.toString()
  return apiRequest(`/analytics/overview${qs ? `?${qs}` : ''}`)
}
