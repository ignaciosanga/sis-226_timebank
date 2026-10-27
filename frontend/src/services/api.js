const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '')
const TOKEN_KEY = 'nexo-u.session'
const MESSAGES = {
  400: 'Revisa los datos ingresados.',
  401: 'Tu sesión expiró. Vuelve a ingresar.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'No encontramos lo que buscas.',
  409: 'No se pudo completar porque los datos cambiaron o hay un conflicto.',
  429: 'Hiciste demasiados intentos. Espera un momento.',
  503: 'El servicio no está disponible. Intenta de nuevo en unos segundos.',
}

function readToken() {
  try { return window.sessionStorage.getItem(TOKEN_KEY) } catch { return null }
}

let token = readToken()
let unauthorizedHandler = () => {}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export const getToken = () => token

export function setToken(value) {
  token = value || null
  try {
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token)
    else window.sessionStorage.removeItem(TOKEN_KEY)
  } catch { return }
}

export function onUnauthorized(handler) { unauthorizedHandler = handler }

export const newIdempotencyKey = () => window.crypto.randomUUID()

function errorMessage(status, data) {
  const raw = data?.message
  if (status < 500 && Array.isArray(raw) && raw.length) return raw.join('. ')
  if (status < 500 && typeof raw === 'string' && raw) return raw
  return MESSAGES[status] || 'Ocurrió un error inesperado. Intenta de nuevo.'
}

export async function apiRequest(path, { method = 'GET', body, idempotencyKey } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  let response
  try {
    response = await fetch(`${API_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. Si el sistema estuvo inactivo, espera unos segundos y vuelve a intentar.')
  }
  if (response.status === 204) return null
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && token) unauthorizedHandler()
    throw new ApiError(response.status, errorMessage(response.status, data))
  }
  return data
}
