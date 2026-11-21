import { apiRequest } from './api'

export const askAssistant = (question, history = []) =>
  apiRequest('/assistant/ask', { method: 'POST', body: { question, history } })
