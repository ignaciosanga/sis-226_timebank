import { apiRequest } from './api'

// RF-38 · Rutas de GET /notifications/me, PATCH /notifications/{id}/read y POST /notifications/read-all.
export const listNotifications = ({ page = 1, limit = 20 } = {}) => apiRequest(`/notifications/me?page=${page}&limit=${limit}`)
export const markNotificationRead = (id) => apiRequest(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' })
export const markAllNotificationsRead = () => apiRequest('/notifications/read-all', { method: 'POST' })
