import { apiRequest } from './api'

export const askAssistant = (question, history = [], route = '/') =>
  apiRequest('/assistant/ask', { method: 'POST', body: { question, history, route } })
export const getAssistantProfile = () => apiRequest('/assistant/me')
export const saveAssistantAvatar = (avatar) => apiRequest('/assistant/me/avatar', { method: 'PUT', body: avatar })
export const saveAssistantKey = (apiKey) => apiRequest('/assistant/me/key', { method: 'PUT', body: { apiKey } })
export const deleteAssistantKey = () => apiRequest('/assistant/me/key', { method: 'DELETE' })
