import { apiRequest, setToken } from './api'

export async function login(correo, password) {
  const data = await apiRequest('/auth/login', { method: 'POST', body: { correo, password } })
  setToken(data.access_token)
  return data.user
}

export async function googleSignIn(body) {
  const data = await apiRequest('/auth/google', { method: 'POST', body })
  if (data.registration_required) return { pending: data.profile }
  setToken(data.access_token)
  return { user: data.user }
}

export const register = (payload) => apiRequest('/auth/register', { method: 'POST', body: payload })

export const getProfile = () => apiRequest('/users/me')

// changes: cualquiera de { nombre, apellido, idCarrera, semestre }.
export const updateProfile = (changes) => apiRequest('/users/me', { method: 'PATCH', body: changes })

export function logout() { setToken(null) }
