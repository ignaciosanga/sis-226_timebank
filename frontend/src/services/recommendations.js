import { demoEnabled } from '../features/demo/mode.js'
import { demoRecommendations } from '../features/recommendations/recommendation-model.js'
import { apiRequest, ApiError } from './api'

export const recommendationsEnabled = demoEnabled || import.meta.env.VITE_RECOMMENDATIONS_API_ENABLED === 'true'
export async function getTutorRecommendations(skillId, offers = []) {
  if (demoEnabled) return demoRecommendations(skillId, offers)
  if (!recommendationsEnabled) throw new ApiError(503, 'Las sugerencias todavía no están disponibles. Puedes comparar las ofertas de esta materia.', 'MATCHING_NOT_ENABLED')
  return apiRequest(`/tutoring/recommendations?skillId=${encodeURIComponent(skillId)}`)
}
