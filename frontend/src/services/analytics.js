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

// HU08 (Parcial 3): GET /analytics/reputation (solo ADMIN).
export function getReputation({ from, to, codigo, area, semestre } = {}) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (codigo) params.set('codigo', codigo)
  if (area) params.set('area', area)
  if (semestre) params.set('semestre', String(semestre))
  const qs = params.toString()
  return apiRequest(`/analytics/reputation${qs ? `?${qs}` : ''}`)
}

// Command Center / Knowledge Gap Index (Parcial 3): GET /analytics/academic (solo ADMIN).
export function getAcademic({ from, to, codigo, area, semestre } = {}) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (codigo) params.set('codigo', codigo)
  if (area) params.set('area', area)
  if (semestre) params.set('semestre', String(semestre))
  const qs = params.toString()
  return apiRequest(`/analytics/academic${qs ? `?${qs}` : ''}`)
}
