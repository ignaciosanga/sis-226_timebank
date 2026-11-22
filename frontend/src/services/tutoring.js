import { demoEnabled } from '../features/demo/mode.js'
import { apiRequest, ApiError, newIdempotencyKey } from './api'

// Opt-in until the backend team implements the contract in docs/ofertas-y-opiniones.md.
export const tutoringEnabled = demoEnabled || import.meta.env.VITE_TUTORING_API_ENABLED === 'true'
const requireIntegration = () => {
  if (!tutoringEnabled) throw new ApiError(503, 'Esta función estará disponible cuando se habilite la publicación de tutorías y opiniones.')
}
async function listAll(path) {
  requireIntegration()
  const rows = []
  for (let page = 1; ; page++) {
    const result = await apiRequest(`${path}${path.includes('?') ? '&' : '?'}page=${page}&limit=100`)
    if (!Array.isArray(result?.data) || !Number.isInteger(result?.meta?.totalPages)) throw new ApiError(502, 'No pudimos cargar la información de tutorías.')
    rows.push(...result.data)
    if (page >= result.meta.totalPages) return rows
  }
}
export const getTutorOffers = () => listAll('/tutoring/offers')
export const getMyReviews = () => listAll('/tutoring/reviews/me')
export const getTutorReviews = (userId, skillId) => listAll(`/tutoring/reviews?tutorId=${encodeURIComponent(userId)}&skillId=${encodeURIComponent(skillId)}`)
export async function publishTutorOffer(input, banner, key) {
  requireIntegration()
  let bannerUrl
  if (banner) {
    const data = new FormData()
    data.append('banner', banner)
    const result = await apiRequest('/tutoring/banners', { method: 'POST', body: data, idempotencyKey: `${key}.banner` })
    if (typeof result?.url !== 'string') throw new ApiError(502, 'No pudimos guardar la imagen. Intenta nuevamente.')
    bannerUrl = result.url
  }
  return apiRequest('/tutoring/offers', { method: 'POST', body: { ...input, ...(bannerUrl ? { bannerUrl } : {}) }, idempotencyKey: key })
}
export async function rateTutor(reservationId, input, key = newIdempotencyKey()) {
  requireIntegration()
  return apiRequest(`/tutoring/reservations/${encodeURIComponent(reservationId)}/review`, {
    method: 'POST', body: { calificacion: input.calificacion, comentario: input.comentario.trim() }, idempotencyKey: key,
  })
}
