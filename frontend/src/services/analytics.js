import { apiRequest } from './api'

function queryString(filters = {}) {
  const params = new URLSearchParams()
  for (const key of ['from', 'to', 'codigo', 'area', 'semestre', 'limit', 'groupBy']) if (filters[key] !== undefined && filters[key] !== '') params.set(key, String(filters[key]))
  return params.size ? `?${params}` : ''
}
export const getUsers = (filters) => apiRequest(`/analytics/users${queryString(filters)}`)
export const getExchanges = (filters) => apiRequest(`/analytics/exchanges${queryString(filters)}`)
export const getCredits = (filters) => apiRequest(`/analytics/credits${queryString(filters)}`)
export const getSkills = (filters) => apiRequest(`/analytics/skills${queryString(filters)}`)
export const getEconomy = (filters) => apiRequest(`/analytics/economy${queryString(filters)}`)

async function getAllClasses() {
  const rows = []; let first
  for (let page = 1; ; page++) {
    const result = await apiRequest(`/intercambios/mis-clases?page=${page}&limit=100`)
    if (!Array.isArray(result?.data) || !Number.isInteger(result?.meta?.totalPages) || result.meta.totalPages < 0) throw new Error('No pudimos interpretar el historial de clases.')
    first ??= result; rows.push(...result.data)
    if (page >= result.meta.totalPages) return { ...first, data: rows }
  }
}
export async function loadReportSources(audience, filters) {
  const readers = audience === 'admin'
    ? { overview: () => getOverview(filters), users: () => getUsers(filters), exchanges: () => getExchanges(filters), credits: () => getCredits(filters), skills: () => getSkills(filters), academic: () => getAcademic(filters), reputation: () => getReputation(filters), economy: () => getEconomy(filters) }
    : { account: () => apiRequest('/credits/me'), movements: () => apiRequest('/credits/me/movements'), reservations: () => apiRequest('/reservations/me'), classes: getAllClasses, roadmap: () => apiRequest('/roadmap/me') }
  const keys = Object.keys(readers)
  const results = await Promise.allSettled(keys.map(key => readers[key]()))
  const sources = {}, errors = {}
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') sources[keys[i]] = result.value
    else errors[keys[i]] = result.reason?.message || 'No se pudo cargar esta información.'
  })
  return { sources, errors }
}

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
