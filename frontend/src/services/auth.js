import { apiRequest, setToken } from './api'

export async function login(correo, password) {
  const data = await apiRequest('/auth/login', { method: 'POST', body: { correo, password } })
  setToken(data.access_token)
  return data.user
}

export const register = (payload) => apiRequest('/auth/register', { method: 'POST', body: payload })

export const getProfile = () => apiRequest('/users/me')

// changes: cualquiera de { nombre, apellido, idCarrera, semestre }.
export const updateProfile = (changes) => apiRequest('/users/me', { method: 'PATCH', body: changes })

export function logout() { setToken(null) }
