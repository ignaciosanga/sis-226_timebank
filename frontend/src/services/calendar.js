import { apiRequest } from './api'

export async function getReservationAuthorizationUrl(reservationId) {
  return apiRequest(`/calendar/reservations/${reservationId}/authorization-url`, {
    method: 'POST',
  })
}
