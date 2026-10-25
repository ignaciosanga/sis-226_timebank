import { apiRequest, setToken } from './api'

export async function login(correo, password) {
  const data = await apiRequest('/auth/login', { method: 'POST', body: { correo, password } })
  setToken(data.access_token)
  return data.user
}

export const register = (payload) => apiRequest('/auth/register', { method: 'POST', body: payload })

export const getProfile = () => apiRequest('/users/me')

export function logout() { setToken(null) }
